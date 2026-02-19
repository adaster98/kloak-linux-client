const { app, BrowserWindow, Tray, Menu, session, ipcMain, dialog, desktopCapturer, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let screenSources = [];
let screenShareCallback = null;
let mainWindow;
let tray;
let pendingPermissions = {};

// Store settings
const settingsPath = path.join(app.getPath('userData'), 'kloak-settings.json');

function loadSettings() {
    try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
    catch (e) { return { skipLinkWarning: false }; }
}
function saveSettings(settings) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
}
let appSettings = loadSettings();

// IPC Window control events
ipcMain.on('window-min', () => mainWindow.minimize());
ipcMain.on('window-max', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => mainWindow.hide()); // Hide instead of close to keep tray active


function createWindow() {
    // --- 1. Create the Splash Screen Window ---
    let splashWindow = new BrowserWindow({
        width: 350,
        height: 450,
        transparent: true,
        frame: false,
        alwaysOnTop: true, // Keeps it above other apps while loading
        resizable: false,
        icon: path.join(__dirname, 'icons/icon.png')
    });

    // Load the HTML file we just created
    splashWindow.loadFile(path.join(__dirname, 'splash.html'));

    // --- 2. Create the Main Window (But keep it hidden) ---
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        show: false, // <-- CRUCIAL: Keeps it invisible while Kloak loads
        icon: path.join(__dirname, 'icons/icon.png'),
                                   webPreferences: {
                                       preload: path.join(__dirname, 'preload.js'),
                                   contextIsolation: true,
                                   nodeIntegration: false,
                                   partition: 'persist:kloak'
                                   }
    });

    // Get correct session
    const appSession = session.fromPartition('persist:kloak');

    const appUserAgent = mainWindow.webContents.getUserAgent() + ' KloakClient Electron Tauri';
    mainWindow.webContents.setUserAgent(appUserAgent);

    // Start loading the heavy website in the background
    mainWindow.loadURL('https://kloak.app/app');

    // --- 3. The Window Swap ---
    // Wait until the website is completely downloaded and parsed
    mainWindow.webContents.once('did-finish-load', () => {
        // Add a tiny 500ms delay to ensure their CSS paints properly before revealing
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
            }
            mainWindow.show();
            mainWindow.focus();
        }, 500);
    });

    // Prevent navigation on file drop
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith('file://')) event.preventDefault();
    });
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith('file://')) return { action: 'deny' };
                return { action: 'allow' };
        });

        // CSS Injection
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.insertCSS(`
            html, body {
                border-radius: 20px;
                overflow: hidden;
                background: transparent !important;
            }
            #app, #root, body > div:first-child {
            background-color: #0f0f0f !important;
            transition: background-color 0.2s ease;
            height: 100vh;
            width: 100vw;
            }
            .h-9.w-full.border-b {
                -webkit-app-region: drag !important;
                user-select: none;
            }
            .h-9.w-full.border-b button {
                -webkit-app-region: no-drag !important;
                cursor: pointer !important;
            }

            /* Fix for the memory leak thats been bugging me for a day */
            /* This flattens the chat into a single texture and saves VRAM */
            * {
                backdrop-filter: none !important;
            }
            `);
        });

        // Permission Handlers

        // Catch the request
        appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
            const permissionsToPrompt = ['media', 'geolocation', 'notifications'];

            if (permissionsToPrompt.includes(permission)) {
                const reqId = Date.now().toString();
                pendingPermissions[reqId] = callback;

                // Spawn box
                mainWindow.webContents.send('show-custom-permission', {
                    id: reqId,
                    permission: permission
                });
            } else {
                callback(true);
            }
        });

        // Permission IPC Listener
        ipcMain.on('permission-response', (event, { id, allowed }) => {
            if (pendingPermissions[id]) {
                // Execute the saved callback with the user's choice (true/false)
                pendingPermissions[id](allowed);
                delete pendingPermissions[id]; // Cleanup
            }
        });

        // Handle standard "Hide on Close" behavior
        mainWindow.on('close', (event) => {
            if (!app.isQuiting) {
                event.preventDefault();
                mainWindow.hide();
            }
            return false;
        });

        // Attach screenshare handler to 'appSession'
        appSession.setDisplayMediaRequestHandler((request, callback) => {
            desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: {width: 300, height: 300} })
            .then((sources) => {
                screenSources = sources;
                screenShareCallback = callback;
                const cleanSources = sources.map(source => ({
                    id: source.id,
                    name: source.name,
                    thumbnail: source.thumbnail.toDataURL()
                }));
                mainWindow.webContents.send('show-screen-picker', cleanSources);
            })
            .catch((err) => {
                console.error("Error getting screen sources:", err);
                callback(null);
            });
        });

        // IPC Handler for Selection stays the same (it's attached to ipcMain, which is global)
        ipcMain.on('screen-share-selected', (event, sourceId) => {
            if (screenShareCallback) {
                if (sourceId) {
                    const chosenSource = screenSources.find(s => s.id === sourceId);
                    if (chosenSource) {
                        screenShareCallback({ video: chosenSource });
                    } else {
                        screenShareCallback(null);
                    }
                } else {
                    screenShareCallback(null);
                }
                screenShareCallback = null;
                screenSources = [];
            }
        });

        // Handle external links
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith('http:') || url.startsWith('https:')) {
                if (appSettings.skipLinkWarning) {
                    // User checked the box previously, open immediately
                    shell.openExternal(url);
                } else {
                    // Send to the frontend to show the warning UI
                    mainWindow.webContents.send('show-link-warning', url);
                }
            }
            return { action: 'deny' }; // Always stop Electron's default window
        });

        // Listen for link warning response
        ipcMain.on('link-warning-response', (event, { url, allowed, remember }) => {
            if (remember) {
                appSettings.skipLinkWarning = true;
                saveSettings(appSettings);
            }
            if (allowed) {
                shell.openExternal(url);
            }
        });
}

function createTray() {
    const iconPath = path.join(__dirname, 'icons/icon.png');
    tray = new Tray(iconPath);
    tray.setToolTip('Kloak Client');

    // Left click, Toggle Window
    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            if (mainWindow.isFocused()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // Right click, Context Menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open',
            click: () => {
                mainWindow.show();
                mainWindow.focus();
            }
        },
        {
            label: 'Restart',
            click: () => {
                app.relaunch(); // Spawns a new instance of the app
                app.exit(0);    // Kills the current instance immediately
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
    createWindow();
    createTray();
});
