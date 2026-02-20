(() => {
    const ADDON_ID = 'zen-mode';
    let isZen = false;
    let isEnabled = false;

    const defaultHotkey = { ctrl: true, shift: true, alt: false, code: 'KeyZ', display: 'Z' };
    let config = { hotkey: { ...defaultHotkey } };
    let isListeningForHotkey = false;

    async function loadConfig() {
        try {
            if (window.electronAPI && window.electronAPI.getAddonConfig) {
                const data = await window.electronAPI.getAddonConfig(ADDON_ID);
                if (data && data.hotkey) config.hotkey = data.hotkey;
            }
        } catch (e) { console.error("[Zen Mode] Failed to load config", e); }
    }

    function saveConfig() {
        if (window.electronAPI && window.electronAPI.saveAddonConfig) {
            window.electronAPI.saveAddonConfig({ addonId: ADDON_ID, data: config });
        }
    }

    function playZenAnimation() {
        // Dark Tint
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            pointerEvents: 'none', zIndex: 9999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.85)', // The black tint to cover the app
                      opacity: 0, transition: 'opacity 0.3s ease-in-out'
        });

        // Glow
        const glow = document.createElement('div');
        Object.assign(glow.style, {
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: 'radial-gradient(circle, rgba(234, 179, 8, 0.25) 0%, rgba(0,0,0,0) 60%)',
                      mixBlendMode: 'screen'
        });

        // Text
        const text = document.createElement('div');
        text.textContent = 'Zen Mode';
        Object.assign(text.style, {
            color: '#fef08a', fontSize: '2.5rem', fontWeight: '300', letterSpacing: '8px',
            fontFamily: 'sans-serif', textShadow: '0 0 20px rgba(234, 179, 8, 0.5)',
                      transform: 'translateY(15px)', transition: 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
                      position: 'relative', zIndex: 2 // Keep it above the glow
        });

        overlay.appendChild(glow);
        overlay.appendChild(text);
        document.body.appendChild(overlay);

        // Animate In
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            text.style.transform = 'translateY(0px)';
            text.style.letterSpacing = '14px';
        });

        // Animate Out & Cleanup
        setTimeout(() => {
            overlay.style.opacity = '0';
            text.style.transform = 'translateY(-15px)';
            setTimeout(() => overlay.remove(), 400);
        }, 1000);
    }

    const toggleZen = () => {
        if (!isEnabled) return;
        isZen = !isZen;

        const styleId = 'zen-mode-styles';
        let styleTag = document.getElementById(styleId);

        if (isZen) {
            playZenAnimation();
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = styleId;
                styleTag.innerHTML = `
                /* 1. Hide Left Server/Channel Panel */
                .bg-layout-sidebar-secondary {
                    display: none !important;
                }

                /* 2. Hide Right Members Panel */
                .bg-layout-members {
                    display: none !important;
                }

                /* 3. Hide Top Server Selector */
                /* Using attribute selectors safely targets the slashes in Tailwind classes */
                [class*="h-14"][class*="bg-background/20"][class*="border-b"][class*="border-border/30"] {
                    display: none !important;
                }

                /* 4. Ensure the center chat expands smoothly */
                main, .flex-1 {
                    max-width: none !important;
                }
                `;
                document.head.appendChild(styleTag);
            }
        } else {
            if (styleTag) styleTag.remove();
        }
    };

    const handleKeydown = (e) => {
        if (!isEnabled || isListeningForHotkey) return;
        const hk = config.hotkey;
        if (e.ctrlKey === hk.ctrl && e.shiftKey === hk.shift && e.altKey === hk.alt && e.code === hk.code) {
            e.preventDefault();
            toggleZen();
        }
    };

    const renderHotkeyHTML = (hk) => {
        let html = '';
        if (hk.ctrl) html += `<kbd class="zen-kbd">Ctrl</kbd> + `;
        if (hk.shift) html += `<kbd class="zen-kbd">Shift</kbd> + `;
        if (hk.alt) html += `<kbd class="zen-kbd">Alt</kbd> + `;
        html += `<kbd class="zen-kbd">${hk.display.toUpperCase()}</kbd>`;
        return html;
    };

    window.KloakAddons.registerAddon({
        id: ADDON_ID,
        name: 'Zen Mode',
        description: 'Instantly hide all sidebars and focus entirely on your conversation. Features a customizable hotkey.',

        onEnable: async () => {
            isEnabled = true;
            await loadConfig();
            document.addEventListener('keydown', handleKeydown);
        },

        onDisable: () => {
            isEnabled = false;
            isZen = false;
            document.removeEventListener('keydown', handleKeydown);
            const styleTag = document.getElementById('zen-mode-styles');
            if (styleTag) styleTag.remove();
        },

        renderSettings: async (container) => {
            await loadConfig();

            container.innerHTML = `
            <style>
            .zen-kbd { background: #27272a; padding: 4px 8px; border-radius: 4px; border-bottom: 2px solid #000; font-family: monospace; color: #E0E0E0; font-size: 13px; }
            .hotkey-box { position: relative; background: #18181b; border: 1px solid #27272a; padding: 24px; border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
            .hotkey-box:hover { border-color: #10b981; background: #1c1c1f; }
            .hotkey-box.listening { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); animation: pulse-border 1.5s infinite; }
            .zen-reset-btn { position: absolute; bottom: 8px; right: 8px; background: transparent; border: none; color: #52525b; cursor: pointer; border-radius: 4px; padding: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
            .zen-reset-btn:hover { color: #E0E0E0; background: #27272a; }
            @keyframes pulse-border { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
            </style>
            <div style="color: #E0E0E0; text-align: center; padding: 10px;">
            <p id="zen-helper-text" style="font-size: 13px; color: #a1a1aa; margin-bottom: 12px; transition: color 0.2s;">Click the box below to map a new hotkey.</p>

            <div id="zen-hotkey-box" class="hotkey-box" title="Click to bind a new hotkey">
            <div id="zen-hotkey-content">${renderHotkeyHTML(config.hotkey)}</div>

            <button id="zen-reset-btn" class="zen-reset-btn" title="Reset to Default">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
            </div>
            </div>
            `;

            const box = container.querySelector('#zen-hotkey-box');
            const content = container.querySelector('#zen-hotkey-content');
            const resetBtn = container.querySelector('#zen-reset-btn');
            const helperText = container.querySelector('#zen-helper-text');

            const recordKey = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const modifiers = ['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'];
                if (modifiers.includes(e.code)) return;

                config.hotkey = {
                    ctrl: e.ctrlKey,
                    shift: e.shiftKey,
                    alt: e.altKey,
                    code: e.code,
                    display: e.code === 'Space' ? 'SPACE' : e.key
                };

                saveConfig();
                content.innerHTML = renderHotkeyHTML(config.hotkey);
                stopListening();
            };

            const stopListening = () => {
                isListeningForHotkey = false;
                box.classList.remove('listening');
                helperText.textContent = "Click the box below to map a new hotkey.";
                helperText.style.color = "#a1a1aa";
                document.removeEventListener('keydown', recordKey, true);
            };

            const startListening = () => {
                isListeningForHotkey = true;
                box.classList.add('listening');
                helperText.textContent = "Listening... Press any key combination.";
                helperText.style.color = "#3b82f6";
                content.innerHTML = `<span style="color: #3b82f6; font-size: 14px; font-weight: 600;">...</span>`;
                document.addEventListener('keydown', recordKey, true);
            };

            box.addEventListener('click', (e) => {
                if (e.target.closest('#zen-reset-btn')) return;
                if (!isListeningForHotkey) startListening();
            });

                document.addEventListener('click', (e) => {
                    if (isListeningForHotkey && !box.contains(e.target)) {
                        content.innerHTML = renderHotkeyHTML(config.hotkey);
                        stopListening();
                    }
                });

                resetBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    config.hotkey = { ...defaultHotkey };
                    saveConfig();
                    content.innerHTML = renderHotkeyHTML(config.hotkey);
                    if (isListeningForHotkey) stopListening();
                });
        }
    });
})();
