const { app } = require('electron');
const { createWindow } = require('./window');
const { createTray } = require('./tray');
const { registerIpcHandlers } = require('./ipc-handlers');

app.whenReady().then(() => {
    createWindow();
    createTray();
    registerIpcHandlers();
});
