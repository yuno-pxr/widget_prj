import { useState, useEffect, useRef } from 'react';
import { X, Layers, Monitor, Cpu, Mic, Volume2 } from 'lucide-react';
import { useSkin } from '../contexts/SkinContext';

// Internal StartupToggle component
const StartupToggle = () => {
    const [isEnabled, setIsEnabled] = useState(false);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getStartupStatus().then(setIsEnabled);
        }
    }, []);

    const handleToggle = async () => {
        if (window.electronAPI) {
            const newState = await window.electronAPI.toggleStartup(!isEnabled);
            setIsEnabled(newState);
        }
    };

    return (
        <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${isEnabled ? 'bg-green-500/50' : 'bg-white/10 group-hover:bg-white/20'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 ${isEnabled ? 'left-4.5' : 'left-0.5'}`} />
            </div>
            <input type="checkbox" checked={isEnabled} onChange={handleToggle} className="hidden" />
        </label>
    );
};

interface SettingsModalProps {
    onClose: () => void;
    // Props for syncing state with App.tsx (or we could move state here completely if App doesn't need it instantly, but App needs keys for AI)
    // For now, let's accept initial values and onSave/Update.
    // Actually, App.tsx has the state. Let's pass the setters or use a context.
    // Given the complexity, let's pass a "settings" object and an "onUpdate" callback.
    settings: any;
    onUpdate: (newSettings: any) => void;
    appVersion: string;
}

export const SettingsModal = ({ onClose, settings, onUpdate, appVersion }: SettingsModalProps) => {
    const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'skin' | 'speech' | 'audio'>('ai');
    const { availableSkins, loadSkin } = useSkin();

    // Audio Devices
    const [audioDevices, setAudioDevices] = useState<{ deviceId: string, label: string }[]>([]);

    // Audio Test State
    const [isTestingMic, setIsTestingMic] = useState(false);
    const [micLevel, setMicLevel] = useState(0);
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // VoiceVox Speaker State
    const [voicevoxSpeakers, setVoicevoxSpeakers] = useState<{ name: string, styles: { name: string, id: number }[] }[]>([]);
    const [isFetchingSpeakers, setIsFetchingSpeakers] = useState(false);
    const [voicevoxError, setVoicevoxError] = useState('');

    const fetchVoicevoxSpeakers = async () => {
        setIsFetchingSpeakers(true);
        setVoicevoxError('');
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

            const res = await fetch('http://localhost:50021/speakers', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                setVoicevoxSpeakers(data);
            } else {
                setVoicevoxError('Failed to connect (Check localhost:50021)');
            }
        } catch (e) {
            setVoicevoxError('Connection failed. Is VoiceVox running?');
        } finally {
            setIsFetchingSpeakers(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'audio') {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                const inputs = devices.filter(d => d.kind === 'audioinput');
                setAudioDevices(inputs);
            }).catch(err => console.error("Error fetching audio devices:", err));
        }
    }, [activeTab]);
    // Local state for form fields to avoid excessive re-renders in App
    const [localSettings, setLocalSettings] = useState(settings);

    const supportedLanguages = [
        'Japanese', 'English', 'Chinese', 'Korean', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian'
    ];

    const geminiModels = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-flash-latest",
        "gemini-pro-latest",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ];

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);


    // Audio Testing Utilities
    const stopMicTest = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            micStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setIsTestingMic(false);
        setMicLevel(0);
    };

    const testMicrophone = async () => {
        if (isTestingMic) {
            stopMicTest();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: localSettings.inputDeviceId && localSettings.inputDeviceId !== 'default'
                        ? { exact: localSettings.inputDeviceId }
                        : undefined
                }
            });

            micStreamRef.current = stream;
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            const analyser = audioContext.createAnalyser();
            analyserRef.current = analyser;
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateLevel = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                // Normalize 0-255 to 0-100 roughly
                const level = Math.min(100, Math.round((average / 128) * 100)); // Amplify a bit
                setMicLevel(level);
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };

            setIsTestingMic(true);
            updateLevel();

        } catch (err) {
            console.error("Microphone test failed:", err);
            setIsTestingMic(false);
        }
    };

    // Cleanup mic test on unmount or tab switch
    useEffect(() => {
        return () => stopMicTest();
    }, []);

    const testSpeaker = () => {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Low volume

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5); // 0.5 seconds

        setTimeout(() => {
            audioContext.close();
        }, 600);
    };

    const handleChange = (key: string, value: any) => {
        const newSettings = { ...localSettings, [key]: value };
        setLocalSettings(newSettings);
        onUpdate(newSettings); // Sync with App immediately or on save? App uses it for context. Sticky settings usually implies immediate effect or "Apply".
        // App.tsx saves to file on change of specific dependencies.
        // Doing it immediately is fine for this app scale.
    };

    // Skin logic
    const handleSkinSelect = async (skinId: string) => {
        await loadSkin(skinId);
        // Skin needs to be saved to settings? 
        // Current implementation of SkinContext doesn't save preference to settings, it just loads. 
        // We should probably save `skinId` to settings.
        // But `skinId` isn't in default settings yet.
        // Let's add it to localSettings and let App save it.
        // But App doesn't know about `skinId` field yet.
        // We can just rely on dataManager later if we add it. 
        // For now, let's assume SkinContext persistence is handled? 
        // Actually SkinContext *doesn't* persist. It loads from settings *if* we implemented that.
        // Wait, `window.electronAPI.getSettings()` returns `theme`? No.
        // We need to adding `skinId` to settings.
        // Let's assume we can add arbitrary fields to settings object.
        handleChange('skinId', skinId);
    };



    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center p-3 border-b border-white/10 bg-black/20">
                    <h2 className="text-xs font-bold tracking-widest text-white flex items-center gap-2">
                        <SettingsIcon tab={activeTab} /> SETTINGS
                    </h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <X size={14} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-black/40 border-b border-white/5">
                    <TabButton id="ai" label="AI MODEL" icon={<Cpu size={12} />} active={activeTab} onClick={setActiveTab} />
                    <TabButton id="speech" label="SPEECH" icon={<Volume2 size={12} />} active={activeTab} onClick={setActiveTab} />
                    <TabButton id="audio" label="AUDIO" icon={<Mic size={12} />} active={activeTab} onClick={setActiveTab} />
                    <TabButton id="skin" label="SKINS" icon={<Layers size={12} />} active={activeTab} onClick={setActiveTab} />
                    <TabButton id="general" label="GENERAL" icon={<Monitor size={12} />} active={activeTab} onClick={setActiveTab} />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">

                    {/* AI TAB */}
                    {activeTab === 'ai' && (
                        <div className="space-y-4">
                            {/* Provider Selector */}
                            <div className="space-y-2">
                                <Label>AI Provider</Label>
                                <div className="flex gap-2">
                                    <ProviderButton id="gemini" label="GEMINI" color="blue" current={localSettings.provider} onClick={(p) => handleChange('provider', p)} />
                                    <ProviderButton id="openai" label="GPT (OpenAI)" color="purple" current={localSettings.provider} onClick={(p) => handleChange('provider', p)} />
                                    <ProviderButton id="local" label="LOCAL LLM" color="green" current={localSettings.provider} onClick={(p) => handleChange('provider', p)} />
                                </div>
                            </div>

                            {localSettings.provider === 'gemini' && (
                                <div className="space-y-3 bg-white/5 p-3 rounded border border-white/5">
                                    <div className="space-y-1">
                                        <Label>Gemini API Key</Label>
                                        <Input
                                            type="password"
                                            value={localSettings.geminiApiKey || localSettings.apiKey || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('geminiApiKey', e.target.value)}
                                            placeholder="Enter your Gemini API key..."
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Model</Label>
                                        <select
                                            value={localSettings.geminiModelName || "gemini-2.0-flash"}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('geminiModelName', e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded p-1.5 text-white text-xs font-mono focus:border-blue-500/50 outline-none"
                                        >
                                            {geminiModels.map(m => <option key={m} value={m} className="bg-neutral-900">{m}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {localSettings.provider === 'openai' && (
                                <div className="space-y-3 bg-white/5 p-3 rounded border border-white/5">
                                    <div className="space-y-1">
                                        <Label>API Key</Label>
                                        <Input
                                            type="password"
                                            value={localSettings.openaiApiKey || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('openaiApiKey', e.target.value)}
                                            placeholder="sk-..."
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Base URL</Label>
                                        <Input
                                            value={localSettings.openaiBaseUrl || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('openaiBaseUrl', e.target.value)}
                                            placeholder="https://api.openai.com/v1"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Model Name</Label>
                                        <Input
                                            list="openai-models"
                                            value={localSettings.openaiModelName || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('openaiModelName', e.target.value)}
                                            placeholder="gpt-4o, grok-beta..."
                                        />
                                        <datalist id="openai-models">
                                            <option value="grok-beta" />
                                            <option value="gpt-4o" />
                                            <option value="gpt-4o-mini" />
                                            <option value="gpt-4-turbo" />
                                            <option value="gpt-3.5-turbo" />
                                        </datalist>
                                    </div>
                                </div>
                            )}



                            {localSettings.provider === 'local' && (
                                <div className="space-y-3 bg-white/5 p-3 rounded border border-white/5">
                                    <div className="p-3 text-center text-white/50 text-xs italic">
                                        Ensure your Local LLM (e.g., Ollama) is running.
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Base URL</Label>
                                        <Input
                                            value={localSettings.localBaseUrl || 'http://localhost:11434/v1'}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('localBaseUrl', e.target.value)}
                                            placeholder="http://localhost:11434/v1"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Model Name</Label>
                                        <Input
                                            value={localSettings.localModelName || 'llama3'}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('localModelName', e.target.value)}
                                            placeholder="llama3"
                                        />
                                    </div>
                                </div>
                            )}



                            {/* Usage Stats (Placeholder for now, could be passed in props if available) */}
                            {/* <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-200">
                                <span className="font-bold">ESTIMATED USAGE:</span> 12,500 Tokens (Session)
                            </div> */}
                        </div>
                    )}

                    {/* SKIN TAB */}
                    {activeTab === 'skin' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                {/* Default Skin Option */}
                                <div
                                    onClick={() => handleSkinSelect('default')}
                                    className={`
                                    cursor-pointer rounded-lg border p-2 flex flex-col gap-2 transition-all
                                    ${localSettings.skinId === 'default' ? 'bg-white/10 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}
                                `}
                                >
                                    <div className="h-16 rounded bg-black/50 flex items-center justify-center text-white/20 overflow-hidden relative">
                                        <Layers size={24} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-white truncate">Default (Dark)</div>
                                        <div className="text-[10px] text-white/50 truncate">Monolith Standard</div>
                                    </div>
                                </div>
                                {availableSkins.map((s) => (
                                    <div
                                        key={s.id}
                                        onClick={() => handleSkinSelect(s.id)}
                                        className={`
                                    cursor-pointer rounded-lg border p-2 flex flex-col gap-2 transition-all
                                    ${localSettings.skinId === s.id ? 'bg-white/10 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}
                                `}
                                    >
                                        <div className="h-16 rounded bg-black/50 flex items-center justify-center text-white/20 overflow-hidden relative">
                                            {/* Preview if available */}
                                            {/* We can construct a preview URL if we had one in metadata */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                                            <Layers size={24} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-white truncate">{s.name}</div>
                                            <div className="text-[10px] text-white/50 truncate">{s.author || 'Unknown'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SPEECH TAB */}
                    {activeTab === 'speech' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-white/5 p-3 rounded border border-white/5">
                                <div>
                                    <Label>Text-to-Speech (TTS)</Label>
                                    <p className="text-[10px] text-white/50">Read aloud AI responses.</p>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${localSettings.ttsEnabled ? 'bg-blue-500/50' : 'bg-white/10 group-hover:bg-white/20'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 ${localSettings.ttsEnabled ? 'left-4.5' : 'left-0.5'}`} />
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={localSettings.ttsEnabled || false}
                                        onChange={(e) => handleChange('ttsEnabled', e.target.checked)}
                                        className="hidden"
                                    />
                                </label>
                            </div>

                            {localSettings.ttsEnabled && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Provider</Label>
                                        <select
                                            value={localSettings.ttsProvider || 'browser'}
                                            onChange={(e) => handleChange('ttsProvider', e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded p-1.5 text-white text-xs font-mono focus:border-blue-500/50 outline-none"
                                        >
                                            <option value="browser" className="bg-neutral-900">Browser Native (Free)</option>
                                            <option value="openai" className="bg-neutral-900">OpenAI Audio (Paid)</option>
                                            <option value="voicevox" className="bg-neutral-900">VOICEVOX (Local / External)</option>
                                        </select>
                                    </div>

                                    {localSettings.ttsProvider === 'browser' && (
                                        <div className="p-3 bg-white/5 rounded border border-white/5 text-[10px] text-white/50 italic">
                                            Uses your operating system's built-in voices.
                                        </div>
                                    )}

                                    {localSettings.ttsProvider === 'openai' && (
                                        <div className="space-y-2">
                                            <Label>Voice</Label>
                                            <select
                                                value={localSettings.ttsVoice || 'alloy'}
                                                onChange={(e) => handleChange('ttsVoice', e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded p-1.5 text-white text-xs font-mono focus:border-blue-500/50 outline-none"
                                            >
                                                <option value="alloy" className="bg-neutral-900">Alloy</option>
                                                <option value="echo" className="bg-neutral-900">Echo</option>
                                                <option value="fable" className="bg-neutral-900">Fable</option>
                                                <option value="onyx" className="bg-neutral-900">Onyx</option>
                                                <option value="nova" className="bg-neutral-900">Nova</option>
                                                <option value="shimmer" className="bg-neutral-900">Shimmer</option>
                                            </select>
                                        </div>
                                    )}

                                    {localSettings.ttsProvider === 'voicevox' && (
                                        <div className="space-y-3">
                                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-200">
                                                Requires VOICEVOX engine running at <code>http://localhost:50021</code>.
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Speaker Selection</Label>

                                                {/* Connection / Refresh */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <button
                                                        onClick={fetchVoicevoxSpeakers}
                                                        disabled={isFetchingSpeakers}
                                                        className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-xs text-white transition-colors flex items-center gap-2"
                                                    >
                                                        {isFetchingSpeakers ? 'Connecting...' : (voicevoxSpeakers.length > 0 ? 'Refresh Speakers' : 'Connect to Localhost')}
                                                    </button>
                                                    {voicevoxError && <span className="text-red-400 text-[10px]">{voicevoxError}</span>}
                                                </div>

                                                {/* Dropdown (if loaded) or Manual Input (fallback) */}
                                                {voicevoxSpeakers.length > 0 ? (
                                                    <select
                                                        value={localSettings.ttsVoice || ''}
                                                        onChange={(e) => handleChange('ttsVoice', e.target.value)}
                                                        className="w-full bg-black/20 border border-white/10 rounded p-1.5 text-white text-xs font-mono focus:border-blue-500/50 outline-none"
                                                    >
                                                        <option value="">Select a Speaker</option>
                                                        {voicevoxSpeakers.map(speaker => (
                                                            <optgroup key={speaker.name} label={speaker.name}>
                                                                {speaker.styles.map(style => (
                                                                    <option key={style.id} value={style.id}>
                                                                        {speaker.name} ({style.name})
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <Input
                                                        type="number"
                                                        value={localSettings.ttsVoice || '1'}
                                                        onChange={(e: any) => handleChange('ttsVoice', e.target.value)}
                                                        placeholder="e.g. 1 (Zundamon), 2 (Metan)..."
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2 pt-2 border-t border-white/10">
                                        <Label>TTS Summary Prompt (For Long Text)</Label>
                                        <textarea
                                            value={localSettings.ttsSummaryPrompt || ''}
                                            onChange={(e) => handleChange('ttsSummaryPrompt', e.target.value)}
                                            placeholder="e.g. Summarize the following text in under 400 characters for speech."
                                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white h-20 focus:outline-none focus:border-blue-500/50 resize-none"
                                        />
                                        <p className="text-[10px] text-white/40">Used when text exceeds the max length. Defines how to summarize it for reading.</p>
                                    </div>

                                    <div className="space-y-1">
                                        <Label>Max Characters before Summary</Label>
                                        <Input
                                            type="number"
                                            value={localSettings.ttsSummaryThreshold ?? 400}
                                            onChange={(e: any) => handleChange('ttsSummaryThreshold', e.target.value === '' ? 0 : parseInt(e.target.value))}
                                            placeholder="400"
                                            className="text-xs"
                                        />
                                        <p className="text-[10px] text-white/40">Text longer than this will be summarized.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}



                    {/* AUDIO TAB (INPUT) */}
                    {activeTab === 'audio' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Enable Voice Input</Label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${localSettings.voiceInputEnabled ? 'bg-red-500/50' : 'bg-white/10 group-hover:bg-white/20'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 ${localSettings.voiceInputEnabled ? 'left-4.5' : 'left-0.5'}`} />
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={localSettings.voiceInputEnabled || false}
                                        onChange={(e) => handleChange('voiceInputEnabled', e.target.checked)}
                                        className="hidden"
                                    />
                                </label>
                            </div>

                            <div className="space-y-4 border-t border-white/5 pt-4">
                                <div className="p-3 bg-white/5 rounded border border-white/5">
                                    <Label>Wake Word Engine</Label>
                                    <div className="flex items-center justify-between mt-1">
                                        <div className="text-sm font-mono text-green-400">Vosk (Offline)</div>
                                        <div className="text-[10px] text-white/40">Always Active if Voice Enabled</div>
                                    </div>
                                    {/* Wake Word Input */}
                                    <div className="mt-2 space-y-1">
                                        <Label>Trigger Phrase</Label>
                                        <Input
                                            value={localSettings.wakeWord || 'Computer'}
                                            onChange={(e: any) => handleChange('wakeWord', e.target.value)}
                                            placeholder="e.g. Computer, Jarvis..."
                                            className="text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Command Transcription Model</Label>
                                    <select
                                        value={localSettings.transcriptionProvider || 'native'}
                                        onChange={(e) => handleChange('transcriptionProvider', e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded p-1.5 text-white text-xs font-mono focus:border-blue-500/50 outline-none"
                                    >
                                        <option value="groq" className="bg-neutral-900">Groq (Whisper / Recommended)</option>
                                        <option value="openai" className="bg-neutral-900">OpenAI Whisper (High Accuracy)</option>
                                        <option value="local" className="bg-neutral-900">Local Whisper</option>
                                        <option value="vosk" className="bg-neutral-900">Vosk (Offline Fallback)</option>
                                    </select>
                                    <p className="text-[10px] text-white/40">
                                        Select the AI model used to transcribe your voice commands.
                                    </p>

                                    {localSettings.transcriptionProvider === 'groq' && (
                                        <div className="mt-2 space-y-1 bg-white/5 p-2 rounded">
                                            <Label>Groq API Key (Saved)</Label>
                                            <Input
                                                type="password"
                                                value={localSettings.groqApiKey || ''}
                                                onChange={(e: any) => handleChange('groqApiKey', e.target.value)}
                                                placeholder="gsk_..."
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Microphone</Label>
                                    <select
                                        value={localSettings.inputDeviceId || 'default'}
                                        onChange={(e) => handleChange('inputDeviceId', e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded p-1.5 text-white text-xs font-mono focus:border-blue-500/50 outline-none"
                                    >
                                        <option value="default" className="bg-neutral-900">Default</option>
                                        {audioDevices.map(device => (
                                            <option key={device.deviceId} value={device.deviceId} className="bg-neutral-900">
                                                {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                                            </option>
                                        ))}
                                    </select>
                                </div>



                                <div className="space-y-2">
                                    <Label>Silence Timeout (Seconds): {localSettings.wakeWordTimeout || 2}s</Label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="0.5"
                                        value={localSettings.wakeWordTimeout || 2}
                                        onChange={(e) => handleChange('wakeWordTimeout', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <p className="text-[10px] text-white/40">Recording stops after this much silence.</p>
                                </div>

                                {/* Test Utilities */}
                                <div className="pt-2 border-t border-white/5 space-y-3">
                                    <Label>Audio Test</Label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={testMicrophone}
                                            className={`flex-1 p-2 rounded text-xs font-bold uppercase tracking-wider transition-colors ${isTestingMic ? 'bg-red-500/20 text-red-200' : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'}`}
                                        >
                                            {isTestingMic ? 'Stop Mic Test' : 'Test Microphone'}
                                        </button>
                                        <button
                                            onClick={testSpeaker}
                                            className="flex-1 p-2 bg-white/5 hover:bg-white/10 rounded text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white transition-colors"
                                        >
                                            Test Speaker
                                        </button>
                                    </div>
                                    {isTestingMic && (
                                        <div className="h-1 bg-white/10 rounded overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 transition-all duration-75 ease-out"
                                                style={{ width: `${micLevel}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* GENERAL TAB */}
                    {activeTab === 'general' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Run on Startup</Label>
                                <StartupToggle />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Developer Mode</Label>
                                    <p className="text-[10px] text-white/40">Show raw transcription logs in chat.</p>
                                </div>
                                <button
                                    onClick={() => handleChange('developerMode', !localSettings.developerMode)}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${localSettings.developerMode ? 'bg-amber-500' : 'bg-white/20'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${localSettings.developerMode ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="space-y-1">
                                <Label>Base Language</Label>
                                <select
                                    value={localSettings.targetLanguage || 'Japanese'}
                                    onChange={(e) => handleChange('targetLanguage', e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-white text-xs font-mono focus:border-blue-500/50 outline-none"
                                >
                                    {supportedLanguages.map(lang => (
                                        <option key={lang} value={lang} className="bg-neutral-900">{lang}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <Label>Appearance (Theme Color)</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={localSettings.themeColor || '#ef4444'}
                                        onChange={(e) => handleChange('themeColor', e.target.value)}
                                        className="h-6 w-6 rounded cursor-pointer bg-transparent border-none"
                                    />
                                    <span className="text-xs text-white/70 font-mono">{localSettings.themeColor}</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>Log Directory</Label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-white/5 border border-white/10 rounded p-1.5 text-[10px] font-mono text-white/70 truncate">
                                        {localSettings.logDirectory || 'Default'}
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (window.electronAPI) {
                                                const path = await window.electronAPI.selectDirectory();
                                                if (path) {
                                                    const success = await window.electronAPI.setLogDirectory(path);
                                                    if (success) handleChange('logDirectory', path);
                                                }
                                            }
                                        }}
                                        className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold transition-colors"
                                    >
                                        CHANGE
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-3 border-t border-white/10 flex justify-between items-center bg-black/20">
                    <span className="text-[10px] text-white/30 font-mono">v{appVersion}</span>
                    <button onClick={onClose} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold tracking-wider transition-colors">
                        CLOSE
                    </button>
                </div>

            </div>

        </div >

    );
};

// UI Components for Settings
function TabButton({ id, label, icon, active, onClick }: { id: string, label: string, icon: React.ReactNode, active: string, onClick: (id: any) => void }) {
    return (
        <button
            onClick={() => onClick(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold tracking-wider transition-all border-b-2 ${active === id ? 'border-blue-500 text-white bg-white/5' : 'border-transparent text-white/40 hover:text-white/70 hover:bg-white/5'}`}
        >
            {icon} {label}
        </button>
    );
}

function ProviderButton({ id, label, color, current, onClick }: { id: string, label: string, color: string, current: string, onClick: (id: string) => void }) {
    const isSelected = current === id;
    const bg = isSelected ? `bg-${color}-500` : 'bg-white/5 hover:bg-white/10 text-white/50';
    return (
        <button
            onClick={() => onClick(id)}
            className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-colors ${isSelected ? 'text-white' : ''} ${bg}`}
            style={isSelected ? { backgroundColor: color === 'blue' ? '#3b82f6' : color === 'purple' ? '#a855f7' : color === 'green' ? '#22c55e' : '#f97316' } : {}}
        >
            {label}
        </button>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">{children}</label>;
}

function Input({ className, ...props }: any) {
    return (
        <input
            className={`w-full bg-white/5 border border-white/10 rounded p-1.5 text-white text-xs font-mono focus:border-white/30 outline-none transition-colors ${className || ''}`}
            {...props}
        />
    );
}

function SettingsIcon({ tab }: { tab: string }) {
    if (tab === 'ai') return <Cpu size={14} className="text-blue-400" />;
    if (tab === 'speech') return <Volume2 size={14} className="text-yellow-400" />;
    if (tab === 'audio') return <Mic size={14} className="text-red-400" />;
    if (tab === 'skin') return <Layers size={14} className="text-purple-400" />;
    return <Monitor size={14} className="text-green-400" />;
}
