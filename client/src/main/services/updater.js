const { app } = require('electron');

async function checkForCustomUpdate(event) {
    try {
        const currentVersion = app.getVersion();
        const gitRepo = 'adaster98/kloak-client-unofficial';

        const response = await fetch(`https://codeberg.org/api/v1/repos/${gitRepo}/releases/latest`);
        const data = await response.json();

        if (data.tag_name) {
            if (data.tag_name !== currentVersion) {
                event.reply('update-status', { available: true, url: data.html_url, version: data.tag_name });
                return;
            }
        }

        event.reply('update-status', { available: false });
    } catch (err) {
        console.error("Update check failed", err);
        event.reply('update-status', { available: false, error: true });
    }
}

module.exports = { checkForCustomUpdate };
