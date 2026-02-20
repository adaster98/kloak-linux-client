const { contextBridge, ipcRenderer } = require('electron');

// Expose the API
contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-min'),
    maximize: () => ipcRenderer.send('window-max'),
    close: () => ipcRenderer.send('window-close'),

    // Folder helper
    openAddonsFolder: (subPath) => ipcRenderer.send('open-addons-folder', subPath),

    // Global States
    getAddonStates: () => ipcRenderer.invoke('get-addon-states'),
    saveAddonState: (data) => ipcRenderer.send('save-addon-state', data),

    // Specific Addon Settings
    getAddonConfig: (addonId) => ipcRenderer.invoke('get-addon-config', addonId),
    saveAddonConfig: (data) => ipcRenderer.send('save-addon-config', data),

    // Theme Engine Helpers
    getThemeFiles: () => ipcRenderer.invoke('get-theme-files')

});

window.addEventListener('DOMContentLoaded', () => {
    console.log("Kloak Client: Preload script loaded.");

    // Global css stuff
    const globalStyle = document.createElement('style');
    globalStyle.innerHTML = `
    /* Animations */
    @keyframes gentleShake {
        0% { transform: scale(0.95); opacity: 0; }
        20% { transform: translateX(-6px) scale(1); opacity: 1; }
        40% { transform: translateX(5px); }
        60% { transform: translateX(-3px); }
        80% { transform: translateX(2px); }
        100% { transform: translateX(0); }
    }

    /* The Dark Background Overlay */
    .kloak-overlay {
        display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85); z-index: 9999999;
        justify-content: center; align-items: center; font-family: inherit;
        border-radius: 20px; overflow: hidden;
        pointer-events: auto !important;
    }

    /* The Main Modal Box */
    .kloak-modal {
        background: #0f0f0f;
        border: 1px solid #2a2a2a;
        border-radius: 12px; padding: 24px; width: 440px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
        display: flex; flex-direction: column;
    }
    .kloak-modal.wide { width: 700px; }
    .kloak-modal.center { text-align: center; }

    /* Thematic Overrides (Flat tints + Colored borders) */
    .kloak-theme-yellow { border-color: rgba(245, 158, 11, 0.5); background: linear-gradient(rgba(245, 158, 11, 0.01), rgba(245, 158, 11, 0.02)), #0f0f0f !important; }
    .kloak-theme-green { border-color: rgba(16, 185, 129, 0.5); background: linear-gradient(rgba(16, 185, 129, 0.01), rgba(16, 185, 129, 0.02)), #0f0f0f !important; }
    .kloak-theme-red { border-color: rgba(239, 68, 68, 0.5); background: linear-gradient(rgba(239, 68, 68, 0.01), rgba(239, 68, 68, 0.02)), #0f0f0f !important; }

    /* Headers & Typography */
    .kloak-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .kloak-icon { padding: 10px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #E0E0E0; background: #262626; }
    .kloak-theme-yellow .kloak-icon { color: #f59e0b; background: rgba(245, 158, 11, 0.15); }
    .kloak-theme-green .kloak-icon { color: #10b981; background: rgba(16, 185, 129, 0.15); }
    .kloak-theme-red .kloak-icon { color: #ef4444; background: rgba(239, 68, 68, 0.15); }

    .kloak-titles { display: flex; flex-direction: column; text-align: left; }
    .kloak-titles h3 { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #E0E0E0; }
    .kloak-theme-yellow .kloak-titles h3 { color: #f59e0b; }
    .kloak-theme-green .kloak-titles h3 { color: #10b981; }
    .kloak-theme-red .kloak-titles h3 { color: #ef4444; }
    .kloak-titles span { font-size: 13px; color: #949494; }
    .kloak-desc { color: #949494; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0; }

    /* Buttons */
    .kloak-btn-group { display: flex; gap: 12px; }
    .kloak-btn-group.center { justify-content: center; }
    .kloak-btn {
        flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
        padding: 10px; border-radius: 6px; font-size: 14px; font-weight: 500;
        cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
    }
    .kloak-btn.auto-width { flex: 0 1 auto; padding: 10px 24px; }

    .kloak-btn-secondary { background: #262626; color: #E0E0E0; }
    .kloak-btn-secondary:hover { background: #333333; }

    .kloak-btn-outline-green { background: transparent; border-color: #262626; color: #E0E0E0; }
    .kloak-btn-outline-green:hover { border-color: rgba(16, 185, 129, 0.5); color: #10b981;  }

    .kloak-btn-outline-yellow { background: transparent; border-color: #262626; color: #E0E0E0; }
    .kloak-btn-outline-yellow:hover { border-color: rgba(245, 158, 11, 0.5); color: #f59e0b; }

    .kloak-btn-danger { background: transparent; border-color: #262626; color: #E0E0E0; }
    .kloak-btn-danger:hover { border-color: rgba(239, 68, 68, 0.5); color: #ef4444;}

    /* Screenshare Grid */
    .kloak-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; overflow-y: auto; max-height: 50vh; padding: 4px; margin-top: 16px; }
    .kloak-grid::-webkit-scrollbar { width: 8px; }
    .kloak-grid::-webkit-scrollbar-thumb { background: #333333; border-radius: 4px; }
    .screen-item { cursor: pointer; text-align: center; background: #262626; padding: 12px; border-radius: 8px; transition: all 0.2s ease; border: 2px solid transparent; display: flex; flex-direction: column; justify-content: space-between; }
    .screen-item:hover { background: #333333; border-color: #ffffff; transform: translateY(-2px); }
    .screen-item img { width: 100%; height: auto; border-radius: 4px; margin-bottom: 12px; display: block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); }
    .screen-item span { font-size: 13px; color: #949494; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
    `;
    document.head.appendChild(globalStyle);

    // Window controls and theme sync
    setInterval(() => {
        const topBar = document.querySelector('.h-9.w-full');
        if (!topBar) return;

        const wireButton = (btn, actionName) => {
            if (btn && !btn.hasAttribute('data-electron-wired')) {
                btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); ipcRenderer.send(actionName); });
                btn.setAttribute('data-electron-wired', 'true');
                btn.style.webkitAppRegion = "no-drag";
                btn.style.cursor = "pointer";
            }
        };

        wireButton(topBar.querySelector('button[aria-label="Minimize"]'), 'window-min');
        wireButton(topBar.querySelector('button[aria-label="Maximize"]'), 'window-max');
        wireButton(topBar.querySelector('button[aria-label="Close"]'), 'window-close');
    }, 1000);

    document.addEventListener('dragover', (event) => event.preventDefault());
    document.addEventListener('drop', (event) => { if (event.dataTransfer && event.dataTransfer.files.length > 0) {} });

    let lastThemeColor = '';
    const syncThemeColor = () => {
        const topBar = document.querySelector('.h-9.w-full');
        const appRoot = document.getElementById('root') || document.querySelector('#app');
        if (topBar && appRoot) {
            const themeColor = window.getComputedStyle(topBar).backgroundColor;
            if (themeColor !== lastThemeColor) {
                appRoot.style.setProperty('background-color', themeColor, 'important');
                lastThemeColor = themeColor;
            }
        }
    };
    setTimeout(syncThemeColor, 500);
    new MutationObserver(syncThemeColor).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    // Animation trigger
    const triggerShake = (modalBox) => {
        modalBox.style.animation = 'none';
        modalBox.offsetHeight; // force reflow
        modalBox.style.animation = 'gentleShake 0.4s ease-out forwards';
    };


    // Screenshare picker
    const screenModal = document.createElement('div');
    screenModal.className = 'kloak-overlay';
    screenModal.innerHTML = `
    <div class="kloak-modal wide">
    <div class="kloak-header">
    <div class="kloak-icon">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
    </div>
    <div class="kloak-titles"><h3>Share your screen</h3><span>Choose a screen or window to share</span></div>
    </div>
    <div id="kloak-screen-grid" class="kloak-grid"></div>
    <div class="kloak-btn-group" style="justify-content: flex-end; margin-top: 16px;">
    <button id="kloak-screen-cancel" class="kloak-btn kloak-btn-secondary auto-width">Cancel</button>
    </div>
    </div>
    `;
    document.body.appendChild(screenModal);

    ipcRenderer.on('show-screen-picker', (event, sources) => {
        const grid = document.getElementById('kloak-screen-grid');
        grid.innerHTML = '';
        sources.forEach(source => {
            const item = document.createElement('div');
            item.className = 'screen-item';
            item.innerHTML = `<img src="${source.thumbnail}" /><span>${source.name}</span>`;
            item.onclick = () => { screenModal.style.display = 'none'; ipcRenderer.send('screen-share-selected', source.id); };
            grid.appendChild(item);
        });
        screenModal.style.display = 'flex';
    });
    document.getElementById('kloak-screen-cancel').onclick = () => { screenModal.style.display = 'none'; ipcRenderer.send('screen-share-selected', null); };


    // Hardware perms popup
    const permOverlay = document.createElement('div');
    permOverlay.className = 'kloak-overlay';
    permOverlay.innerHTML = `
    <div class="kloak-modal kloak-theme-yellow">
    <div class="kloak-header">
    <div class="kloak-icon" id="kloak-perm-dynamic-icon"></div>
    <div class="kloak-titles"><h3>Permission Request</h3><span id="kloak-perm-subtitle">Kloak wants to use something</span></div>
    </div>
    <p class="kloak-desc">If you allow this, the app will be able to access your device's hardware or data. You can revoke this later in settings.</p>
    <div class="kloak-btn-group">
    <button id="kloak-perm-deny" class="kloak-btn kloak-btn-secondary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> Deny</button>
    <button id="kloak-perm-allow" class="kloak-btn kloak-btn-outline-yellow"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Allow</button>
    </div>
    </div>
    `;
    document.body.appendChild(permOverlay);

    let currentPermId = null;
    ipcRenderer.on('show-custom-permission', (event, { id, permission }) => {
        currentPermId = id;
        let friendlyName = permission;
        let svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

        if (['media', 'audio_capture', 'video_capture'].includes(permission)) {
            friendlyName = 'Microphone & Camera';
            svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;
        } else if (permission === 'notifications') {
            friendlyName = 'Notifications';
            svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;
        } else if (permission === 'geolocation') {
            friendlyName = 'Location';
            svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
        }

        document.getElementById('kloak-perm-subtitle').innerText = `Kloak wants to access your ${friendlyName}`;
        document.getElementById('kloak-perm-dynamic-icon').innerHTML = svgIcon;
        permOverlay.style.display = 'flex';
        triggerShake(permOverlay.querySelector('.kloak-modal'));
    });
    document.getElementById('kloak-perm-allow').onclick = () => { permOverlay.style.display = 'none'; ipcRenderer.send('permission-response', { id: currentPermId, allowed: true }); };
    document.getElementById('kloak-perm-deny').onclick = () => { permOverlay.style.display = 'none'; ipcRenderer.send('permission-response', { id: currentPermId, allowed: false }); };


    // External link popup
    const linkOverlay = document.createElement('div');
    linkOverlay.className = 'kloak-overlay';
    linkOverlay.innerHTML = `
    <div class="kloak-modal kloak-theme-yellow">
    <div class="kloak-header">
    <div class="kloak-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
    <div class="kloak-titles"><h3>External Link Warning</h3><span>You are leaving Kloak</span></div>
    </div>
    <p class="kloak-desc">External links may be dangerous. Are you sure you want to continue to:<br><br><strong id="kloak-link-target" style="color: #E0E0E0; word-break: break-all; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; display: inline-block;"></strong></p>
    <div style="margin-bottom: 24px; display: flex; align-items: center; gap: 8px;">
    <input type="checkbox" id="kloak-link-remember" style="accent-color: #f59e0b; width: 16px; height: 16px; cursor: pointer;">
    <label for="kloak-link-remember" style="color: #949494; font-size: 13px; cursor: pointer;">Do not show this again</label>
    </div>
    <div class="kloak-btn-group">
    <button id="kloak-link-cancel" class="kloak-btn kloak-btn-secondary">Cancel</button>
    <button id="kloak-link-continue" class="kloak-btn kloak-btn-outline-yellow">Continue</button>
    </div>
    </div>
    `;
    document.body.appendChild(linkOverlay);

    let currentLinkUrl = '';
    ipcRenderer.on('show-link-warning', (event, url) => {
        currentLinkUrl = url;
        document.getElementById('kloak-link-target').innerText = url;
        document.getElementById('kloak-link-remember').checked = false;
        linkOverlay.style.display = 'flex';
        triggerShake(linkOverlay.querySelector('.kloak-modal'));
    });
    document.getElementById('kloak-link-cancel').onclick = () => { linkOverlay.style.display = 'none'; ipcRenderer.send('link-warning-response', { url: currentLinkUrl, allowed: false, remember: false }); };
    document.getElementById('kloak-link-continue').onclick = () => { linkOverlay.style.display = 'none'; ipcRenderer.send('link-warning-response', { url: currentLinkUrl, allowed: true, remember: document.getElementById('kloak-link-remember').checked }); };


    // Update popup
    const updateOverlay = document.createElement('div');
    updateOverlay.className = 'kloak-overlay';
    const updateLoadingHTML = `
    <div class="kloak-modal center">
    <h3 style="color: #E0E0E0; margin-bottom: 8px;">Checking GitHub...</h3>
    <p class="kloak-desc" style="margin:0;">Looking for the latest Desktop Client release.</p>
    </div>
    `;
    updateOverlay.innerHTML = updateLoadingHTML;
    document.body.appendChild(updateOverlay);

    let updateDownloadUrl = '';
    updateOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'kloak-update-ignore' || e.target.id === 'kloak-update-close') { updateOverlay.style.display = 'none'; }
        else if (e.target.id === 'kloak-update-download') { updateOverlay.style.display = 'none'; ipcRenderer.send('open-external-url', updateDownloadUrl); }
    });

    document.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target && target.textContent && /check for update/i.test(target.textContent)) {
            e.preventDefault(); e.stopPropagation();
            updateOverlay.innerHTML = updateLoadingHTML;
            updateOverlay.style.display = 'flex';
            ipcRenderer.send('check-custom-update');
        }
    }, true);

    ipcRenderer.on('update-status', (event, data) => {
        if (data.available) {
            updateDownloadUrl = data.url;
            updateOverlay.innerHTML = `
            <div class="kloak-modal kloak-theme-green">
            <div class="kloak-header">
            <div class="kloak-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg></div>
            <div class="kloak-titles"><h3>Client Update Available</h3><span>Version ${data.version} is ready</span></div>
            </div>
            <p class="kloak-desc">A newer version of the Unofficial Kloak Desktop Client is available on GitHub. Would you like to download it now?</p>
            <div class="kloak-btn-group">
            <button id="kloak-update-ignore" class="kloak-btn kloak-btn-secondary">Later</button>
            <button id="kloak-update-download" class="kloak-btn kloak-btn-outline-green">Download</button>
            </div>
            </div>
            `;
        } else {
            updateOverlay.innerHTML = `
            <div class="kloak-modal center">
            <div style="color: #E0E0E0; margin-bottom: 16px;"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
            <h3 style="color: #E0E0E0; margin: 0 0 8px 0;">You're up to date!</h3>
            <p class="kloak-desc">You are running the latest version.</p>
            <div class="kloak-btn-group center">
            <button id="kloak-update-close" class="kloak-btn kloak-btn-secondary auto-width">Close</button>
            </div>
            </div>
            `;
        }
    });


    // Leave server popup
    const leaveOverlay = document.createElement('div');
    leaveOverlay.className = 'kloak-overlay';
    leaveOverlay.innerHTML = `
    <div class="kloak-modal kloak-theme-red">
    <div class="kloak-header">
    <div class="kloak-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line></svg></div>
    <div class="kloak-titles"><h3>Leave Server</h3><span>Destructive Action</span></div>
    </div>
    <p class="kloak-desc">Are you sure you want to leave this server? You will need a new invite link to rejoin.</p>
    <div class="kloak-btn-group">
    <button id="kloak-leave-cancel" class="kloak-btn kloak-btn-secondary">Cancel</button>
    <button id="kloak-leave-confirm" class="kloak-btn kloak-btn-danger">Leave Server</button>
    </div>
    </div>
    `;
    document.body.appendChild(leaveOverlay);

    let pendingLeaveTarget = null;
    const originalConfirm = window.confirm;

    document.getElementById('kloak-leave-cancel').onclick = () => { leaveOverlay.style.display = 'none'; pendingLeaveTarget = null; };
    leaveOverlay.onclick = (e) => { if (e.target === leaveOverlay) { leaveOverlay.style.display = 'none'; pendingLeaveTarget = null; } };

    document.getElementById('kloak-leave-confirm').onclick = () => {
        leaveOverlay.style.display = 'none';
        if (pendingLeaveTarget) {
            window.confirm = () => true;
            pendingLeaveTarget.dataset.kloakBypass = "true";
            pendingLeaveTarget.click();
            setTimeout(() => {
                window.confirm = originalConfirm;
                if (pendingLeaveTarget) pendingLeaveTarget.dataset.kloakBypass = "false";
                pendingLeaveTarget = null;
            }, 50);
        }
    };

    document.addEventListener('click', (e) => {
        const target = e.target.closest('div[role="menuitem"]');
        if (target && target.classList.contains('text-destructive') && target.textContent.includes('Leave Server')) {
            if (target.dataset.kloakBypass === "true") return;

            // Kill the original click
            e.preventDefault();
            e.stopPropagation();

            pendingLeaveTarget = target;
            leaveOverlay.style.display = 'flex';

            // ghost press escape to get out of submenu focus trap... gotta love jank
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

            // wait out the focus trap
            setTimeout(() => {
                const cancelBtn = document.getElementById('kloak-leave-cancel');
                if (cancelBtn) cancelBtn.focus();
            }, 50);
        }
    }, true);

});

