import { useState, useEffect, useCallback } from 'react';

export interface AppSettings {
    // API & Provider
    apiKey: string;
    geminiApiKey: string;
    geminiModelName: string;
    groqApiKey: string;
    openaiApiKey: string;
    provider: 'gemini' | 'local' | 'openai';
    localBaseUrl: string;
    localModelName: string;
    openaiBaseUrl: string;
    openaiModelName: string;

    // General
    themeColor: string;
    logDirectory: string;
    targetLanguage: string;
    skinId: string;
    systemPrompt: string;
    additionalPrompt: string;
    developerMode: boolean;
    isClipboardEnabled: boolean;

    // TTS
    ttsEnabled: boolean;
    ttsProvider: 'browser' | 'openai' | 'voicevox';
    ttsVoice: string;
    ttsSummaryPrompt: string;
    ttsSummaryThreshold: number;

    // Voice / Audio
    inputDeviceId: string;
    wakeWord: string;
    voiceInputEnabled: boolean;
    wakeWordTimeout: number;
    transcriptionProvider: 'native' | 'openai' | 'local' | 'vosk' | 'groq';

    // Avatar Persistence (Synced to useAvatar)
    avatarVisible: boolean;
    avatarScale: number;
    avatarPosition: { x: number; y: number };
    avatarPath: string;
    currentAvatarId: string | null;
    sleepTimeout: number;
    alwaysOnTop: boolean;
    autoBlink: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
    apiKey: '',
    geminiApiKey: '',
    geminiModelName: 'gemini-3-flash-preview',
    groqApiKey: '',
    openaiApiKey: '',
    provider: 'gemini',
    localBaseUrl: 'http://localhost:11434/v1',
    localModelName: 'llama3',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiModelName: 'gpt-5.2',
    themeColor: '#ef4444',
    logDirectory: '',
    targetLanguage: 'Japanese',
    skinId: 'default',
    systemPrompt: '',
    additionalPrompt: '',
    developerMode: false,
    isClipboardEnabled: true,
    ttsEnabled: false,
    ttsProvider: 'browser',
    ttsVoice: 'alloy',
    ttsSummaryPrompt: 'Summarize the following text in under 400 characters for speech.',
    ttsSummaryThreshold: 400,
    inputDeviceId: 'default',
    wakeWord: 'ニコ',
    voiceInputEnabled: false,
    wakeWordTimeout: 2,
    transcriptionProvider: 'vosk',
    avatarVisible: false,
    avatarScale: 1,
    avatarPosition: { x: 0, y: 0 },
    avatarPath: '',
    currentAvatarId: null,
    sleepTimeout: 30000,
    alwaysOnTop: false,
    autoBlink: true
};

export const useSettings = () => {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [isLoaded, setIsLoaded] = useState(false);

    // Initial Load
    useEffect(() => {
        const loadSettings = async () => {
            if (window.electronAPI && window.electronAPI.getSettings) {
                try {
                    const saved = await window.electronAPI.getSettings();
                    if (saved) {
                        setSettings(prev => ({ ...prev, ...saved }));
                    }
                } catch (e) {
                    console.error("Failed to load settings:", e);
                } finally {
                    setIsLoaded(true);
                }
            } else {
                setIsLoaded(true);
            }
        };
        loadSettings();
    }, []);

    // Save with Debounce
    useEffect(() => {
        if (!isLoaded) return;
        if (window.electronAPI && window.electronAPI.saveSettings) {
            const timeoutId = setTimeout(() => {
                window.electronAPI.saveSettings(settings);
            }, 1000);
            return () => clearTimeout(timeoutId);
        }
    }, [settings, isLoaded]);

    const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    return {
        settings,
        updateSettings,
        isLoaded
    };
};
