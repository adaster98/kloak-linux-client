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
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
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
        color: #9ca3af;
        font-size: 13px;
    }

    #kloak-perm-desc {
    color: #d1d5db;
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
        color: #f3f4f6;
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
    <div class="kloak-perm-box" style="border-color: #f59e0b;"> <div class="kloak-perm-header">
    <div class="kloak-perm-icon" style="color: #f59e0b; background: rgba(239, 68, 68, 0.15);">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </div>
    <div class="kloak-perm-titles">
    <h3 style="color: #f59e0b;">External Link Warning</h3>
    <span>You are leaving Kloak</span>
    </div>
    </div>

    <p style="color: #d1d5db; font-size: 14px; line-height: 1.5; margin-bottom: 12px;">
    External links may be dangerous. Are you sure you want to continue to:
    <br><br>
    <strong id="kloak-link-target" style="color: #f59e0b; word-break: break-all; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; display: inline-block;"></strong>
    </p>

    <div style="margin-bottom: 24px; display: flex; align-items: center; gap: 8px;">
    <input type="checkbox" id="kloak-link-remember" style="accent-color: #f59e0b; width: 16px; height: 16px; cursor: pointer;">
    <label for="kloak-link-remember" style="color: #9ca3af; font-size: 13px; cursor: pointer;">Do not show this again</label>
    </div>

    <div class="kloak-perm-buttons">
    <button id="kloak-link-cancel">Cancel</button>
    <button id="kloak-link-continue" style="color: ##f59e0b;">Continue</button>
    </div>
    </div>
    `;
    document.body.appendChild(linkOverlay);

    // Hide/Show logic for the overlay
    linkOverlay.style.cssText = `
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
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


});
