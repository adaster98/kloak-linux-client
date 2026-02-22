(() => {
    const ADDON_ID = 'theme-injector';
    const STYLE_TAG_ID = 'kloak-custom-theme-style';

    let isEnabled = false;
    let currentConfig = { selectedTheme: '' };

    async function loadConfig() {
        try {
            if (window.electronAPI && window.electronAPI.getAddonConfig) {
                const data = await window.electronAPI.getAddonConfig(ADDON_ID);
                if (data && typeof data.selectedTheme === 'string') {
                    currentConfig.selectedTheme = data.selectedTheme;
                }
            }
        } catch (e) { console.error("[Theme Engine] Failed to load config", e); }
    }

    async function getThemes() {
        try {
            if (!window.electronAPI || !window.electronAPI.getThemeFiles) return [];

            const files = await window.electronAPI.getThemeFiles();
            return Array.isArray(files) ? files : [];

        } catch (e) {
            console.error("[Theme Engine] Backend failed to read themes folder:", e);
            return [];
        }
    }

    async function applySelectedTheme() {
        removeCSS();
        if (!isEnabled || !currentConfig.selectedTheme) return;

        const themes = await getThemes();
        const activeTheme = themes.find(t => t.filename === currentConfig.selectedTheme);

        if (activeTheme) {
            let styleTag = document.createElement('style');
            styleTag.id = STYLE_TAG_ID;
            styleTag.textContent = activeTheme.content;
            document.head.appendChild(styleTag);
        }
    }

    function removeCSS() {
        const styleTag = document.getElementById(STYLE_TAG_ID);
        if (styleTag) styleTag.remove();
    }

    window.KloakAddons.registerAddon({
        id: ADDON_ID,
        name: 'Theme Injector',
        description: 'Select a custom CSS theme from your themes folder to completely reskin the client.',

        onEnable: async () => {
            isEnabled = true;
            await loadConfig();
            await applySelectedTheme();
        },

        onDisable: () => {
            isEnabled = false;
            removeCSS();
        },

        renderSettings: async (container) => {
            container.innerHTML = `<p style="color: #949494; text-align: center;">Loading themes...</p>`;

            await loadConfig();
            const themes = await getThemes();

            let html = `
            <div style="color: #E0E0E0; display: flex; flex-direction: column; gap: 16px;">
            <p style="margin: 0; color: #a1a1aa; font-size: 13px;">Drop <code>.css</code> files into the themes folder to install them.</p>

            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; padding-right: 4px;">
            <label class="theme-option" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #18181b; border: 1px solid ${currentConfig.selectedTheme === '' ? '#10b981' : '#27272a'}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
            <input type="radio" name="theme-select" value="" ${currentConfig.selectedTheme === '' ? 'checked' : ''} style="accent-color: #10b981;">
            <div>
            <div style="font-weight: 600; font-size: 14px; color: #E0E0E0;">None (Default Kloak)</div>
            </div>
            </label>
            `;

            if (themes.length > 0) {
                themes.forEach(theme => {
                    const isSelected = currentConfig.selectedTheme === theme.filename;
                    html += `
                    <label class="theme-option" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #18181b; border: 1px solid ${isSelected ? '#10b981' : '#27272a'}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                    <input type="radio" name="theme-select" value="${theme.filename}" ${isSelected ? 'checked' : ''} style="accent-color: #10b981;">
                    <div>
                    <div style="font-weight: 600; font-size: 14px; color: #E0E0E0; text-transform: capitalize;">${theme.name}</div>
                    <div style="font-size: 11px; color: #71717a;">${theme.filename}</div>
                    </div>
                    </label>
                    `;
                });
            } else {
                html += `<p style="color: #ef4444; font-size: 12px; text-align: center;">No themes found in folder!</p>`;
            }

            html += `
            </div>

            <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px; padding-top: 16px; border-top: 1px solid #27272a;">
            <button id="ti-save-btn" style="background: #10b981; color: #000; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">Apply Theme</button>
            <span id="ti-saved-msg" style="color: #10b981; font-size: 13px; font-weight: 500; opacity: 0; transition: opacity 0.2s;">✓ Applied</span>
            <button id="ti-folder-btn" style="margin-left: auto; background: #262626; color: #E0E0E0; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; transition: background 0.2s;">Open Themes Folder</button>
            </div>
            </div>
            `;

            container.innerHTML = html;

            // Wire up the Open Folder button
            const folderBtn = container.querySelector('#ti-folder-btn');
            if (folderBtn) {
                folderBtn.addEventListener('mouseenter', () => folderBtn.style.background = '#3f3f46');
                folderBtn.addEventListener('mouseleave', () => folderBtn.style.background = '#262626');
                folderBtn.addEventListener('click', () => {
                    // Use the universally working Addon folder pipe, but target the themes folder!
                    if (window.electronAPI && window.electronAPI.openAddonsFolder) {
                        window.electronAPI.openAddonsFolder('theme-injector/themes');
                    }
                });
            }

            // Wire up the Save button
            const saveBtn = container.querySelector('#ti-save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    const selectedRadio = container.querySelector('input[name="theme-select"]:checked');
                    currentConfig.selectedTheme = selectedRadio ? selectedRadio.value : '';

                    if (window.electronAPI && window.electronAPI.saveAddonConfig) {
                        window.electronAPI.saveAddonConfig({ addonId: ADDON_ID, data: currentConfig });

                        const labels = container.querySelectorAll('.theme-option');
                        labels.forEach(l => l.style.borderColor = '#27272a');
                        if (selectedRadio) selectedRadio.closest('.theme-option').style.borderColor = '#10b981';

                        if (isEnabled) await applySelectedTheme();

                        const msg = container.querySelector('#ti-saved-msg');
                        msg.style.opacity = '1';
                        setTimeout(() => msg.style.opacity = '0', 2000);
                    }
                });
            }
        }
    });
})();
