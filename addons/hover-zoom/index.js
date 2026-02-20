(() => {
    const ADDON_ID = 'hover-zoom';

    let isEnabled = false;
    let config = { lensSize: 350, zoomLevel: 150 };
    let activeLens = null;
    let activeTarget = null; // Track the actual image element

    let triggerHandler = null;
    let mouseMoveHandler = null;
    let keyDownHandler = null;
    let clickHandler = null;

    async function loadConfig() {
        try {
            if (window.electronAPI && window.electronAPI.getAddonConfig) {
                const data = await window.electronAPI.getAddonConfig(ADDON_ID);
                if (data) {
                    if (data.lensSize) config.lensSize = parseInt(data.lensSize, 10);
                    if (data.zoomLevel) config.zoomLevel = parseInt(data.zoomLevel, 10);
                }
            }
        } catch (e) { console.error("[Hover Zoom] Failed to load config", e); }
    }

    const createLens = (imgElement, startX, startY) => {
        activeTarget = imgElement;
        activeLens = document.createElement('div');
        activeLens.id = 'kloak-zoom-lens';

        Object.assign(activeLens.style, {
            position: 'fixed',
            width: `${config.lensSize}px`,
            height: `${config.lensSize}px`,
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: '999999',
            backgroundImage: `url("${imgElement.src}")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: `${config.zoomLevel}vw auto`,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.85), inset 0 0 20px rgba(0,0,0,0.8), 0 0 10px rgba(255,255,255,0.2)',
                      border: '2px solid rgba(255,255,255,0.1)',
                      transform: 'translate(-50%, -50%)',
                      left: `${startX}px`,
                      top: `${startY}px`,
                      transition: 'opacity 0.1s ease-out'
        });

        updateLensPosition(startX, startY);
        document.body.appendChild(activeLens);

        mouseMoveHandler = (e) => {
            if (!activeLens) return;
            activeLens.style.left = `${e.clientX}px`;
            activeLens.style.top = `${e.clientY}px`;
            updateLensPosition(e.clientX, e.clientY);
        };

        keyDownHandler = (e) => {
            if (e.key === 'Escape') closeLens();
        };

            clickHandler = () => closeLens();

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('keydown', keyDownHandler);
            document.addEventListener('mousedown', clickHandler);
    };

    const updateLensPosition = (x, y) => {
        if (!activeTarget) return;

        // Get the exact coordinates of the image on the screen
        const rect = activeTarget.getBoundingClientRect();

        // Calculate the mouse's percentage strictly WITHIN the image bounds
        let xPct = ((x - rect.left) / rect.width) * 100;
        let yPct = ((y - rect.top) / rect.height) * 100;

        // Clamp the values between 0 and 100 just in case the mouse drifts slightly off the edge
        xPct = Math.max(0, Math.min(100, xPct));
        yPct = Math.max(0, Math.min(100, yPct));

        activeLens.style.backgroundPosition = `${xPct}% ${yPct}%`;
    };

    const closeLens = () => {
        if (activeLens) {
            activeLens.remove();
            activeLens = null;
            activeTarget = null;
        }
        if (mouseMoveHandler) document.removeEventListener('mousemove', mouseMoveHandler);
        if (keyDownHandler) document.removeEventListener('keydown', keyDownHandler);
        if (clickHandler) document.removeEventListener('mousedown', clickHandler);
    };

        window.KloakAddons.registerAddon({
            id: ADDON_ID,
            name: 'Hover Zoom',
            description: 'Hold Shift and hover your mouse over any image to bring up a magnifying glass. Press Escape or click to close.',

            onEnable: async () => {
                isEnabled = true;
                await loadConfig();

                triggerHandler = (e) => {
                    if (!isEnabled || !e.shiftKey || activeLens) return;

                    if (e.target.tagName === 'IMG' && e.target.src) {
                        // We now pass the entire image element, not just the src!
                        createLens(e.target, e.clientX, e.clientY);
                    }
                };

                document.addEventListener('mousemove', triggerHandler);
            },

            onDisable: () => {
                isEnabled = false;
                closeLens();
                if (triggerHandler) document.removeEventListener('mousemove', triggerHandler);
            },

            renderSettings: async (container) => {
                container.innerHTML = `<p style="color: #949494; text-align: center;">Loading settings...</p>`;
                await loadConfig();

                container.innerHTML = `
                <div style="color: #E0E0E0; display: flex; flex-direction: column; gap: 16px;">
                <p style="margin: 0; color: #a1a1aa; font-size: 13px;">Tune the optics of your magnifying glass below.</p>

                <div>
                <div style="display: flex; justify-content: space-between;">
                <label style="font-size: 11px; color: #71717a; text-transform: uppercase; font-weight: 700;">Lens Size (<span id="hz-size-val">${config.lensSize}</span>px)</label>
                </div>
                <input id="hz-size-input" type="range" min="150" max="800" value="${config.lensSize}" style="width: 100%; margin-top: 8px; accent-color: #10b981; cursor: pointer;">
                </div>

                <div>
                <div style="display: flex; justify-content: space-between;">
                <label style="font-size: 11px; color: #71717a; text-transform: uppercase; font-weight: 700;">Zoom Power (<span id="hz-zoom-val">${config.zoomLevel}</span>%)</label>
                </div>
                <input id="hz-zoom-input" type="range" min="50" max="300" value="${config.zoomLevel}" style="width: 100%; margin-top: 8px; accent-color: #10b981; cursor: pointer;">
                </div>

                <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px; padding-top: 16px; border-top: 1px solid #27272a;">
                <button id="hz-save-btn" style="background: #10b981; color: #000; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">Save Calibration</button>
                <span id="hz-saved-msg" style="color: #10b981; font-size: 13px; font-weight: 500; opacity: 0; transition: opacity 0.2s;">✓ Saved</span>
                </div>
                </div>
                `;

                const sizeInput = container.querySelector('#hz-size-input');
                const zoomInput = container.querySelector('#hz-zoom-input');

                sizeInput.addEventListener('input', (e) => container.querySelector('#hz-size-val').textContent = e.target.value);
                zoomInput.addEventListener('input', (e) => container.querySelector('#hz-zoom-val').textContent = e.target.value);

                container.querySelector('#hz-save-btn').addEventListener('click', () => {
                    config.lensSize = parseInt(sizeInput.value, 10);
                    config.zoomLevel = parseInt(zoomInput.value, 10);

                    if (window.electronAPI && window.electronAPI.saveAddonConfig) {
                        window.electronAPI.saveAddonConfig({ addonId: ADDON_ID, data: config });

                        const msg = container.querySelector('#hz-saved-msg');
                        msg.style.opacity = '1';
                        setTimeout(() => msg.style.opacity = '0', 2000);
                    }
                });
            }
        });
})();
