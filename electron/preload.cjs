const { contextBridge, ipcRenderer } = require('electron');



console.log('Preload script loaded');

contextBridge.exposeInMainWorld('electronAPI', {
    getHistory: () => ipcRenderer.invoke('get-history'),
    addHistory: (item) => ipcRenderer.invoke('add-history', item),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    toggleClipboard: (shouldWatch) => ipcRenderer.invoke('toggle-clipboard', shouldWatch),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    setLogDirectory: (path) => ipcRenderer.invoke('set-log-directory', path),
    getLogDirectory: () => ipcRenderer.invoke('get-log-directory'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    fetchUrlMetadata: (url) => ipcRenderer.invoke('fetch-url-metadata', url),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    onClipboardUpdated: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('clipboard-updated', subscription);
        return () => ipcRenderer.removeListener('clipboard-updated', subscription);
    },
    onFocusInput: (callback) => {
        const subscription = () => callback();
        ipcRenderer.on('focus-input', subscription);
        return () => ipcRenderer.removeListener('focus-input', subscription);
    },
    getStartupStatus: () => ipcRenderer.invoke('get-startup-status'),
    toggleStartup: (enable) => ipcRenderer.invoke('toggle-startup', enable),
    log: (message) => ipcRenderer.send('log', message),
    getAvailableSkins: () => ipcRenderer.invoke('get-available-skins'),
    loadSkin: (skinId) => ipcRenderer.invoke('load-skin', skinId),
});
