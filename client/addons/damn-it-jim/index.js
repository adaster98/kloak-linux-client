(() => {
  const ADDON_ID = "damn-it-jim";

  function findGoogleFontsLink() {
    return document.querySelector(
      'link[rel="stylesheet"][href*="fonts.googleapis.com"]'
    );
  }

  window.KloakAddons.registerAddon({
    id: ADDON_ID,
    name: "Damn It Jim",
    description: "Temporary addon to fix the font spacing bug",

    onEnable() {
      const link = findGoogleFontsLink();
      if (link && link.media === "print") {
        link.media = "all";
        console.log("[damn-it-jim] Fixed Google Fonts link: media=print → media=all");
      }
    },

    onDisable() {
      const link = findGoogleFontsLink();
      if (link && link.media === "all") {
        link.media = "print";
        console.log("[damn-it-jim] Restored Google Fonts link: media=all → media=print");
      }
    },

  });
})();