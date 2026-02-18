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

    // MutationObserver to watch for changes in the page
    const observer = new MutationObserver((mutations) => {
        // Target the top bar
        const topBar = document.querySelector('.h-9.w-full');

        if (topBar) {
            // Find the buttons using Kloaks Accessibility Labels
            const minBtn = topBar.querySelector('button[aria-label="Minimize"]');
            const maxBtn = topBar.querySelector('button[aria-label="Maximize"]');
            const closeBtn = topBar.querySelector('button[aria-label="Close"]');

            // Helper function to wire up a button safely
            const wireButton = (btn, actionName) => {
                // Only attach if we haven't already (check for our custom flag)
                if (btn && !btn.hasAttribute('data-electron-wired')) {
                    console.log(`Kloak Client: Found ${actionName} button. Wiring it up...`);

                    btn.addEventListener('click', (e) => {
                        // Stop the website from doing whatever it usually does
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`Kloak Client: Clicked ${actionName}`);
                        ipcRenderer.send(actionName);
                    });

                    btn.setAttribute('data-electron-wired', 'true');

                    // Force the button to be clickable (override CSS)
                    btn.style.webkitAppRegion = "no-drag";
                    btn.style.cursor = "pointer";
                }
            };

            wireButton(minBtn, 'window-min');
            wireButton(maxBtn, 'window-max');
            wireButton(closeBtn, 'window-close');
        }
    });

    // Start watching the body for changes (childList = added/removed elements)
    observer.observe(document.body, { childList: true, subtree: true });

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
    const syncThemeColor = () => {
        // Find the top bar (Source of Truth)
        const topBar = document.querySelector('.h-9.w-full');
        // Find the main app container (Destination)
        const appRoot = document.getElementById('root') || document.querySelector('#app');

        if (topBar && appRoot) {
            // Get the computed color
            const themeColor = window.getComputedStyle(topBar).backgroundColor;

            // Apply it to the background with !important to override main.js
            appRoot.style.setProperty('background-color', themeColor, 'important');

            // console.log(`Theme synced: ${themeColor}`);
        }
    };

    // Run it immediately on load
    setTimeout(syncThemeColor, 500);

    // Watch for Theme Changes
    const themeObserver = new MutationObserver(() => {
        syncThemeColor();
    });

    // Observe the <html> tag for attribute changes (class, data-theme, etc.)
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style']
    });

    // Screenshare picker UI

    // Create the Modal HTML
    const screenModal = document.createElement('div');
    screenModal.id = 'kloak-screen-picker';
    screenModal.innerHTML = `
    <div class="kloak-screen-box">
    <h3>Share your screen</h3>
    <p>Choose a screen or window to share:</p>
    <div id="kloak-screen-grid"></div> <button id="kloak-screen-cancel">Cancel</button>
    </div>
    `;
    document.body.appendChild(screenModal);

    // Inject CSS for the Grid
    const screenStyle = document.createElement('style');
    screenStyle.innerHTML = `
    #kloak-screen-picker {
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    z-index: 9999999; /* Higher than everything */
    justify-content: center;
    align-items: center;
    font-family: sans-serif;
    }
    .kloak-screen-box {
        background: #1e1e1e;
        color: white;
        padding: 20px;
        border-radius: 12px;
        width: 600px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        border: 1px solid #333;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }
    .kloak-screen-box h3 { margin: 0 0 10px 0; }
    .kloak-screen-box p { color: #aaa; margin-bottom: 15px; }

    #kloak-screen-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 15px;
    overflow-y: auto;
    padding-right: 5px;
    margin-bottom: 15px;
    }

    /* Each Source Item */
    .screen-item {
        cursor: pointer;
        text-align: center;
        background: #2a2a2a;
        padding: 10px;
        border-radius: 8px;
        transition: background 0.2s;
        border: 2px solid transparent;
    }
    .screen-item:hover {
        background: #333;
        border-color: #3b82f6; /* Blue highlight */
    }
    .screen-item img {
        width: 100%;
        height: auto;
        border-radius: 4px;
        margin-bottom: 8px;
        display: block;
    }
    .screen-item span {
        font-size: 12px;
        color: #ddd;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    #kloak-screen-cancel {
    padding: 10px;
    background: #444;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    align-self: flex-end;
    }
    #kloak-screen-cancel:hover { background: #555; }
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

});
