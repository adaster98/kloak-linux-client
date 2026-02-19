const { contextBridge, ipcRenderer } = require('electron');

// Expose the API
contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-min'),
                                maximize: () => ipcRenderer.send('window-max'),
                                close: () => ipcRenderer.send('window-close')
});

// Find buttons
window.addEventListener('DOMContentLoaded', () => {
    console.log("Kloak Client: Preload script loaded.");

    // Button finder
    setInterval(() => {
        const topBar = document.querySelector('.h-9.w-full');
        if (!topBar) return;

        const minBtn = topBar.querySelector('button[aria-label="Minimize"]');
        const maxBtn = topBar.querySelector('button[aria-label="Maximize"]');
        const closeBtn = topBar.querySelector('button[aria-label="Close"]');

        const wireButton = (btn, actionName) => {
            if (btn && !btn.hasAttribute('data-electron-wired')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    ipcRenderer.send(actionName);
                });
                btn.setAttribute('data-electron-wired', 'true');
                btn.style.webkitAppRegion = "no-drag";
                btn.style.cursor = "pointer";
            }
        };

        wireButton(minBtn, 'window-min');
        wireButton(maxBtn, 'window-max');
        wireButton(closeBtn, 'window-close');
    }, 1000);

    document.addEventListener('dragover', (event) => {
        event.preventDefault(); // Allows 'drop' to fire

    });

    document.addEventListener('drop', (event) => {
        // If the user dropped a file, stop the browser from opening it.
        // Kloak's own listeners will still catch this event.
        if (event.dataTransfer && event.dataTransfer.files.length > 0) {
        }
    });

    // Theme syncing
    let lastThemeColor = '';

    const syncThemeColor = () => {
        const topBar = document.querySelector('.h-9.w-full');
        const appRoot = document.getElementById('root') || document.querySelector('#app');

        if (topBar && appRoot) {
            const themeColor = window.getComputedStyle(topBar).backgroundColor;

            // ONLY update the DOM if the color actually changed!
            if (themeColor !== lastThemeColor) {
                appRoot.style.setProperty('background-color', themeColor, 'important');
                lastThemeColor = themeColor;
            }
        }
    };

    setTimeout(syncThemeColor, 500);

    const themeObserver = new MutationObserver(() => {
        syncThemeColor();
    });

    // DO NOT watch 'style' here, it fires continuously during scrolling!
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme']
    });

    // Screenshare picker UI
    const screenModal = document.createElement('div');
    screenModal.id = 'kloak-screen-picker';

    // We use a dedicated class now to avoid the orange permission borders
    screenModal.innerHTML = `
    <div class="kloak-screen-box">

    <div class="kloak-screen-header">
    <div class="kloak-screen-icon">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E0E0E0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="20" height="14" x="2" y="3" rx="2"/>
    <line x1="8" x2="16" y1="21" y2="21"/>
    <line x1="12" x2="12" y1="17" y2="21"/>
    </svg>
    </div>
    <div class="kloak-screen-titles">
    <h3 style="color: #E0E0E0; margin-bottom: 4px;">Share your screen</h3>
    <span style="color: #949494;">Choose a screen or window to share</span>
    </div>
    </div>

    <div id="kloak-screen-grid"></div>

    <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
    <button id="kloak-screen-cancel">Cancel</button>
    </div>

    </div>
    `;
    document.body.appendChild(screenModal);

    // Inject CSS for the Grid and Background
    const screenStyle = document.createElement('style');
    screenStyle.innerHTML = `
    #kloak-screen-picker {
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999999;
    justify-content: center;
    align-items: center;
    font-family: inherit;
    }

    .kloak-screen-box {
        background: linear-gradient(180deg, #1e1e1e 0%, #161616 100%);
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 24px;
        width: 700px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
    }

    .kloak-screen-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
    }

    .kloak-screen-icon {
        background: #262626;
        padding: 10px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .kloak-screen-titles h3 { margin: 0; font-size: 16px; font-weight: 600; }
    .kloak-screen-titles span { font-size: 13px; }

    #kloak-screen-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
    overflow-y: auto;
    max-height: 50vh;
    padding: 4px;
    margin-top: 16px;
    }

    #kloak-screen-grid::-webkit-scrollbar { width: 8px; }
    #kloak-screen-grid::-webkit-scrollbar-thumb {
    background: #333333;
    border-radius: 4px;
    }

    .screen-item {
        cursor: pointer;
        text-align: center;
        background: #262626;
        padding: 12px;
        border-radius: 8px;
        transition: all 0.2s ease;
        border: 2px solid transparent;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    .screen-item:hover {
        background: #333333;
        border-color: #ffffff;
        transform: translateY(-2px);
    }

    .screen-item img {
        width: 100%;
        height: auto;
        border-radius: 4px;
        margin-bottom: 12px;
        display: block;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
    }

    .screen-item span {
        font-size: 13px;
        color: #949494;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
    }

    #kloak-screen-cancel {
    background-color: #262626;
    color: #E0E0E0;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    }
    #kloak-screen-cancel:hover { background-color: #333333; }
    `;
    document.head.appendChild(screenStyle);

    // Logic to Handle the Request
    ipcRenderer.on('show-screen-picker', (event, sources) => {
        const grid = document.getElementById('kloak-screen-grid');
        grid.innerHTML = ''; // Clear old items

        sources.forEach(source => {
            const item = document.createElement('div');
            item.className = 'screen-item';
            item.innerHTML = `
            <img src="${source.thumbnail}" />
            <span>${source.name}</span>
            `;

            // When clicked, send the ID back to main.js
            item.onclick = () => {
                document.getElementById('kloak-screen-picker').style.display = 'none';
                ipcRenderer.send('screen-share-selected', source.id);
            };

            grid.appendChild(item);
        });

        document.getElementById('kloak-screen-picker').style.display = 'flex';
    });

    // Cancel Button
    document.getElementById('kloak-screen-cancel').onclick = () => {
        document.getElementById('kloak-screen-picker').style.display = 'none';
        ipcRenderer.send('screen-share-selected', null); // Send null to cancel
    };

    // Permission overlay
    const permOverlay = document.createElement('div');
    permOverlay.id = 'kloak-perm-overlay';
    permOverlay.innerHTML = `
    <div class="kloak-perm-box">
    <div class="kloak-perm-header">
    <div class="kloak-perm-icon" id="kloak-perm-dynamic-icon">
    </div>
    <div class="kloak-perm-titles">
    <h3>Permission Request</h3>
    <span id="kloak-perm-subtitle">Kloak wants to use something</span>
    </div>
    </div>

    <p id="kloak-perm-desc">If you allow this, the app will be able to access your device's hardware or data. You can revoke this later in settings.</p>

    <div class="kloak-perm-buttons">
    <button id="kloak-perm-deny">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    Deny
    </button>
    <button id="kloak-perm-allow">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    Allow
    </button>
    </div>
    </div>
    `;
    document.body.appendChild(permOverlay);

    // Inject CSS
    const permStyle = document.createElement('style');
    permStyle.innerHTML = `
    #kloak-perm-overlay {
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999999;
    justify-content: center;
    align-items: center;
    font-family: inherit; /* Inherits Kloak's font */
    }

    /* Shake Animation */
    @keyframes gentleShake {
        0% { transform: scale(0.95); opacity: 0; }
        20% { transform: translateX(-6px) scale(1); opacity: 1; }
        40% { transform: translateX(5px); }
        60% { transform: translateX(-3px); }
        80% { transform: translateX(2px); }
        100% { transform: translateX(0); }
    }

    .kloak-perm-box {
        background-color: #161410; /* Dark gray */
        border: 1px solid #b45309; /* Yellow/Orange border */
        border-radius: 12px;
        padding: 24px;
        width: 440px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); /* Drop shadow */
        animation: gentleShake 0.4s ease-out forwards;
    }

    .kloak-perm-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
    }

    .kloak-perm-icon {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b; /* Yellow icon */
        padding: 10px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .kloak-perm-titles h3 {
        color: #f59e0b; /* Yellow Title */
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
    }

    .kloak-perm-titles span {
        color: #949494f;
        font-size: 13px;
    }

    #kloak-perm-desc {
    color: #949494;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 24px;
    }

    .kloak-perm-buttons {
        display: flex;
        gap: 12px;
    }

    /* Buttons */
    .kloak-perm-buttons button {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background-color: #262626;
        color: #EDEDED;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 12px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .kloak-perm-buttons button:hover {
        background-color: #333333;
    }

    #kloak-perm-allow:hover {
    border-color: #f59e0b;
    color: #f59e0b;
    }
    `;
    document.head.appendChild(permStyle);

    // Logic to show and handle responses
    let currentPermId = null;
    const overlayElement = document.getElementById('kloak-perm-overlay');
    // We add the iconContainer reference here!
    const iconContainer = document.getElementById('kloak-perm-dynamic-icon');

    ipcRenderer.on('show-custom-permission', (event, { id, permission }) => {
        currentPermId = id;

        // Setup default text and icon
        let friendlyName = permission;
        let svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

        // Swap based on permission type
        switch (permission) {
            case 'media':
            case 'audio_capture': // Catch variations
            case 'video_capture':
                friendlyName = 'Microphone & Camera';
                // Lucide Microphone Icon
                svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;
                break;
            case 'notifications':
                friendlyName = 'Notifications';
                // Lucide Bell Icon
                svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;
                break;
            case 'geolocation':
                friendlyName = 'Location';
                // Lucide Map Pin Icon
                svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
                break;
            default:
                // Fallback warning icon for unknown permissions
                friendlyName = permission;
                svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
                break;
        }

        // Inject text and icon
        document.getElementById('kloak-perm-subtitle').innerText = `Kloak wants to access your ${friendlyName}`;
        iconContainer.innerHTML = svgIcon;

        // Reset animation by forcing a reflow
        const box = document.querySelector('.kloak-perm-box');
        box.style.animation = 'none';
        box.offsetHeight;
        box.style.animation = null;

        overlayElement.style.display = 'flex';
    });

    // Button Click Listeners
    document.getElementById('kloak-perm-allow').addEventListener('click', () => {
        overlayElement.style.display = 'none';
        ipcRenderer.send('permission-response', { id: currentPermId, allowed: true });
    });

    document.getElementById('kloak-perm-deny').addEventListener('click', () => {
        overlayElement.style.display = 'none';
        ipcRenderer.send('permission-response', { id: currentPermId, allowed: false });
    });

    // --- External link UI

    // Create Modal
    const linkOverlay = document.createElement('div');
    linkOverlay.id = 'kloak-link-overlay';
    // Reuse CSS classes from permissions box
    linkOverlay.innerHTML = `
    <div class="kloak-perm-box">

    <div class="kloak-perm-header">
    <div class="kloak-perm-icon" style="color: #f59e0b; background: rgba(245, 158, 11, 0.15);">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
    </div>

    <div class="kloak-perm-titles">
    <h3 style="color: #949494;">External Link Warning</h3>
    <span style="color: #949494;">You are leaving Kloak</span>
    </div>
    </div>

    <p style="color: #949494; font-size: 14px; line-height: 1.5; margin-bottom: 12px;">
    External links may be dangerous. Are you sure you want to continue to:
    <br><br>
    <strong id="kloak-link-target" style="color: #E0E0E0; word-break: break-all; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; display: inline-block;"></strong>
    </p>

    <div style="margin-bottom: 24px; display: flex; align-items: center; gap: 8px;">
    <input type="checkbox" id="kloak-link-remember" style="accent-color: #f59e0b; width: 16px; height: 16px; cursor: pointer;">
    <label for="kloak-link-remember" style="color: #949494; font-size: 13px; cursor: pointer;">
    Do not show this again
    </label>
    </div>

    <div class="kloak-perm-buttons">
    <button id="kloak-link-cancel" style="color: #EDEDED;">Cancel</button>
    <button id="kloak-link-continue" style="color: #EDEDED;">Continue</button>
    </div>

    </div>
    `;
    document.body.appendChild(linkOverlay);

    // Hide/Show logic for the overlay
    linkOverlay.style.cssText = `
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999999;
    justify-content: center;
    align-items: center;
    font-family: inherit;
    `;

    // Logic to handle the incoming request
    let currentLinkUrl = '';

    ipcRenderer.on('show-link-warning', (event, url) => {
        currentLinkUrl = url;
        document.getElementById('kloak-link-target').innerText = url;

        // Reset the checkbox each time it opens
        document.getElementById('kloak-link-remember').checked = false;

        // Trigger shake animation
        const box = linkOverlay.querySelector('.kloak-perm-box');
        box.style.animation = 'none';
        box.offsetHeight; /* trigger reflow */
        box.style.animation = null;

        linkOverlay.style.display = 'flex';
    });

    // Button Handlers
    document.getElementById('kloak-link-cancel').addEventListener('click', () => {
        linkOverlay.style.display = 'none';
        ipcRenderer.send('link-warning-response', { url: currentLinkUrl, allowed: false, remember: false });
    });

    document.getElementById('kloak-link-continue').addEventListener('click', () => {
        const rememberMe = document.getElementById('kloak-link-remember').checked;
        linkOverlay.style.display = 'none';
        ipcRenderer.send('link-warning-response', { url: currentLinkUrl, allowed: true, remember: rememberMe });
    });


    // Update Hijacker UI

    // Inject Dedicated CSS for the Update Modal
    const updateStyle = document.createElement('style');
    updateStyle.innerHTML = `
    .kloak-update-box {
        background: linear-gradient(180deg, #1e1e1e 0%, #161616 100%);
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
    }

    /* The Green Success State */
    .kloak-update-success {
        border-color: #10b981;
        background: linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, #161616 100%);
        animation: gentleShake 0.4s ease-out forwards;
    }

    .kloak-update-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
    }

    .kloak-update-icon {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        padding: 10px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .kloak-update-titles h3 { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #10b981; }
    .kloak-update-titles span { font-size: 13px; color: #949494; }

    .kloak-update-buttons {
        display: flex;
        gap: 12px;
    }
    `;
    document.head.appendChild(updateStyle);

    // Update Modal Container
    const updateOverlay = document.createElement('div');
    updateOverlay.id = 'kloak-update-overlay';

    // Default Loading State
    const loadingHTML = `
    <div class="kloak-update-box" style="width: 440px; text-align: center;">
    <h3 style="color: #E0E0E0; margin-bottom: 8px;">Checking GitHub...</h3>
    <p style="color: #949494; font-size: 14px; margin: 0;">Looking for the latest Unofficial Kloak Desktop Client release.</p>
    </div>
    `;

    updateOverlay.innerHTML = loadingHTML;
    updateOverlay.style.cssText = `
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85); z-index: 9999999;
    justify-content: center; align-items: center; font-family: inherit;
    `;

    document.body.appendChild(updateOverlay);

    let updateDownloadUrl = '';

    // Event Delegation for buttons
    updateOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'kloak-update-ignore' || e.target.id === 'kloak-update-close') {
            updateOverlay.style.display = 'none';
        } else if (e.target.id === 'kloak-update-download') {
            updateOverlay.style.display = 'none';
            ipcRenderer.send('open-external-url', updateDownloadUrl);
        }
    });

    // Capture-Phase Click Hijacker
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target && target.textContent && /check for update/i.test(target.textContent)) {
            e.preventDefault();
            e.stopPropagation();

            // Reset to the neutral loading state
            updateOverlay.innerHTML = loadingHTML;
            updateOverlay.style.display = 'flex';

            ipcRenderer.send('check-custom-update');
        }
    }, true);

    // Listen for the result from main.js
    ipcRenderer.on('update-status', (event, data) => {
        if (data.available) {
            updateDownloadUrl = data.url;

            // Success State (Injects the .kloak-update-success class)
            updateOverlay.innerHTML = `
            <div class="kloak-update-box kloak-update-success" style="width: 440px;">
            <div class="kloak-update-header">
            <div class="kloak-update-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            </div>
            <div class="kloak-update-titles">
            <h3>Client Update Available</h3>
            <span>Version ${data.version} is ready</span>
            </div>
            </div>
            <p style="color: #949494; font-size: 14px; margin-bottom: 24px; line-height: 1.5;">
            A newer version of the Unofficial Kloak Desktop Client is available on GitHub. Would you like to download it now?
            </p>
            <div class="kloak-update-buttons">
            <button id="kloak-update-ignore" style="padding: 10px; background: #262626; color: #E0E0E0; border: none; border-radius: 6px; cursor: pointer; flex: 1; transition: background 0.2s;">Later</button>
            <button id="kloak-update-download" style="padding: 10px; background: transparent; border: 1px solid #10b981; color: #10b981; border-radius: 6px; cursor: pointer; flex: 1; transition: background 0.2s;">Download</button>
            </div>
            </div>
            `;

            // Slight hover effects for the new buttons
            document.getElementById('kloak-update-ignore').onmouseover = function() { this.style.background = '#333333'; }
            document.getElementById('kloak-update-ignore').onmouseout = function() { this.style.background = '#262626'; }
            document.getElementById('kloak-update-download').onmouseover = function() { this.style.background = 'rgba(16, 185, 129, 0.1)'; }
            document.getElementById('kloak-update-download').onmouseout = function() { this.style.background = 'transparent'; }

        } else {
            // "Up to Date" State (No success class added)
            updateOverlay.innerHTML = `
            <div class="kloak-update-box" style="width: 440px; text-align: center;">
            <div style="color: #E0E0E0; margin-bottom: 16px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto;">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            </div>
            <h3 style="color: #E0E0E0; margin: 0 0 8px 0;">You're up to date!</h3>
            <p style="color: #949494; font-size: 14px; margin-bottom: 24px;">You are running the latest version of the Unofficial Kloak Client.</p>
            <div class="kloak-update-buttons" style="justify-content: center;">
            <button id="kloak-update-close" style="padding: 10px 30px; background: #262626; color: #E0E0E0; border: none; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
            </div>
            `;

            document.getElementById('kloak-update-close').onmouseover = function() { this.style.background = '#333333'; }
            document.getElementById('kloak-update-close').onmouseout = function() { this.style.background = '#262626'; }
        }
    });

    // Leave Server Modal

    const leaveOverlay = document.createElement('div');
    leaveOverlay.id = 'kloak-leave-overlay';

    // Reuse kloak-update-box but inject red
    leaveOverlay.innerHTML = `
    <div class="kloak-update-box" style="width: 440px; border: 1px solid #ef4444; background: linear-gradient(rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.08)), #0f0f0f;">
    <div class="kloak-update-header">
    <div class="kloak-update-icon" style="color: #ef4444; background: rgba(239, 68, 68, 0.15); padding: 10px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line>
    </svg>
    </div>
    <div class="kloak-update-titles" style="margin-left: 16px;">
    <h3 style="color: #ef4444; margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">Leave Server</h3>
    <span style="color: #949494; font-size: 13px;">Destructive Action</span>
    </div>
    </div>
    <p style="color: #E0E0E0; font-size: 14px; margin-bottom: 24px; margin-top: 16px; line-height: 1.5;">
    Are you sure you want to leave this server? You will need a new invite link to rejoin.
    </p>
    <div class="kloak-update-buttons" style="display: flex; gap: 12px;">
    <button id="kloak-leave-cancel" style="padding: 10px; background: #262626; color: #E0E0E0; border: none; border-radius: 6px; cursor: pointer; flex: 1; transition: background 0.2s;">Cancel</button>
    <button id="kloak-leave-confirm" style="padding: 10px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; flex: 1; transition: background 0.2s; font-weight: 600;">Leave Server</button>
    </div>
    </div>
    `;

    leaveOverlay.style.cssText = `
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85); z-index: 9999999;
    justify-content: center; align-items: center; font-family: inherit;
    `;

    document.body.appendChild(leaveOverlay);

    let pendingLeaveTarget = null;
    const originalConfirm = window.confirm;

    // Hover Effects
    document.getElementById('kloak-leave-cancel').onmouseover = function() { this.style.background = '#333333'; }
    document.getElementById('kloak-leave-cancel').onmouseout = function() { this.style.background = '#262626'; }
    document.getElementById('kloak-leave-confirm').onmouseover = function() { this.style.background = '#dc2626'; } // Darker red on hover
    document.getElementById('kloak-leave-confirm').onmouseout = function() { this.style.background = '#ef4444'; }

    // Button Logic
    document.getElementById('kloak-leave-cancel').onclick = () => {
        leaveOverlay.style.display = 'none';
        pendingLeaveTarget = null;
    };

    // Close on background click
    leaveOverlay.onclick = (e) => {
        if (e.target === leaveOverlay) {
            leaveOverlay.style.display = 'none';
            pendingLeaveTarget = null;
        }
    };

    document.getElementById('kloak-leave-confirm').onclick = () => {
        leaveOverlay.style.display = 'none';

        if (pendingLeaveTarget) {
            // Temporarily overwrite window.confirm to bypass the OS popup
            window.confirm = () => true;

            // Allow specific target to bypass the capture phase blocker
            pendingLeaveTarget.dataset.kloakBypass = "true";

            // Programmatically click the real button
            pendingLeaveTarget.click();

            // Clean up immediately after React processes it
            setTimeout(() => {
                window.confirm = originalConfirm;
                if (pendingLeaveTarget) pendingLeaveTarget.dataset.kloakBypass = "false";
                pendingLeaveTarget = null;
            }, 50);
        }
    };

    // Capture-Phase
    document.addEventListener('click', (e) => {
        const target = e.target.closest('div[role="menuitem"]');

        // Look for the exact red "Leave Server" menu item
        if (target && target.classList.contains('text-destructive') && target.textContent.includes('Leave Server')) {

            // If we've already approved it from our red modal, let the click pass through!
            if (target.dataset.kloakBypass === "true") {
                return;
            }

            // Otherwise, KILL the click before React sees it
            e.preventDefault();
            e.stopPropagation();

            // Save the button so we can re-click it later
            pendingLeaveTarget = target;

            // Show our custom red modal with the shake animation
            const box = leaveOverlay.querySelector('.kloak-update-box');
            box.style.animation = 'none';
            box.offsetHeight;
            box.style.animation = 'gentleShake 0.4s ease-out forwards';

            leaveOverlay.style.display = 'flex';
        }
    }, true);


});
