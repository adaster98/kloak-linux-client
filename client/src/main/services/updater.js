const { app, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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
    const gitRepo = "adaster98/invisic-client";

    const response = await fetch(
      `https://api.github.com/repos/${gitRepo}/releases/latest`,
      { headers: { "User-Agent": "invisic-client-updater" } }
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

async function triggerDebugUpdate(event) {
  try {
    const gitRepo = "adaster98/invisic-client";
    const response = await fetch(
      `https://api.github.com/repos/${gitRepo}/releases/latest`,
      { headers: { "User-Agent": "invisic-client-updater" } }
    );
    const data = await response.json();

    if (data.tag_name) {
      event.reply("update-status", {
        available: true,
        url: data.html_url,
        version: data.tag_name,
      });
    }
  } catch (err) {
    console.error("Debug update check failed", err);
  }
}

async function downloadUpdate(event, { version, platform }) {
  try {
    const isWin = platform === "win32";
    const assetExtension = isWin ? ".exe" : ".AppImage";

    // Fetch release data to find the correct asset download URL
    const gitRepo = "adaster98/invisic-client";
    const releaseRes = await fetch(
      `https://api.github.com/repos/${gitRepo}/releases/latest`,
      { headers: { "User-Agent": "invisic-client-updater" } }
    );
    const releaseData = await releaseRes.json();

    const asset = releaseData.assets?.find((a) =>
      a.name.endsWith(assetExtension),
    );
    if (!asset) {
      throw new Error(`No ${assetExtension} asset found in release ${version}`);
    }

    const url = asset.browser_download_url;
    const fileName = asset.name;
    const tempDir = app.getPath("temp");
    const downloadPath = path.join(tempDir, fileName);

    console.log(`[Updater] Downloading update from ${url} to ${downloadPath}`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    event.reply("update-progress", {
      progress: 0,
      status: "Starting download...",
    });

    const contentLength = response.headers.get("content-length");
    let downloaded = 0;
    const reader = response.body.getReader();
    const writer = fs.createWriteStream(downloadPath);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      downloaded += value.length;
      writer.write(value);

      if (contentLength) {
        const progress = Math.round((downloaded / contentLength) * 100);
        event.reply("update-progress", { progress, status: "Downloading..." });
      }
    }

    writer.end();

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    event.reply("update-progress", {
      progress: 100,
      status: "Ready to install",
    });

    global.pendingUpdatePath = downloadPath;

    // Platform-specific prep
    if (!isWin) {
      const currentAppImage = process.env.APPIMAGE;
      if (currentAppImage) {
        fs.chmodSync(downloadPath, 0o755);
        global.currentAppImage = currentAppImage;
      } else {
        throw new Error(
          "APPIMAGE environment variable not found. Are you running from an AppImage?",
        );
      }
    }
  } catch (err) {
    console.error("[Updater] Download failed", err);
    event.reply("update-progress", { error: err.message });
  }
}

function installAndRestart() {
  const isWin = process.platform === "win32";
  const updatePath = global.pendingUpdatePath;

  if (!updatePath || !fs.existsSync(updatePath)) {
    console.error("[Updater] No update found to install");
    return;
  }

  if (isWin) {
    try {
      // Write a temp .vbs script that runs completely hidden (no cmd window).
      const vbsContent = [
        'Set WshShell = CreateObject("WScript.Shell")',
        "WScript.Sleep 3000",
        `WshShell.Run """${updatePath.replace(/\\/g, "\\\\")}""" & " /S", 0, True`,
        `Set fso = CreateObject("Scripting.FileSystemObject")`,
        `If fso.FileExists("${updatePath.replace(/\\/g, "\\\\")}") Then fso.DeleteFile "${updatePath.replace(/\\/g, "\\\\")}"`,
        'WshShell.Run """%LOCALAPPDATA%\\Programs\\invisic-client\\Invisic.exe""", 1, False',
        "fso.DeleteFile WScript.ScriptFullName",
      ].join("\r\n");

      const vbsPath = path.join(app.getPath("temp"), "invisic-update.vbs");
      fs.writeFileSync(vbsPath, vbsContent);

      console.log("[Updater] Spawning hidden Windows update script:", vbsPath);
      spawn("wscript.exe", [vbsPath], {
        detached: true,
        stdio: "ignore",
      }).unref();

      app.exit(0);
    } catch (err) {
      console.error("[Updater] Failed to launch Windows update script", err);
    }
  } else {
    const currentAppImage = global.currentAppImage;
    if (currentAppImage) {
      try {
        // The running AppImage is FUSE-mounted and can't be overwritten in-place.
        // Spawn a detached bash script that waits for us to exit, then replaces & relaunches.
        const pid = process.pid;
        const script = `
          while kill -0 ${pid} 2>/dev/null; do sleep 0.5; done
          sleep 1
          mv -f "${updatePath}" "${currentAppImage}" || cp -f "${updatePath}" "${currentAppImage}"
          chmod +x "${currentAppImage}"
          "${currentAppImage}" &
        `;

        console.log("[Updater] Spawning update script for PID:", pid);
        spawn("bash", ["-c", script], {
          detached: true,
          stdio: "ignore",
        }).unref();

        app.exit(0);
      } catch (err) {
        console.error("[Updater] Failed to launch update script", err);
      }
    }
  }
}

module.exports = {
  checkForCustomUpdate,
  downloadUpdate,
  installAndRestart,
  triggerDebugUpdate,
};
