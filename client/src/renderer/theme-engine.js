(() => {
  const STYLE_TAG_ID = "invisic-theme-style";
  const PREF_KEY = "invisic-theme-selected";

  function getSavedTheme() {
    return localStorage.getItem(PREF_KEY) || "invisic.css";
  }

  async function applyTheme(filename) {
    const existing = document.getElementById(STYLE_TAG_ID);
    if (existing) existing.remove();

    if (!filename) {
      localStorage.setItem(PREF_KEY, "");
      return;
    }

    try {
      const files = await window.electronAPI.getThemeFiles();
      const theme = files.find((t) => t.filename === filename);
      if (!theme) return;

      const styleTag = document.createElement("style");
      styleTag.id = STYLE_TAG_ID;
      styleTag.textContent = theme.content;
      document.head.appendChild(styleTag);
      localStorage.setItem(PREF_KEY, filename);
    } catch (e) {
      console.error("[Theme Engine] Failed to apply theme:", e);
    }
  }

  // Auto-apply saved theme on load
  applyTheme(getSavedTheme());

  // Listen for theme change requests from the settings UI
  document.addEventListener("invisic-apply-theme", (e) => {
    applyTheme(e.detail || "");
  });
})();
