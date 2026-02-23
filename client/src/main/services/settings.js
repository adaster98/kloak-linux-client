const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const settingsPath = path.join(app.getPath('userData'), 'kloak-settings.json');

function loadSettings() {
    try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
    catch (e) { return { skipLinkWarning: false }; }
}
function saveSettings(settings) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
}

module.exports = { loadSettings, saveSettings };
