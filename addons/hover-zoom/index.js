(() => {
    const ADDON_ID = 'hover-zoom';
    let isEnabled = false;
    let config = { lensSize: 300, zoomLevel: 2.5 };
    let activeUI = null;
    let triggerHandler = null;

    async function loadConfig() {
        try {
            if (window.electronAPI && window.electronAPI.getAddonConfig) {
                const data = await window.electronAPI.getAddonConfig(ADDON_ID);
                if (data) {
                    if (data.lensSize) config.lensSize = parseInt(data.lensSize, 10);
                    if (data.zoomLevel) config.zoomLevel = parseFloat(data.zoomLevel);
                }
            }
        } catch (e) { console.error("[Hover Zoom] Failed to load config", e); }
    }

    const createZoomUI = (imgElement) => {
        activeUI = document.createElement('div');
        Object.assign(activeUI.style, {
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.95)', zIndex: '999999',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'none'
        });

        const baseImg = document.createElement('img');
        baseImg.src = imgElement.src;
        Object.assign(baseImg.style, {
            maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain',
            boxShadow: '0 0 40px rgba(0,0,0,0.8)', userSelect: 'none', pointerEvents: 'none'
        });
        activeUI.appendChild(baseImg);

        const lens = document.createElement('div');
        Object.assign(lens.style, {
            position: 'fixed', width: `${config.lensSize}px`, height: `${config.lensSize}px`,
            borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)',
                      pointerEvents: 'none', transform: 'translate(-50%, -50%)',
                      boxShadow: '0 0 30px rgba(0,0,0,0.9)', zIndex: '1000000',
                      opacity: '0', overflow: 'hidden', backgroundColor: '#000'
        });

        const zoomedImg = document.createElement('img');
        zoomedImg.src = imgElement.src;
        Object.assign(zoomedImg.style, {
            position: 'absolute', top: 0, left: 0,
            pointerEvents: 'none', willChange: 'transform',
            maxWidth: 'none', maxHeight: 'none' // Prevent global styles from squishing it
        });
        lens.appendChild(zoomedImg);
        activeUI.appendChild(lens);

        const updateLens = (e) => {
            const rect = baseImg.getBoundingClientRect();
            lens.style.left = `${e.clientX}px`;
            lens.style.top = `${e.clientY}px`;

            const buffer = config.lensSize / 2;
            if (e.clientX >= rect.left - buffer && e.clientX <= rect.right + buffer &&
                e.clientY >= rect.top - buffer && e.clientY <= rect.bottom + buffer) {

                lens.style.opacity = '1';

            const localX = e.clientX - rect.left;
            const localY = e.clientY - rect.top;

            // Set width and height explicitly based on the stage image size
            // This ensures it stays proportional to the image the user is looking at
            const zWidth = rect.width * config.zoomLevel;
            const zHeight = rect.height * config.zoomLevel;

            zoomedImg.style.width = `${zWidth}px`;
            zoomedImg.style.height = `${zHeight}px`;

            const tx = (localX * config.zoomLevel) - (config.lensSize / 2);
            const ty = (localY * config.zoomLevel) - (config.lensSize / 2);

            zoomedImg.style.transform = `translate(${-tx}px, ${-ty}px)`;
                } else {
                    lens.style.opacity = '0';
                }
        };

        const closeUI = (e) => {
            if (e.key === 'Escape' || e.type === 'mousedown') {
                activeUI.remove();
                activeUI = null;
                document.removeEventListener('mousemove', updateLens);
                document.removeEventListener('keydown', closeUI);
                document.removeEventListener('mousedown', closeUI);
            }
        };

        document.addEventListener('mousemove', updateLens);
        document.addEventListener('keydown', closeUI);
        document.addEventListener('mousedown', closeUI);
        document.body.appendChild(activeUI);
    };

    window.KloakAddons.registerAddon({
        id: ADDON_ID,
        name: 'Hover Zoom Pro',
        description: 'Aspect-ratio fixed magnification with full corner tracking.',

        onEnable: async () => {
            isEnabled = true;
            await loadConfig();
            triggerHandler = (e) => {
                if (!isEnabled || !e.shiftKey || activeUI) return;
                if (e.target.tagName === 'IMG' && e.target.src) createZoomUI(e.target);
            };
                document.addEventListener('mousemove', triggerHandler);
        },
        onDisable: () => {
            isEnabled = false;
            if (activeUI) activeUI.remove();
            document.removeEventListener('mousemove', triggerHandler);
        },
        renderSettings: async (container) => {
            await loadConfig();
            container.innerHTML = `
            <div style="color: #E0E0E0; display: flex; flex-direction: column; gap: 16px;">
            <div>
            <label style="font-size: 11px; color: #71717a; text-transform: uppercase; font-weight: 700;">Lens Size (<span id="hz-size-val">${config.lensSize}</span>px)</label>
            <input id="hz-size-input" type="range" min="150" max="600" value="${config.lensSize}" style="width: 100%; margin-top: 8px; accent-color: #10b981;">
            </div>
            <div>
            <label style="font-size: 11px; color: #71717a; text-transform: uppercase; font-weight: 700;">Magnification (<span id="hz-zoom-val">${config.zoomLevel}</span>x)</label>
            <input id="hz-zoom-input" type="range" min="1.1" max="10" step="0.1" value="${config.zoomLevel}" style="width: 100%; margin-top: 8px; accent-color: #10b981;">
            </div>
            <button id="hz-save-btn" style="background: #10b981; color: #000; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 600;">Save Calibration</button>
            </div>
            `;
            const sizeIn = container.querySelector('#hz-size-input');
            const zoomIn = container.querySelector('#hz-zoom-input');
            sizeIn.oninput = (e) => container.querySelector('#hz-size-val').textContent = e.target.value;
            zoomIn.oninput = (e) => container.querySelector('#hz-zoom-val').textContent = e.target.value;
            container.querySelector('#hz-save-btn').onclick = () => {
                config.lensSize = parseInt(sizeIn.value);
                config.zoomLevel = parseFloat(zoomIn.value);
                window.electronAPI.saveAddonConfig({ addonId: ADDON_ID, data: config });
            };
        }
    });
})();
