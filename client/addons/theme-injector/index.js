(() => {
  const ADDON_ID = "theme-injector";
  const STYLE_TAG_ID = "kloak-custom-theme-style";

  let isEnabled = false;
  let currentConfig = { selectedTheme: "" };

  async function loadConfig() {
    try {
      if (window.electronAPI && window.electronAPI.getAddonConfig) {
        const data = await window.electronAPI.getAddonConfig(ADDON_ID);
        if (data && typeof data.selectedTheme === "string") {
          currentConfig.selectedTheme = data.selectedTheme;
        }
      }
    } catch (e) {
      console.error("[Theme Engine] Failed to load config", e);
    }
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
    const activeTheme = themes.find(
      (t) => t.filename === currentConfig.selectedTheme,
    );

    if (activeTheme) {
      let styleTag = document.createElement("style");
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
    name: "Theme Injector",
    description:
      "Select a custom CSS theme from your themes folder to completely reskin the client.",

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
      container.innerHTML = `<p style="color: var(--kloak-text-sub); text-align: center;">Loading themes...</p>`;

      await loadConfig();
      const themes = await getThemes();

      let html = `
            <div class="addon-settings-item">
                <p style="margin: 0; color: var(--kloak-text-sub); font-size: 13px;">Drop <code>.css</code> files into the themes folder to install them.</p>

                <div style="display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; padding-right: 4px; margin-top: 12px;">
                <label class="theme-option" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--kloak-bg-box); border: 1px solid ${currentConfig.selectedTheme === "" ? "var(--kloak-text-main)" : "var(--kloak-bg-btn)"}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <input type="radio" name="theme-select" value="" ${currentConfig.selectedTheme === "" ? "checked" : ""}>
                <div>
                <div style="font-weight: 600; font-size: 14px; color: var(--kloak-text-main);">None (Default Kloak)</div>
                </div>
                </label>
            `;

      if (themes.length > 0) {
        themes.forEach((theme) => {
          const isSelected = currentConfig.selectedTheme === theme.filename;
          html += `
                    <label class="theme-option" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--kloak-bg-box); border: 1px solid ${isSelected ? "var(--kloak-text-main)" : "var(--kloak-bg-btn)"}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                    <input type="radio" name="theme-select" value="${theme.filename}" ${isSelected ? "checked" : ""}>
                    <div>
                    <div style="font-weight: 600; font-size: 14px; color: var(--kloak-text-main); text-transform: capitalize;">${theme.name}</div>
                    <div style="font-size: 11px; color: var(--kloak-text-sub);">${theme.filename}</div>
                    </div>
                    </label>
                    `;
        });
      } else {
        html += `<p style="color: var(--kloak-accent-destructive); font-size: 12px; text-align: center;">No themes found in folder!</p>`;
      }

      html += `
            </div>

            <button id="ti-save-btn" class="addon-btn-save">Apply Theme</button>
            <button id="ti-folder-btn" style="width: 100%; margin-top: 8px; background: var(--kloak-bg-btn); color: var(--kloak-text-main); border: 1px solid var(--kloak-bg-btn); padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.2s;">Open Themes Folder</button>
            </div>
            `;

      container.innerHTML = html;

      // Wire up the Open Folder button
      const folderBtn = container.querySelector("#ti-folder-btn");
      if (folderBtn) {
        folderBtn.addEventListener(
          "mouseenter",
          () => (folderBtn.style.background = "var(--kloak-icon-bg)"),
        );
        folderBtn.addEventListener(
          "mouseleave",
          () => (folderBtn.style.background = "var(--kloak-bg-btn)"),
        );
        folderBtn.addEventListener("click", () => {
          if (window.electronAPI && window.electronAPI.openAddonsFolder) {
            window.electronAPI.openAddonsFolder("theme-injector/themes");
          }
        });
      }

      // Wire up the Save button
      const saveBtn = container.querySelector("#ti-save-btn");
      if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
          const selectedRadio = container.querySelector(
            'input[name="theme-select"]:checked',
          );
          currentConfig.selectedTheme = selectedRadio
            ? selectedRadio.value
            : "";

          if (window.electronAPI && window.electronAPI.saveAddonConfig) {
            window.electronAPI.saveAddonConfig({
              addonId: ADDON_ID,
              data: currentConfig,
            });

            const labels = container.querySelectorAll(".theme-option");
            labels.forEach(
              (l) => (l.style.borderColor = "var(--kloak-bg-btn)"),
            );
            if (selectedRadio)
              selectedRadio.closest(".theme-option").style.borderColor =
                "var(--kloak-text-main)";

            if (isEnabled) await applySelectedTheme();

            const originalText = saveBtn.textContent;
            saveBtn.textContent = "✓ Theme Applied";
            setTimeout(() => (saveBtn.textContent = originalText), 2000);
          }
        });
      }
    },
  });
})();
