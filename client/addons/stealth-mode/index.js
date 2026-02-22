(async () => {
    const ADDON_ID = 'stealth-mode';
    let config = {};
    let injectTimer = null;

    try {
        if (window.electronAPI && window.electronAPI.getAddonConfig) {
            config = await window.electronAPI.getAddonConfig(ADDON_ID);
        }
    } catch (e) {}

    if (config.stealthEnabled === undefined) config.stealthEnabled = false;

    // Interceptors

    // WebSocket Interceptor
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
        if (config.stealthEnabled) {
            try {
                let isTypingSignal = false;
                if (typeof data === 'string' && data.toLowerCase().includes('typing')) {
                    isTypingSignal = true;
                }
                else if (data instanceof ArrayBuffer || data instanceof Blob) {
                    const decoder = new TextDecoder();
                    const text = decoder.decode(data instanceof Blob ? data.arrayBuffer() : data);
                    if (text.toLowerCase().includes('typing')) isTypingSignal = true;
                }

                if (isTypingSignal) return; // Drop packet
            } catch (err) {}
        }
        return originalSend.apply(this, arguments);
    };

    // Fetch Interceptor
    const { fetch: originalFetch } = window;
    window.fetch = async (...args) => {
        if (config.stealthEnabled) {
            const [resource, options] = args;
            const url = typeof resource === 'string' ? resource : resource.url;

            if (url.includes('typing') || (options?.body && options.body.includes('typing'))) {
                return new Response(null, { status: 204 }); // Return fake success
            }
        }
        return originalFetch(...args);
    };

    // Helper functions

    const updateButtonIcon = (btn) => {
        const eyeOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>`;
        const eyeClosed = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;

        btn.innerHTML = config.stealthEnabled ? eyeClosed : eyeOpen;
        btn.style.color = config.stealthEnabled ? "#ef4444" : "";
    };

    const injectStealthButton = () => {
        const controls = document.querySelector('.flex.items-center.gap-1.mb-0\\.5.relative');
        if (!controls || document.getElementById('kloak-stealth-btn')) return;

        const stealthBtn = document.createElement('button');
        stealthBtn.id = 'kloak-stealth-btn';
        stealthBtn.type = 'button';
        stealthBtn.className = "p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors";
        updateButtonIcon(stealthBtn);

        stealthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            config.stealthEnabled = !config.stealthEnabled;
            updateButtonIcon(stealthBtn);

            if (window.electronAPI.saveAddonConfig) {
                window.electronAPI.saveAddonConfig({ addonId: ADDON_ID, data: config });
            }
        });

        controls.insertBefore(stealthBtn, controls.firstChild);
    };

    // addon registration

    window.KloakAddons.registerAddon({
        id: ADDON_ID,
        name: 'Stealth Mode',
        description: 'Blocks the "User is typing..." indicator from being sent to others.',

        onEnable: () => {
            injectStealthButton();
            injectTimer = setInterval(injectStealthButton, 1000);
        },

        onDisable: () => {
            config.stealthEnabled = false;
            if (injectTimer) clearInterval(injectTimer);
            const btn = document.getElementById('kloak-stealth-btn');
            if (btn) btn.remove();
        }
    });
})();
