class InvisicAddonManager {
  constructor() {
    this.addons = [];
    this.states = {};
    this.isActive = false;

    if (window.electronAPI && window.electronAPI.log)
      window.electronAPI.log("Invisic Addons: Initialising Manager...");
    this.init();
  }

  async init() {
    // App store data cache
    this._storeCache = null;
    this._storeCacheTime = 0;

    // Register MutationObserver BEFORE any async/await calls so it is always
    // active from the first synchronous tick. If both awaits below were placed
    // first, the observer would not be registered until those IPC round-trips
    // completed — creating a race condition where opening the settings dialog
    // during that window causes the "Addons" button to never appear.
    this._settingsObserver = new MutationObserver(() => {
      this.checkForSettingsMenu();
    });
    this._settingsObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Fallback: if the settings dialog was already open before this observer
    // was registered, inject the button now.
    this.checkForSettingsMenu();

    try {
      if (window.electronAPI && window.electronAPI.getAddonStates) {
        this.states = await window.electronAPI.getAddonStates();
      }
      if (window.electronAPI && window.electronAPI.getLocalVersions) {
        this.localVersions = await window.electronAPI.getLocalVersions();
      }
    } catch (e) {
      if (window.electronAPI && window.electronAPI.log)
        window.electronAPI.log(`Invisic Addons ERROR in init: ${e.message}`);
      this.states = {};
      this.localVersions = {};
    }
  }

  registerAddon(addon) {
    const NATIVE_IDS = ["stealth-mode", "dm-folders", "quick-edit"];
    if (NATIVE_IDS.includes(addon.id)) return;
    this.addons.push(addon);
    if (this.states[addon.id] === true && addon.onEnable) {
      try {
        addon.onEnable();
      } catch (e) {
        console.error(`Addon ${addon.id} failed:`, e);
      }
    }
  }

  getTopOffset() {
    const banner = document.querySelector(
      ".bg-slate-700.border-b.border-slate-600",
    );
    const bannerHeight = banner ? banner.offsetHeight : 0;
    return 36 + bannerHeight;
  }

  checkForSettingsMenu() {
    // Scan globally for the logout button (same approach that worked originally)
    const buttons = Array.from(document.querySelectorAll("button"));
    const logOutBtn = buttons.find(
      (b) =>
        b.textContent.includes("Log Out") &&
        b.classList.contains("text-destructive"),
    );
    const addonPane = document.getElementById("invisic-addon-pane");

    if (!logOutBtn) {
      this.isActive = false;
      if (addonPane) addonPane.classList.remove("active");
      return;
    }

    const nav = logOutBtn.closest("nav");
    if (!nav) return;
    if (document.getElementById("invisic-nav-addons")) return;

    const addonBtn = document.createElement("button");
    addonBtn.id = "invisic-nav-addons";
    addonBtn.className =
      "w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md transition-colors text-muted-foreground hover:bg-secondary/60 hover:text-foreground";
    addonBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plug w-4 h-4"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>Addons`;

    const appearanceBtn = document.createElement("button");
    appearanceBtn.id = "invisic-nav-appearance";
    appearanceBtn.className =
      "w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md transition-colors text-muted-foreground hover:bg-secondary/60 hover:text-foreground";
    appearanceBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/><path d="M14.5 17.5 4.5 15"/></svg>Themes`;

    let settingsModal = nav.closest('[role="dialog"]') || document.body;
    if (window.getComputedStyle(settingsModal).position === "static")
      settingsModal.style.position = "relative";

    if (!addonPane) {
      const newPane = document.createElement("div");
      newPane.id = "invisic-addon-pane";
      settingsModal.appendChild(newPane);
    }

    // Insert before the divider (if present), otherwise before logout
    const divider = nav.querySelector('[role="none"]');
    if (divider) {
      nav.insertBefore(addonBtn, divider);
      nav.insertBefore(appearanceBtn, divider);
    } else {
      nav.insertBefore(addonBtn, logOutBtn);
      nav.insertBefore(appearanceBtn, logOutBtn);
    }

    const NAV_INACTIVE =
      "w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md transition-colors text-muted-foreground hover:bg-secondary/60 hover:text-foreground";
    const NAV_ACTIVE =
      "w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md transition-colors bg-primary text-primary-foreground";

    addonBtn.addEventListener("click", (e) => {
      e.preventDefault();
      appearanceBtn.className = NAV_INACTIVE;
      this.activateAddonTab(
        nav,
        addonBtn,
        document.getElementById("invisic-addon-pane"),
      );
    });

    appearanceBtn.addEventListener("click", (e) => {
      e.preventDefault();
      addonBtn.className = NAV_INACTIVE;
      this.activateAppearanceTab(
        nav,
        appearanceBtn,
        document.getElementById("invisic-addon-pane"),
      );
    });

    nav
      .querySelectorAll(
        "button:not(#invisic-nav-addons):not(#invisic-nav-appearance)",
      )
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          if (this.isActive) {
            this.isActive = false;
            document
              .getElementById("invisic-addon-pane")
              .classList.remove("active");
            addonBtn.className = NAV_INACTIVE;
            appearanceBtn.className = NAV_INACTIVE;
          }
        });
      });
  }

  activateAppearanceTab(nav, appearanceBtn, addonPane) {
    this.isActive = true;
    const offset = this.getTopOffset();
    addonPane.style.top = `${offset}px`;

    nav.querySelectorAll("button").forEach((btn) => {
      if (
        btn.id !== "invisic-nav-appearance" &&
        !btn.classList.contains("text-destructive")
      ) {
        btn.className =
          "w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md transition-colors text-muted-foreground hover:bg-secondary/60 hover:text-foreground";
      }
    });

    appearanceBtn.className =
      "w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md transition-colors bg-primary text-primary-foreground";
    this.renderThemeUI(addonPane);
    addonPane.classList.add("active");
  }

  async renderThemeUI(container) {
    container.innerHTML = `
      <div class="invisic-esc-wrapper">
        <button id="invisic-addon-close" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <span class="invisic-esc-text">ESC</span>
      </div>
      <div class="addon-header-container">
        <h2>Themes</h2>
        <p>Choose a theme to customise the look of Invisic</p>
        <div class="addon-header-actions">
          <button id="theme-open-folder-btn" class="addon-card addon-action-btn" style="flex:0 0 auto;">
            <div class="addon-action-content">
              <div class="addon-action-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
              </div>
              <div class="addon-action-text-group">
                <h3 class="addon-action-title">Open Folder</h3>
                <p class="addon-action-subtitle">Add user themes</p>
              </div>
            </div>
          </button>
        </div>
      </div>
      <div id="theme-list-area" style="padding: 0 20px 20px; max-width: 480px;">
        <p style="color: var(--invisic-text-sub); font-size: 13px;">Loading themes...</p>
      </div>
    `;

    container.querySelector("#invisic-addon-close")?.addEventListener("click", () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    );

    container.querySelector("#theme-open-folder-btn")?.addEventListener("click", () => {
      window.electronAPI?.openUserThemesFolder?.();
    });

    let themes = [];
    try {
      themes = await window.electronAPI.getThemeFiles();
    } catch (e) {
      console.error("[Themes UI] Failed to load themes:", e);
    }

    const saved = localStorage.getItem("invisic-theme-selected") ?? "invisic.css";

    // Pinned entries: None first, then Invisic, then remaining bundled, then user
    const invisicTheme = themes.find((t) => t.bundled && t.filename === "invisic.css");
    const otherBundled = themes.filter((t) => t.bundled && t.filename !== "invisic.css");
    const user = themes.filter((t) => !t.bundled);

    function themeCard(filename, label, sublabel, isSelected) {
      return `
        <label class="theme-option" style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--invisic-bg-box);border:1px solid ${isSelected ? "var(--invisic-radiobtn-selected)" : "var(--invisic-radiobtn-border)"};border-radius:8px;cursor:pointer;transition:border-color 0.15s;">
          <input type="radio" name="theme-select" value="${filename}" ${isSelected ? "checked" : ""} style="accent-color:var(--invisic-radiobtn-selected);flex-shrink:0;">
          <div>
            <div style="font-weight:600;font-size:13px;color:var(--invisic-text-main);text-transform:capitalize;">${label}</div>
            ${sublabel ? `<div style="font-size:11px;color:var(--invisic-text-sub);">${sublabel}</div>` : ""}
          </div>
        </label>`;
    }

    let html = `<div style="display:flex;flex-direction:column;gap:6px;">`;

    html += themeCard("", "None (Kloak Default)", "", saved === "");
    if (invisicTheme) {
      html += themeCard("invisic.css", "Invisic", "invisic.css", saved === "invisic.css");
    }
    otherBundled.forEach((t) => {
      html += themeCard(t.filename, t.name, t.filename, saved === t.filename);
    });
    if (user.length > 0) {
      html += `<p style="font-size:11px;color:var(--invisic-text-sub);margin:8px 0 2px;padding-left:2px;">User Themes</p>`;
      user.forEach((t) => {
        html += themeCard(t.filename, t.name, t.filename, saved === t.filename);
      });
    }

    html += `</div>`;

    const listArea = container.querySelector("#theme-list-area");
    listArea.innerHTML = html;

    listArea.querySelectorAll('input[name="theme-select"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        listArea.querySelectorAll(".theme-option").forEach((l) => {
          l.style.borderColor = "var(--invisic-radiobtn-border)";
        });
        radio.closest(".theme-option").style.borderColor = "var(--invisic-radiobtn-selected)";
        document.dispatchEvent(new CustomEvent("invisic-apply-theme", { detail: radio.value }));
      });
    });
  }

  activateAddonTab(nav, addonBtn, addonPane) {
    this.isActive = true;
    const offset = this.getTopOffset();
    addonPane.style.top = `${offset}px`;

    nav.querySelectorAll("button").forEach((btn) => {
      if (
        btn.id !== "invisic-nav-addons" &&
        !btn.classList.contains("text-destructive")
      ) {
        btn.className =
          "w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md transition-colors text-muted-foreground hover:bg-secondary/60 hover:text-foreground";
      }
    });

    addonBtn.className =
      "w-full flex items-center gap-2.5 text-sm font-medium px-3 py-2 rounded-md transition-colors bg-primary text-primary-foreground";
    this.renderAddonUI(addonPane);
    addonPane.classList.add("active");
  }

  openSettingsModal(addon) {
    // Ensure Modal HTML exists
    let modal = document.getElementById("invisic-addon-settings-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "invisic-addon-settings-modal";
      modal.innerHTML = `
            <div class="invisic-modal-container modal-neutral">
                <div class="invisic-modal-header">
                    <div class="invisic-modal-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                    <div class="invisic-modal-title-group">
                        <h3 id="addon-settings-title" class="invisic-modal-title">Addon Info</h3>
                        <p class="invisic-modal-subtitle">Configuration & Details</p>
                    </div>
                    <button id="addon-settings-close" class="invisic-btn-secondary invisic-modal-close-icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                </div>
                <div id="addon-settings-content" class="invisic-modal-body mb-0"></div>
            </div>
            `;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => {
        if (e.target === modal || e.target.closest("#addon-settings-close"))
          modal.style.display = "none";
      });
    }

    document.getElementById("addon-settings-title").innerText = addon.name;
    const contentBox = document.getElementById("addon-settings-content");
    contentBox.innerHTML = "";

    if (addon.renderSettings) {
      addon.renderSettings(contentBox);
    } else {
      contentBox.innerHTML = `
            <div class="addon-no-settings">
            <div class="addon-no-settings-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </div>
            <h3 class="addon-no-settings-title">${addon.name}</h3>
            <p>${addon.description}</p>
            <p class="addon-no-settings-desc">This addon does not have configurable settings.</p>
            </div>
            `;
    }
    modal.style.display = "flex";
  }

  renderAddonUI(container) {
    let html = `
        <div class="invisic-esc-wrapper">
        <button id="invisic-addon-close" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <span class="invisic-esc-text">ESC</span>
        </div>

        <div class="addon-header-container">
        <h2>Addons</h2>
        <p>Manage custom addons and client modifications</p>

        <div class="addon-header-actions">
        <button id="invisic-open-folder" class="addon-card addon-action-btn">
        <div class="addon-action-content">
        <div class="addon-action-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
        </div>
        <div class="addon-action-text-group">
        <h3 class="addon-action-title">Open Folder</h3>
        <p class="addon-action-subtitle">Manage installed files</p>
        </div>
        </div>
        </button>

        <button id="invisic-get-addons" class="addon-card addon-action-btn">
        <div class="addon-action-content">
        <div class="addon-action-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        </div>
        <div class="addon-action-text-group">
        <h3 class="addon-action-title">Get More Addons</h3>
        <p class="addon-action-subtitle">Download from Codeberg</p>
        </div>
        </div>
        </button>
        </div>
        </div>
        `;

    if (this.addons.length === 0) {
      html += `<p class="addon-empty-state">No addons found. Click the folder above to get started.</p>`;
    } else {
      html += `<div class="addon-grid">`;
      this.addons.forEach((addon) => {
        const isEnabled = this.states[addon.id] === true;
        const localVersions = this.localVersions || {};
        const ver = localVersions[addon.id] || "9999";

        const iconSVG = addon.renderSettings
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;

        html += `
                <div class="addon-card">
                <div class="addon-info">
                <div class="addon-name-wrapper">
                    <h3 class="m-0">${addon.name}</h3>
                    <span class="addon-version-badge">v${ver}</span>
                </div>
                <p title="${addon.description}">${addon.description}</p>
                </div>
                <div class="addon-controls">
                <button class="addon-btn-icon" data-modal="${addon.id}">${iconSVG}</button>
                <div class="addon-toggle ${isEnabled ? "enabled" : ""}" data-id="${addon.id}"></div>
                </div>
                </div>
                `;
      });
      html += `</div>`;
    }

    container.innerHTML = html;

    container
      .querySelector("#invisic-open-folder")
      ?.addEventListener("click", () => window.electronAPI.openAddonsFolder());
    container
      .querySelector("#invisic-get-addons")
      ?.addEventListener("click", () => this.openAppStore());
    container
      .querySelector("#invisic-addon-close")
      ?.addEventListener("click", () =>
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
      );

    container.querySelectorAll(".addon-btn-icon").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const addonId = e.currentTarget.getAttribute("data-modal");
        const addon = this.addons.find((a) => a.id === addonId);
        if (addon) this.openSettingsModal(addon);
      });
    });

    container.querySelectorAll(".addon-toggle").forEach((toggle) => {
      toggle.addEventListener("click", (e) => {
        const addonId = e.currentTarget.getAttribute("data-id");
        const addon = this.addons.find((a) => a.id === addonId);
        if (!addon) return;

        const isNowEnabled = !e.currentTarget.classList.contains("enabled");
        if (isNowEnabled) e.currentTarget.classList.add("enabled");
        else e.currentTarget.classList.remove("enabled");

        this.states[addonId] = isNowEnabled;
        if (window.electronAPI.log)
          window.electronAPI.log(
            `Invisic Addons: Toggling ${addonId} to ${isNowEnabled}`,
          );
        window.electronAPI.saveAddonState({ addonId, enabled: isNowEnabled });

        try {
          if (isNowEnabled && addon.onEnable) addon.onEnable();
          if (!isNowEnabled && addon.onDisable) addon.onDisable();
        } catch (err) {
          if (window.electronAPI.log)
            window.electronAPI.log(
              `Invisic Addons ERROR toggling: ${err.message}`,
            );
        }
      });
    });
  }

  async openAppStore() {
    let storeModal = document.getElementById("invisic-addon-store-modal");
    if (!storeModal) {
      storeModal = document.createElement("div");
      storeModal.id = "invisic-addon-store-modal";
      storeModal.className = "invisic-modal-overlay";
      storeModal.innerHTML = `
            <div class="invisic-modal-container modal-neutral store-modal-container">
                <div class="invisic-modal-header">
                    <div class="invisic-modal-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    </div>
                    <div class="invisic-modal-title-group">
                        <h3 class="invisic-modal-title">Addon Store</h3>
                        <p class="invisic-modal-subtitle">Download from Codeberg</p>
                    </div>
                    <button id="store-close-btn" class="invisic-btn-secondary invisic-modal-close-icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                </div>
                <div id="store-content" class="invisic-modal-body store-modal-content">
                </div>
            </div>
            `;
      document.body.appendChild(storeModal);
      storeModal.addEventListener("click", (e) => {
        if (e.target === storeModal || e.target.closest("#store-close-btn"))
          storeModal.style.display = "none";
      });
    }

    storeModal.style.display = "flex";
    const content = document.getElementById("store-content");
    content.innerHTML = `<p class="store-loading-msg">Connecting to Codeberg repository...</p>`;

    try {
      // Use cached store data if fresh (5 min TTL)
      const now = Date.now();
      if (!this._storeCache || now - this._storeCacheTime > 300000) {
        const storeResponse = await window.electronAPI.fetchStoreData();
        if (!storeResponse.success) throw new Error(storeResponse.error);
        this._storeCache = storeResponse.data;
        this._storeCacheTime = now;
      }
      const storeData = this._storeCache;
      let localVersions = await window.electronAPI.getLocalVersions();

      let html = "";
      for (const [id, addon] of Object.entries(storeData)) {
        const localVer = localVersions[id];
        let btnHtml = "";

        if (!localVer) {
          btnHtml = `<button class="store-install-btn invisic-btn-primary store-btn-install" data-id="${id}" data-url="${addon.url}" data-ver="${addon.version}">Install</button>`;
        } else if (localVer === "9999") {
          btnHtml = `<button disabled class="store-btn-custom">Custom</button>`;
        } else if (localVer !== addon.version) {
          btnHtml = `<button class="store-install-btn store-btn-update" data-id="${id}" data-url="${addon.url}" data-ver="${addon.version}">Update (v${addon.version})</button>`;
        } else {
          btnHtml = `<button disabled class="store-btn-installed">Installed</button>`;
        }

        html += `
                <div class="store-addon-card">
                <div class="store-addon-info">
                <h4 class="store-addon-title">${addon.name} <span class="addon-version-badge">v${addon.version}</span></h4>
                <p class="store-addon-desc">${addon.description}</p>
                </div>
                <div class="store-addon-action">${btnHtml}</div>
                </div>
                `;
      }
      content.innerHTML = html;

      content.querySelectorAll(".store-install-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.getAttribute("data-id");
          const url = e.target.getAttribute("data-url");
          const ver = e.target.getAttribute("data-ver");
          e.target.textContent = "Installing...";
          e.target.disabled = true;
          const result = await window.electronAPI.installAddon({
            addonId: id,
            zipUrl: url,
            version: ver,
          });
          if (result.success) {
            e.target.textContent = "Installed! Restart App";
            e.target.style.color = "var(--invisic-accent-success)";
          } else {
            e.target.textContent = "Failed";
            e.target.style.background = "var(--invisic-accent-destructive)";
          }
        });
      });
    } catch (err) {
      content.innerHTML = `<p class="store-error-msg">Failed to load store: ${err.message}</p>`;
    }
  }
}
window.InvisicAddons = new InvisicAddonManager();
