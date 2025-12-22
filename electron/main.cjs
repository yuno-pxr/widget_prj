const { app, BrowserWindow, ipcMain, clipboard, dialog, Tray, Menu, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const dataManager = require('./dataManager.cjs');
const skinManager = require('./skinManager.cjs');

let lastClipboardText = '';
let clipboardInterval = null;
let tray = null;

function startClipboardWatcher(win) {
    console.log('Starting clipboard watcher...');
    if (clipboardInterval) clearInterval(clipboardInterval);

    lastClipboardText = clipboard.readText();

    clipboardInterval = setInterval(() => {
        let text = clipboard.readText();

        // If no text, check for files (URI list)
        // We prioritize text because browsers often put the URL in text/uri-list too.
        if (!text) {
            const uriList = clipboard.read('text/uri-list');
            if (uriList) {
                // Decode URI list to file paths
                // Usually format is "file:///path/to/file\r\n"
                try {
                    const decoded = decodeURIComponent(uriList);
                    // Extract first file path for simplicity, or join them
                    const match = decoded.match(/file:\/\/\/(.+)/);
                    if (match && match[1]) {
                        text = match[1].replace(/\r\n$/, '');
                    }
                } catch (e) {
                    console.error('Error decoding URI list:', e);
                }
            }
        }

        if (text && text !== lastClipboardText) {
            console.log('Clipboard changed:', text.substring(0, 20) + '...');
            lastClipboardText = text;

            const newItem = dataManager.addHistoryItem({
                type: 'clipboard',
                content: text,
                originalContent: text
            });

            if (win && !win.isDestroyed()) {
                console.log('Sending clipboard-updated to renderer');
                win.webContents.send('clipboard-updated', newItem);
            }
        }
    }, 1000);
}

let mainWindow = null;
let avatarWindow = null;
let isQuitting = false;

// Disable GPU Acceleration for compatibility (keep existing)
app.disableHardwareAcceleration();

// --- Avatar Window ---
function createAvatarWindow() {
    console.log('Creating avatar window...');
    const preloadPath = path.join(__dirname, 'preload.cjs');

    avatarWindow = new BrowserWindow({
        width: 100,
        height: 100,
        minWidth: 1,
        minHeight: 1,
        useContentSize: true,
        transparent: true,
        frame: false,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true, // Allow resizing via code if needed, but mainly controlled by content
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false
        }
    });

    // Load same app but with identifying query param
    const isDev = !app.isPackaged;
    const searchParam = '?mode=avatar';

    if (isDev) {
        avatarWindow.loadURL(`http://localhost:5173${searchParam}`);
        // avatarWindow.webContents.openDevTools({ mode: 'detach' }); 
    } else {
        avatarWindow.loadFile(path.join(__dirname, '../dist/index.html'), { search: 'mode=avatar' });
    }

    avatarWindow.setIgnoreMouseEvents(false); // Make it interactable by default

    avatarWindow.on('closed', () => {
        avatarWindow = null;
    });
}

// IPC: Receive update from Main Window, forward to Avatar Window
let cachedAvatarState = null;

ipcMain.on('update-avatar-state', (event, state) => {
    cachedAvatarState = state; // Cache for new windows
    if (avatarWindow && !avatarWindow.isDestroyed()) {
        avatarWindow.webContents.send('avatar-state-updated', state);
    }
});

ipcMain.handle('get-avatar-state', () => cachedAvatarState);

ipcMain.on('resize-avatar-window', (event, { width, height }) => {
    if (avatarWindow && !avatarWindow.isDestroyed()) {
        try {
            avatarWindow.setMinimumSize(1, 1); // Ensure constraint allows shrinking
            avatarWindow.setContentSize(Math.ceil(width), Math.ceil(height));
        } catch (e) {
            console.error('Resize failed:', e);
        }
    }
});

// IPC: Allow Avatar Window to control its own ignoreMouseEvents if needed
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setIgnoreMouseEvents(ignore, options);
});

function createTray() {
    const iconPath = path.join(__dirname, 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);
    tray.setToolTip('Monolith Widget');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show', click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit', click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

function registerGlobalShortcut() {
    // User requested "win+shift+a".
    // On Windows, 'Super' is the Windows key.
    const shortcut = 'Super+Shift+A';

    // Unregister first just in case
    globalShortcut.unregisterAll();

    const ret = globalShortcut.register(shortcut, () => {
        console.log('Global shortcut activated');
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            // Send event to renderer to focus input
            mainWindow.webContents.send('focus-input');
        }
    });

    if (!ret) {
        console.log('Registration failed for:', shortcut);
    } else {
        console.log('Global shortcut registered:', shortcut);
    }
}

function createWindow() {
    console.log('Creating window...');
    const preloadPath = path.join(__dirname, 'preload.cjs');
    console.log('Preload path:', preloadPath);

    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        minWidth: 400,
        minHeight: 600,
        resizable: true,
        frame: false,
        transparent: false,
        backgroundColor: '#1a1a1a',
        alwaysOnTop: false,
        center: true, // Force center
        skipTaskbar: false, // Show in taskbar when visible
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false // Allow background processing (e.g. voice recognition)
        },
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus(); // Force focus
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    const isDev = !app.isPackaged;
    console.log('Is Dev:', isDev);

    if (isDev) {
        console.log('Loading URL: http://localhost:5173');
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' }); // Open DevTools
    } else {
        console.log('Loading file:', path.join(__dirname, '../dist/index.html'));
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Check settings before starting clipboard watcher
    const settings = dataManager.getSettings();
    if (settings.isClipboardEnabled !== false) { // Default to true if undefined
        startClipboardWatcher(mainWindow);
    }
}

ipcMain.handle('get-history', () => {
    console.log('IPC: get-history');
    return dataManager.getHistory();
});

ipcMain.handle('add-history', (event, item) => {
    console.log('IPC: add-history', item);
    return dataManager.addHistoryItem(item);
});

ipcMain.handle('get-settings', () => {
    console.log('IPC: get-settings');
    return dataManager.getSettings();
});

ipcMain.handle('save-settings', (event, settings) => {
    console.log('IPC: save-settings');
    // Re-register shortcut if needed (future implementation)
    return dataManager.saveSettings(settings);
});

ipcMain.handle('clear-history', async () => {
    console.log('IPC: clear-history');
    dataManager.clearHistory();
    return [];
});

ipcMain.handle('toggle-clipboard', async (event, shouldWatch) => {
    console.log('IPC: toggle-clipboard', shouldWatch);
    if (shouldWatch) {
        startClipboardWatcher(mainWindow);
    } else {
        if (clipboardInterval) {
            clearInterval(clipboardInterval);
            clipboardInterval = null;
        }
    }
    return shouldWatch;
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle('set-log-directory', (event, path) => {
    try {
        dataManager.setLogDirectory(path);
        return true;
    } catch (e) {
        console.error('Failed to set log directory:', e);
        return false;
    }
});

ipcMain.handle('get-log-directory', () => {
    return dataManager.getLogDirectory();
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-startup-status', () => {
    return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('toggle-startup', (event, enable) => {
    app.setLoginItemSettings({
        openAtLogin: enable,
        path: app.getPath('exe') // Explicitly set path for safety
    });
    return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('get-available-skins', () => {
    return skinManager.getAvailableSkins();
});

ipcMain.handle('load-skin', (event, skinId) => {
    return skinManager.loadSkin(skinId);
});

ipcMain.handle('fetch-url-metadata', async (event, url) => {
    try {
        console.log('Fetching metadata for:', url);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();

        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';

        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
        const description = descMatch ? descMatch[1].trim() : '';

        return { title, description };
    } catch (error) {
        console.error('Error fetching metadata:', error);
        return { title: '', description: '' };
    }
});

ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.hide(); // Minimize to tray
});

ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.hide(); // Close to tray
});

ipcMain.on('log', (event, message) => {
    console.log('[Renderer]:', message);
});

// --- Avatar Handling ---
const AdmZip = require('adm-zip');
const fs = require('fs');

const AVATAR_CACHE_DIR = path.join(app.getPath('userData'), 'avatar_cache');

ipcMain.handle('select-file', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        ...options
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle('load-avatar', async (event, filePath) => {
    try {
        console.log('Loading avatar from:', filePath);

        // Ensure cache dir exists
        if (!fs.existsSync(AVATAR_CACHE_DIR)) {
            fs.mkdirSync(AVATAR_CACHE_DIR, { recursive: true });
        }

        // Clean cache dir? For now, let's just overwrite 'current' folder or similar.
        // To support switching avatars, maybe specific folder?
        // Let's us a fixed 'current' folder for simplicity in this version.
        const currentAvatarDir = path.join(AVATAR_CACHE_DIR, 'current');

        // Remove existing current dir if possible to clean up
        try {
            if (fs.existsSync(currentAvatarDir)) {
                fs.rmSync(currentAvatarDir, { recursive: true, force: true });
            }
        } catch (e) {
            console.warn('Failed to clean avatar cache:', e);
        }

        fs.mkdirSync(currentAvatarDir, { recursive: true });

        const zip = new AdmZip(filePath);
        zip.extractAllTo(currentAvatarDir, true);

        // Read model.json
        const modelPath = path.join(currentAvatarDir, 'model.json');
        if (!fs.existsSync(modelPath)) {
            throw new Error('Invalid Avatar: model.json not found');
        }

        const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

        // Return model data with fixed paths for the renderer to use via protocol
        // We will serve from avatar://current/
        return modelData;
    } catch (e) {
        console.error('Failed to load avatar:', e);
        throw e;
    }
});

const { protocol } = require('electron');

app.whenReady().then(() => {
    console.log('App Ready');

    // Register avatar protocol
    protocol.registerFileProtocol('avatar', (request, callback) => {
        const url = request.url.replace('avatar://', '');
        // We expect avatar://current/assets/...
        // Map to AVATAR_CACHE_DIR
        try {
            // Decode URL to handle spaces etc
            const decodedPath = decodeURIComponent(url);
            const fullPath = path.join(AVATAR_CACHE_DIR, decodedPath);
            callback({ path: fullPath });
        } catch (error) {
            console.error('Avatar protocol error:', error);
            callback({ error: -2 }); // FILE_NOT_FOUND
        }
    });

    createTray();
    createWindow();
    createAvatarWindow(); // Create avatar window
    registerGlobalShortcut();


    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
            createAvatarWindow(); // Re-create if needed
        }
    });

    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, 'icon.png');
        app.dock.setIcon(iconPath);
    }
});

app.on('will-quit', () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    // Do not quit on window close, as we have a tray icon
    if (process.platform !== 'darwin') {
        // app.quit(); // Removed to allow tray persistence
    }
});
