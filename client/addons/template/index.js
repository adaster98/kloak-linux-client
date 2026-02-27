/**
 * ==========================================
 * KLOAK ADDON TEMPLATE
 * ==========================================
 * Folder: /addons/template/
 * File: index.js
 * Drop this folder into your addons directory to
 * see a complete, working boilerplate!
 */

(() => {
  // 1. DEFINE THE ID HERE! (This must exactly match your folder name)
  const ADDON_ID = "template";

  window.KloakAddons.registerAddon({
    // --- 1. METADATA ---
    id: ADDON_ID,
    name: "Developer Template",
    description:
      "A complete boilerplate showing how to use toggles, UI settings, and specific file storage.",

    // --- 2. LIFECYCLE HOOKS ---
    // Fires instantly when the user toggles the switch ON
    onEnable: () => {
      console.log(`[${ADDON_ID}] Addon Enabled!`);

      /**
       * NEW: KloakAddonAPI Usage
       * Use the API to access user identity and authentication keys.
       * Always wrap logic needing this data in the onReady callback.
       */
      if (window.KloakAddonAPI) {
        window.KloakAddonAPI.onReady((api) => {
          console.log(`[${ADDON_ID}] API Ready!`);
          console.log(`[${ADDON_ID}] User ID:`, api.userID);
          console.log(`[${ADDON_ID}] Auth Hash:`, api.xHash);
          console.log(`[${ADDON_ID}] In DMs:`, api.currentDMStatus);
          console.log(
            `[${ADDON_ID}] Current Server:`,
            api.currentServerName,
            `(${api.currentServerID})`,
          );

          // You can also access the full user profile
          if (api.userProfile) {
            console.log(`[${ADDON_ID}] Username:`, api.userProfile.username);
          }

          // These keys are required for making authenticated RPC calls
          // api.apiKey
          // api.authToken

          /**
           * NEW: File System API
           * Every addon has its own isolated folder.
           * You can read, write, list and delete files here securely.
           */
          const testFile = "hello.txt";
          const testData = "Hello from the FS API!";

          api.fs
            .write(ADDON_ID, testFile, testData)
            .then(() => {
              console.log(`[${ADDON_ID}] Successfully wrote to ${testFile}`);
              return api.fs.read(ADDON_ID, testFile);
            })
            .then((content) => {
              console.log(`[${ADDON_ID}] Read from ${testFile}:`, content);
            })
            .catch((err) => {
              console.error(`[${ADDON_ID}] FS Error:`, err);
            });
        });
      }
    },

    // Fires instantly when the user toggles the switch OFF
    onDisable: () => {
      console.log(`[${ADDON_ID}] Addon Disabled!`);
    },

    // --- 3. SETTINGS MENU ---
    renderSettings: async (container) => {
      // A. Show a quick loading message
      container.innerHTML = `<p style="color: var(--kloak-text-sub); text-align: center;">Loading settings...</p>`;

      // B. Fetch this specific addon's config.json safely
      let config = {};
      try {
        // NEW WAY (Recommended): Use the KloakAddonAPI settings provider
        if (window.KloakAddonAPI && window.KloakAddonAPI.settings) {
          config = await window.KloakAddonAPI.settings.get(ADDON_ID);
        }
        // OLD WAY: Direct Electron IPC (still works!)
        else if (window.electronAPI && window.electronAPI.getAddonConfig) {
          const savedConfig = await window.electronAPI.getAddonConfig(ADDON_ID);
          if (savedConfig) config = savedConfig;
        }
      } catch (err) {
        console.error(`[${ADDON_ID}] Failed to load config:`, err);
      }

      // C. Set default values if the config is empty (first time launch)
      const currentText = config.customText || "Default String";
      const isFeatureEnabled = config.enableFeature === true ? "checked" : "";

      // D. Draw the UI
      container.innerHTML = `
            <div class="addon-settings-item">
            <p style="margin: 0; color: var(--kloak-text-sub); font-size: 13px;">Modify these inputs to see how state is saved to your local folder.</p>

            <div style="margin-top: 12px;">
            <label class="addon-label">Custom String</label>
            <input id="tpl-text-input" type="text" value="${currentText}" style="width: 100%; padding: 10px; background: var(--kloak-bg-box); border: 1px solid var(--kloak-bg-btn); border-radius: 6px; color: var(--kloak-text-main); margin-top: 6px; box-sizing: border-box; outline: none; transition: border 0.2s;">
            </div>

            <label class="kloak-checkbox-label" style="user-select: none;">
            <input id="tpl-checkbox" type="checkbox" ${isFeatureEnabled} style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--kloak-text-main);">
            Enable Secret Feature
            </label>

            <button id="tpl-save-btn" class="addon-btn-save">Save Changes</button>
            </div>
            `;

      // E. Handle the Save Event
      const saveBtn = container.querySelector("#tpl-save-btn");
      const savedMsg = container.querySelector("#tpl-saved-msg");
      const textInput = container.querySelector("#tpl-text-input");
      const checkboxInput = container.querySelector("#tpl-checkbox");

      // Add a nice focus effect to the input
      textInput.addEventListener(
        "focus",
        () => (textInput.style.borderColor = "var(--kloak-text-main)"),
      );
      textInput.addEventListener(
        "blur",
        () => (textInput.style.borderColor = "var(--kloak-bg-btn)"),
      );

      saveBtn.addEventListener("click", () => {
        // Update our config object in memory
        config.customText = textInput.value;
        config.enableFeature = checkboxInput.checked;

        // Send it back through the secure bridge to write to the hard drive
        if (window.KloakAddonAPI && window.KloakAddonAPI.settings) {
          window.KloakAddonAPI.settings.set(ADDON_ID, config);

          const originalText = saveBtn.textContent;
          saveBtn.textContent = "✓ Saved to config.json";
          setTimeout(() => (saveBtn.textContent = originalText), 2000);
        } else if (window.electronAPI && window.electronAPI.saveAddonConfig) {
          window.electronAPI.saveAddonConfig({
            addonId: ADDON_ID,
            data: config,
          });

          const originalText = saveBtn.textContent;
          saveBtn.textContent = "✓ Saved to config.json";
          setTimeout(() => (saveBtn.textContent = originalText), 2000);
        }
      });
    },
  });
})();
