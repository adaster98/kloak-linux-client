const { contextBridge, ipcRenderer } = require('electron');
const { injectUI } = require('../renderer/ui-injector');

// Expose the API
contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-min'),
    maximize: () => ipcRenderer.send('window-max'),
    close: () => ipcRenderer.send('window-close'),

    openExternalUrl: (url) => ipcRenderer.send('open-external-url', url),

    // Folder helper
    openAddonsFolder: (subPath) => ipcRenderer.send('open-addons-folder', subPath),

    // Global States
    getAddonStates: () => ipcRenderer.invoke('get-addon-states'),
    saveAddonState: (data) => ipcRenderer.send('save-addon-state', data),

    // Addon Store
    getLocalVersions: () => ipcRenderer.invoke('get-local-versions'),
    installAddon: (data) => ipcRenderer.invoke('install-addon', data),
    fetchStoreData: () => ipcRenderer.invoke('fetch-store-data'),

    // Specific Addon Settings
    getAddonConfig: (addonId) => ipcRenderer.invoke('get-addon-config', addonId),
    saveAddonConfig: (data) => ipcRenderer.send('save-addon-config', data),

    // Theme Engine Helpers
    getThemeFiles: () => ipcRenderer.invoke('get-theme-files')
});

injectUI();
