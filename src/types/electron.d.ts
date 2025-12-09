export interface ElectronAPI {
    getHistory: () => Promise<any[]>;
    addHistory: (item: any) => Promise<any>;
    getSettings: () => Promise<any>;
    saveSettings: (settings: any) => Promise<void>;
    clearHistory: () => Promise<any[]>;
    toggleClipboard: (shouldWatch: boolean) => Promise<boolean>;
    selectDirectory: () => Promise<string | null>;
    setLogDirectory: (path: string) => Promise<boolean>;
    getLogDirectory: () => Promise<string>;
    getAppVersion: () => Promise<string>;
    fetchUrlMetadata: (url: string) => Promise<{ title: string; description: string }>;
    minimizeWindow: () => void;
    closeWindow: () => void;
    onClipboardUpdated: (callback: (item: any) => void) => () => void;
    onFocusInput: (callback: () => void) => () => void;
    getStartupStatus: () => Promise<boolean>;
    toggleStartup: (enable: boolean) => Promise<boolean>;
    log: (message: string) => void;
    getAvailableSkins: () => Promise<any[]>;
    loadSkin: (skinId: string) => Promise<any>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
