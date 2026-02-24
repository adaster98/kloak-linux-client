const { app } = require("electron");

function isNewerVersion(remote, local) {
  const r = remote.replace(/^v/, "").split(".").map(Number);
  const l = local.replace(/^v/, "").split(".").map(Number);

  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

async function checkForCustomUpdate(event) {
  try {
    const currentVersion = app.getVersion();
    const gitRepo = "adaster98/kloak-client-unofficial";

    const response = await fetch(
      `https://codeberg.org/api/v1/repos/${gitRepo}/releases/latest`,
    );
    const data = await response.json();

    if (data.tag_name) {
      if (isNewerVersion(data.tag_name, currentVersion)) {
        event.reply("update-status", {
          available: true,
          url: data.html_url,
          version: data.tag_name,
        });
        return;
      }
    }

    event.reply("update-status", { available: false });
  } catch (err) {
    console.error("Update check failed", err);
    event.reply("update-status", { available: false, error: true });
  }
}

module.exports = { checkForCustomUpdate };
