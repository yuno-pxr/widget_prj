import { useState, useEffect, useRef } from 'react'
import { Settings } from 'lucide-react';
import { aiService } from './services/aiService';
import { evaluateMath } from './utils/calculator';

import * as Vosk from 'vosk-browser';
import { Header } from './components/Header';
import { InputArea } from './components/InputArea';
import { HistoryList, type HistoryItem } from './components/HistoryList';
import { SettingsModal } from './components/SettingsModal';
import { DateDisplay } from './components/DateDisplay';
import { AvatarRenderer } from './components/AvatarRenderer';

function App() {
  // Check for Avatar Mode
  const searchParams = new URLSearchParams(window.location.search);
  const isAvatarMode = searchParams.get('mode') === 'avatar';

  const [inputText, setInputText] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'clipboard' | 'transcription'>('chat');
  const historyEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isClipboardEnabled, setIsClipboardEnabled] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  // Settings State
  const [apiKey, setApiKey] = useState('') // Legacy/Fallback
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [geminiModelName, setGeminiModelName] = useState('gemini-3-flash-preview');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  const [themeColor, setThemeColor] = useState('#ef4444');
  const [logDirectory, setLogDirectory] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'local' | 'openai'>('gemini');
  const [localBaseUrl, setLocalBaseUrl] = useState('http://localhost:11434/v1');
  const [localModelName, setLocalModelName] = useState('llama3');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [openaiModelName, setOpenaiModelName] = useState('gpt-5.2');
  const [targetLanguage, setTargetLanguage] = useState('Japanese');
  const [skinId, setSkinId] = useState('default');
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [additionalPrompt, setAdditionalPrompt] = useState('');

  // TTS Settings
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<'browser' | 'openai' | 'voicevox'>('browser');
  const [ttsVoice, setTtsVoice] = useState('alloy'); // Default for OpenAI, or use index/name for others
  const [ttsSummaryPrompt, setTtsSummaryPrompt] = useState('Summarize the following text in under 400 characters for speech.');
  const [ttsSummaryThreshold, setTtsSummaryThreshold] = useState(400);

  // Audio/Voice Settings
  const [inputDeviceId, setInputDeviceId] = useState('default');
  const [wakeWord, setWakeWord] = useState('ニコ');
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [wakeWordTimeout, setWakeWordTimeout] = useState(2); // Seconds
  const [transcriptionProvider, setTranscriptionProvider] = useState<'native' | 'openai' | 'local' | 'vosk' | 'groq'>('vosk');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voskModelRef = useRef<Vosk.Model | null>(null);
  const voskRecognizerRef = useRef<Vosk.KaldiRecognizer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const voskLastPartialRef = useRef<string>("");
  const debugAudioChunks = useRef<Float32Array[]>([]);
  const lastRmsLog = useRef<number>(0);
  const [isSpeaking, setIsSpeaking] = useState(false); // For Conditional Stop Button

  // Refs for stale closure prevention
  const ttsEnabledRef = useRef(ttsEnabled);
  const ttsProviderRef = useRef(ttsProvider);
  const ttsSummaryPromptRef = useRef(ttsSummaryPrompt);
  const ttsSummaryThresholdRef = useRef(ttsSummaryThreshold);
  const lastAutoScaledPath = useRef<string | null>(null);

  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  useEffect(() => {
    ttsProviderRef.current = ttsProvider;
  }, [ttsProvider]);

  useEffect(() => {
    ttsSummaryPromptRef.current = ttsSummaryPrompt;
  }, [ttsSummaryPrompt]);

  useEffect(() => {
    ttsSummaryThresholdRef.current = ttsSummaryThreshold;
  }, [ttsSummaryThreshold]);
  const [developerMode, setDeveloperMode] = useState(false);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);

  const [appVersion, setAppVersion] = useState('0.10.5');

  const isClipboardEnabledRef = useRef(isClipboardEnabled);

  // Avatar Settings State (Shared)
  const [avatarData, setAvatarData] = useState<any>(null);
  const [avatarVisible, setAvatarVisible] = useState(false);
  const [avatarScale, setAvatarScale] = useState(1);
  const [avatarPosition, setAvatarPosition] = useState({ x: 0, y: 0 });
  const [avatarPath, setAvatarPath] = useState('');
  const [currentAvatarId, setCurrentAvatarId] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isThinking, setIsThinking] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepTimeout, setSleepTimeout] = useState(30000); // Default 30s
  const [alwaysOnTop, setAlwaysOnTop] = useState(true); // Default true
  const [autoBlink, setAutoBlink] = useState(true); // Default true
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Wake up avatar when speaking (TTS)
  useEffect(() => {
    if (isSpeaking && isSleeping) {
      setIsSleeping(false);
      resetIdleTimer();
    }
  }, [isSpeaking, isSleeping]);


  // Update ref when state changes
  useEffect(() => {
    isClipboardEnabledRef.current = isClipboardEnabled;
  }, [isClipboardEnabled]);

  const loadAvatar = async (path: string) => {
    try {
      if (window.electronAPI && window.electronAPI.loadAvatar) {
        const result = await window.electronAPI.loadAvatar(path);
        if (result) {
          setAvatarData(result.modelData);
          setCurrentAvatarId(result.avatarId);
        }
      }
    } catch (e) {
      console.error("Failed to load avatar:", e);
    }
  };

  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // --- Avatar Mode Logic ---
  useEffect(() => {
    if (isAvatarMode) {
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';

      // Listen for updates from Main Window
      const removeListener = window.electronAPI.onAvatarStateUpdate((state: any) => {
        if (state.path && state.path !== avatarPath) {
          setAvatarPath(state.path);
          loadAvatar(state.path); // Function needs to be lifted or available
        }
        if (state.visible !== undefined) setAvatarVisible(state.visible);
        if (state.scale !== undefined) setAvatarScale(state.scale);
        if (state.isSpeaking !== undefined) setIsSpeaking(state.isSpeaking);
      });

      // Fetch initial state
      window.electronAPI.getAvatarState().then((state: any) => {
        if (state) {
          if (state.path) { setAvatarPath(state.path); loadAvatar(state.path); }
          if (state.visible !== undefined) setAvatarVisible(state.visible);
          if (state.scale !== undefined) setAvatarScale(state.scale);
          if (state.isSpeaking !== undefined) setIsSpeaking(state.isSpeaking);
          if (state.isThinking !== undefined) setIsThinking(state.isThinking);
          if (state.developerMode !== undefined) setDeveloperMode(state.developerMode);
        }
      }).catch(console.error);

      return removeListener;
    } else {
      // Main Window: Broadcast updates
      // We defer this until after settings load
    }
  }, [isAvatarMode, avatarPath]);

  // Sync state to Avatar Window (Only if Main Window)
  useEffect(() => {
    if (!isAvatarMode && window.electronAPI.updateAvatarState) {
      window.electronAPI.updateAvatarState({
        path: avatarPath,
        visible: avatarVisible,
        scale: avatarScale,
        isSpeaking: isSpeaking,
        isThinking: isThinking
      });
    }
  }, [avatarPath, avatarVisible, avatarScale, isSpeaking, isThinking, isAvatarMode]);




  useEffect(() => {
    // Load default avatar if exists (async)
    // We only do this if no avatar is loaded? 
    // Or if settings say "load default".
    // For now, let's try to load 'src/assets/meimei.emgl' if we can resolve it.
    // Since we are in production/electron, we might need a path relative to valid resource.
    const loadDefault = async () => {
      if (window.electronAPI) {
        // In dev, we might know the path. In prod, it's harder.
        // We'll skip auto-load for now unless we have a path stored in settings.
      }
    };
    loadDefault();
  }, []);

  useEffect(() => {
    // Load settings - Run ONCE on mount
    if (window.electronAPI) {
      // Ensure any previous TTS is cancelled on startup
      if (window.speechSynthesis) window.speechSynthesis.cancel();

      window.electronAPI.getSettings().then(settings => {
        if (window.electronAPI.log) window.electronAPI.log(`Settings loaded: ${JSON.stringify(settings)}`);
        if (settings) {
          setApiKey(settings.apiKey || '');
          setGeminiApiKey(settings.geminiApiKey || '');
          setGeminiModelName(settings.geminiModelName || 'gemini-3-flash-preview');
          setGroqApiKey(settings.groqApiKey || '');
          setOpenaiApiKey(settings.openaiApiKey || '');

          setIsClipboardEnabled(settings.isClipboardEnabled !== undefined ? settings.isClipboardEnabled : true);
          if (settings.themeColor) setThemeColor(settings.themeColor);
          if (settings.targetLanguage) setTargetLanguage(settings.targetLanguage);
          if (settings.skinId) setSkinId(settings.skinId);
          if (settings.systemPrompt) setSystemPrompt(settings.systemPrompt);
          if (settings.additionalPrompt) setAdditionalPrompt(settings.additionalPrompt);

          if (settings.ttsEnabled !== undefined) setTtsEnabled(settings.ttsEnabled);
          if (settings.ttsProvider) setTtsProvider(settings.ttsProvider);
          if (settings.ttsVoice) setTtsVoice(settings.ttsVoice);
          if (settings.ttsSummaryPrompt) setTtsSummaryPrompt(settings.ttsSummaryPrompt);
          if (settings.ttsSummaryThreshold !== undefined) setTtsSummaryThreshold(settings.ttsSummaryThreshold);

          if (settings.inputDeviceId) setInputDeviceId(settings.inputDeviceId);
          if (settings.wakeWord) setWakeWord(settings.wakeWord);
          if (settings.voiceInputEnabled !== undefined) setVoiceInputEnabled(settings.voiceInputEnabled);
          if (settings.transcriptionProvider) setTranscriptionProvider(settings.transcriptionProvider);
          if (settings.wakeWordTimeout) setWakeWordTimeout(settings.wakeWordTimeout);
          if (settings.developerMode !== undefined) setDeveloperMode(settings.developerMode);


          // Avatar Settings
          if (settings.avatarVisible !== undefined) setAvatarVisible(settings.avatarVisible);
          if (settings.avatarScale !== undefined) setAvatarScale(settings.avatarScale);
          if (settings.avatarPosition) setAvatarPosition(settings.avatarPosition);
          if (settings.sleepTimeout !== undefined) setSleepTimeout(settings.sleepTimeout);
          if (settings.alwaysOnTop !== undefined) setAlwaysOnTop(settings.alwaysOnTop);
          if (settings.autoBlink !== undefined) setAutoBlink(settings.autoBlink);
          if (settings.avatarPath && window.electronAPI.loadAvatar) {
            window.electronAPI.loadAvatar(settings.avatarPath)
              .then(data => setAvatarData(data))
              .catch(err => console.error("Failed to load saved avatar:", err));
          }

          if (settings.provider) setProvider(settings.provider);

          // AI Settings
          setProvider(settings.provider || 'gemini');

          setLocalBaseUrl(settings.localBaseUrl || 'http://localhost:11434/v1');
          setLocalModelName(settings.localModelName || 'llama3');
          setOpenaiBaseUrl(settings.openaiBaseUrl || 'https://api.openai.com/v1');
          setOpenaiModelName(settings.openaiModelName || 'gpt-5.2');

          // Initialize AI Service
          aiService.updateSettings(settings);

          // Load Skin via Context if we could access it here
          if (window.electronAPI.loadSkin && settings.skinId) {
            window.electronAPI.loadSkin(settings.skinId);
          }
        }
      });

      window.electronAPI.getLogDirectory().then(dir => setLogDirectory(dir));
      // Get version
      window.electronAPI.getAppVersion().then(setAppVersion);

      // Load history
      window.electronAPI.getHistory().then(initialHistory => {
        if (initialHistory && initialHistory.length > 0) {
          const migratedHistory = initialHistory.map((item: any) => ({
            ...item,
            category: item.category || (item.type === 'clipboard' ? 'clipboard' : 'chat')
          }));
          setHistory(migratedHistory);
        }
      });
    }
  }, []); // Run once

  // Clipboard Listener
  useEffect(() => {
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onClipboardUpdated((newItem) => {
        if (!isClipboardEnabledRef.current) return;

        setHistory(prev => {
          if (prev.some(p => p.id === newItem.id || (p.content === newItem.content && p.type === 'clipboard'))) {
            return prev;
          }
          const itemWithCategory: HistoryItem = {
            ...newItem,
            category: 'clipboard',
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9)
          };
          handleAutoProcess(itemWithCategory.content);
          return [...prev, itemWithCategory];
        });
      });
      return () => cleanup();
    }
  }, []);

  // Save Settings when changed
  useEffect(() => {
    if (window.electronAPI) {
      const settingsToSave = {
        apiKey,
        geminiApiKey,
        geminiModelName,
        openaiApiKey,
        groqApiKey,
        isClipboardEnabled,
        themeColor,
        targetLanguage,
        skinId,
        provider,
        localBaseUrl,
        localModelName,
        openaiBaseUrl,
        openaiModelName,
        systemPrompt,
        additionalPrompt,
        ttsEnabled,
        ttsProvider,
        ttsVoice,
        ttsSummaryPrompt,
        inputDeviceId,
        wakeWord,
        voiceInputEnabled,
        transcriptionProvider,
        wakeWordTimeout,
        developerMode
      };
      window.electronAPI.saveSettings(settingsToSave);
      aiService.updateSettings(settingsToSave);
    }
  }, [apiKey, geminiApiKey, geminiModelName, openaiApiKey, groqApiKey, isClipboardEnabled, themeColor, targetLanguage, skinId, provider, localBaseUrl, localModelName, openaiBaseUrl, openaiModelName, systemPrompt, additionalPrompt, ttsEnabled, ttsProvider, ttsVoice, ttsSummaryPrompt, inputDeviceId, wakeWord, voiceInputEnabled, transcriptionProvider, wakeWordTimeout, developerMode]); // Added new dependencies

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, activeTab]);

  useEffect(() => {
    if (!isProcessing && activeTab === 'chat' && !showSettings) {
      if (document.hasFocus()) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 10);
      }
    }
  }, [isProcessing, activeTab, showSettings]);

  useEffect(() => {
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onFocusInput(() => {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      });
      return cleanup;
    }
  }, []);

  // Voice Recognition Logic
  useEffect(() => {
    // Only run if supported and enabled
    // Only run if supported and enabled AND using native provider
    if (!('webkitSpeechRecognition' in window)) {
      return;
    }

    if (!voiceInputEnabled || transcriptionProvider !== 'native') {
      // Stop native if it was running? The cleanup does that.
      // This ensures we don't hog the mic if using Vosk/OpenAI
      return;
    }

    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = targetLanguage === 'Japanese' ? 'ja-JP' : (targetLanguage === 'English' ? 'en-US' : 'en-US'); // Dynamic language based on target

    recognition.onstart = () => {
      console.log("Voice recognition started. Listening for wake word:", wakeWord);
    };

    recognition.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const transcript = event.results[lastResultIndex][0].transcript.trim();
      const isFinal = event.results[lastResultIndex].isFinal;

      // Log to Transcription Tab (if final)
      if (transcript && isFinal) {
        setHistory(prev => [...prev, {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          type: 'system',
          content: transcript,
          timestamp: new Date().toISOString(),
          category: 'transcription',
          isMasked: false
        }]);
      }

      // Developer Mode Logging
      if (developerMode && transcript && isFinal && !isProcessing) {
        setHistory(prev => [...prev, {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          type: 'system',
          content: `[🎤 DEBUG]: ${transcript}`,
          timestamp: new Date().toISOString(),
          category: 'chat',
          isMasked: true
        }]);
      }

      if (transcript.toLowerCase().includes(wakeWord.toLowerCase())) {
        console.log("Wake word detected!");
        if (window.electronAPI) window.electronAPI.log(`Wake word detected: ${transcript}`);

        setIsWakeWordActive(true);
        setTimeout(() => setIsWakeWordActive(false), 2000);

        // Extract command (naive approach: everything after wake word?)
        // Or just send whole thing? The previous code did substring.
        // Let's keep strict substring if it starts with it?
        // But user might say "Hey Computer do X".
        // Let's use includes check but extract optimally.

        // Use logic consistent with previous implementation: 
        const lowerTranscript = transcript.toLowerCase();
        const lowerWakeWord = wakeWord.toLowerCase();
        const wakeWordIndex = lowerTranscript.indexOf(lowerWakeWord);

        if (wakeWordIndex !== -1) {
          const command = transcript.substring(wakeWordIndex + wakeWord.length).trim();
          if (command) {
            handleExecute(command, true);
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
    };

    recognition.onend = () => {
      // Restart if strictly infinite listening desired
      // But check if we are still enabled. 
      // In this useEffect closure, 'voiceInputEnabled' is true.
      // But if effect cleanup ran, 'recognition.onend' might still fire.
      // Simple restart:
      try {
        recognition.start();
      } catch (e) {
        // ignore
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
    }

    return () => {
      recognition.onend = null; // Prevent restart loop
      recognition.stop();
    };
  }, [wakeWord, voiceInputEnabled, transcriptionProvider]); // Re-run if wakeWord, enabled status, or provider changes

  const handleAutoProcess = async (text: string) => {
    if (!text.trim()) return;

    const urlRegex = /^(http|https):\/\/[^ "]+$/;
    if (urlRegex.test(text)) {
      try {
        if (window.electronAPI) {
          const metadata = await window.electronAPI.fetchUrlMetadata(text);
          const content = `[URL] ${text}\n${metadata.title ? `Title: ${metadata.title}` : ''}${metadata.description ? `\nDescription: ${metadata.description}` : ''}`;
          const responseItem: HistoryItem = {
            id: Date.now().toString(),
            type: 'system',
            content: content.trim(),
            timestamp: new Date().toISOString(),
            category: 'clipboard'
          };
          setHistory(prev => [...prev, responseItem]);
          if (window.electronAPI) {
            window.electronAPI.addHistory(responseItem);
          }
        }
      } catch (error) {
        console.error("Failed to fetch URL metadata:", error);
      }
      return;
    }

    // Auto check if we should translate
    const effectiveKey = provider === 'gemini' ? (geminiApiKey || apiKey) : (provider === 'openai' ? openaiApiKey : 'local');
    if (!aiService.hasKey() && provider !== 'local' && !effectiveKey) {
      return;
    }

    try {
      const smartTranslatePrompt = `
You are a translator.
Target Language: ${targetLanguage}
Input: "${text}"
Instruction: If the input is already in ${targetLanguage}, output "NO_TRANSLATION_NEEDED". Otherwise, translate it to ${targetLanguage}.
`;
      const result = await aiService.generateText(smartTranslatePrompt);

      if (!result.includes("NO_TRANSLATION_NEEDED")) {
        const responseItem: HistoryItem = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          type: 'response',
          content: `Translated: ${result}`,
          timestamp: new Date().toISOString(),
          category: 'clipboard'
        };
        setHistory(prev => [...prev, responseItem]);
      }
    } catch (error: any) {
      console.error("Auto-translation failed:", error);
    }
  };



  // Vosk Lifecycle Management (Continuous Background for Wake Word)
  useEffect(() => {
    // Run if voice input is enabled (Regardless of Transcription Provider)
    if (!voiceInputEnabled) {
      // Cleanup if switching away
      if (voskRecognizerRef.current) {
        try {
          audioContextRef.current?.close();
          processorRef.current?.disconnect();
          sourceRef.current?.disconnect();
        } catch (e) { console.error("Vosk Cleanup Error", e); }
        voskRecognizerRef.current = null;
        audioContextRef.current = null;
        sourceRef.current = null;
        processorRef.current = null;
        if (window.electronAPI) window.electronAPI.log("Vosk Stopped (Background)");
      }
      return;
    }



    // Attempt to start Vosk
    const startVosk = async () => {
      try {
        if (window.electronAPI) window.electronAPI.log("Starting Vosk Background Listener...");

        // 1. Load Model (Singleton-ish check)
        if (!voskModelRef.current) {
          if (window.electronAPI) window.electronAPI.log("Loading Vosk Model...");
          const modelUrl = "/vosk-models/vosk-model-small-ja-0.22.zip";
          const model = await Vosk.createModel(modelUrl);
          voskModelRef.current = model;
        }

        const model = voskModelRef.current;
        if (!model) return; // Should not happen

        // 2. Setup Audio
        // Check if existing context?
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          // Already running?
          return;
        }

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: inputDeviceId && inputDeviceId !== 'default' ? { exact: inputDeviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
            sampleRate: 16000
          }
        });

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        const recognizer = new model.KaldiRecognizer(audioContext.sampleRate);
        voskRecognizerRef.current = recognizer;

        // Helper: Normalized Trigger Check
        const checkTrigger = (text: string, source: 'partial' | 'final') => {
          // Normalize: Full-width to half-width, lowercase, remove punctuation if needed
          // Simple normalization for now:
          const normalizedText = text.toLowerCase()
            .replace(/　/g, ' ')
            .replace(/[、。！？]/g, '');
          const normalizedWakeWord = wakeWord.toLowerCase()
            .replace(/　/g, ' ')
            .replace(/[、。！？]/g, '');

          if (normalizedText.includes(normalizedWakeWord)) {
            if (window.electronAPI) window.electronAPI.log(`[Vosk] Trigger Detected (${source}): "${text}"`);

            // If not already active, trigger
            if (!isWakeWordActive) {
              setIsWakeWordActive(true);

              // Trigger Hybrid Listener
              startListeningForCommand();

              // Reset recognizer to clear buffer? 
              // recognizer.reset(); // Vosk JS API might not have reset, but creates new cycle on result.
            }
            return true;
          }
          return false;
        };

        // 3. Logic: Result vs Partial
        recognizer.on("result", (message: any) => {
          const text = message.result.text;
          if (text) {
            if (window.electronAPI) window.electronAPI.log(`[Vosk] Final Result: "${text}"`);

            // Log to Transcription Tab
            setHistory(prev => [...prev, {
              id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
              type: 'system',
              content: text,
              timestamp: new Date().toISOString(),
              category: 'transcription',
              isMasked: false
            }]);

            // Execution Logic (Manual Recording)
            if (isRecordingRef.current && transcriptionProvider === 'vosk') {
              handleExecute(text, true);
            }
            // Background Mode (Wake Word)
            else if (!isRecordingRef.current) {
              checkTrigger(text, 'final');
            }
            voskLastPartialRef.current = "";
          }
        });

        recognizer.on("partialresult", (message: any) => {
          const partial = message.result.partial;
          if (partial) {
            voskLastPartialRef.current = partial;
            // Log partials occasionally or verbose mode?
            // if (window.electronAPI) window.electronAPI.log(`[Vosk] Partial: "${partial}"`);

            if (!isRecordingRef.current) {
              checkTrigger(partial, 'partial');
            }
          }
        });

        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }

          const inputData = event.inputBuffer.getChannelData(0);

          // Debug: Accumulate Audio
          if (debugAudioChunks.current.length < 500) { // Limit to ~20 seconds of chunks to save memory
            // Copy buffer
            debugAudioChunks.current.push(new Float32Array(inputData));
          }

          // Debug: RMS Calculation
          let sumSquares = 0;
          let peak = 0;
          for (let i = 0; i < inputData.length; i++) {
            const abs = Math.abs(inputData[i]);
            sumSquares += abs * abs;
            if (abs > peak) peak = abs;
          }
          const rms = Math.sqrt(sumSquares / inputData.length);

          // Log RMS every 1s (approx sampleRate/4096 = ~4 times/sec calls. 4096/16000 = 0.25s)
          // Let's log every 4 calls
          const now = Date.now();
          if (now - lastRmsLog.current > 1000) {
            console.log(`[AudioLoop] RMS: ${rms.toFixed(4)} Peak: ${peak.toFixed(4)} active: ${audioContext.state}`);
            if (window.electronAPI && developerMode) window.electronAPI.log(`[AudioLoop] RMS: ${rms.toFixed(4)} Peak: ${peak.toFixed(4)}`);
            lastRmsLog.current = now;
          }

          if (recognizer) {
            try {
              recognizer.acceptWaveform(event.inputBuffer);
            } catch (e) { console.error(e); }
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

      } catch (err) {
        console.error("Failed to start Vosk:", err);
      }
    };

    startVosk();

    // Debug Function to download WAV (Exposed to window for console use)
    // @ts-ignore
    window.downloadDebugAudio = () => {
      if (debugAudioChunks.current.length === 0) {
        console.warn("No debug audio captured");
        return;
      }
      console.log("Compiling debug audio...");
      const flattened = new Float32Array(debugAudioChunks.current.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of debugAudioChunks.current) {
        flattened.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert to WAV
      const buffer = flattened;
      const wavBuffer = new ArrayBuffer(44 + buffer.length * 2);
      const view = new DataView(wavBuffer);

      // RIFF chunk descriptor
      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + buffer.length * 2, true);
      writeString(view, 8, 'WAVE');
      // fmt sub-chunk
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, 16000, true); // SampleRate
      view.setUint32(28, 16000 * 2, true); // ByteRate
      view.setUint16(32, 2, true); // BlockAlign
      view.setUint16(34, 16, true); // BitsPerSample
      // data sub-chunk
      writeString(view, 36, 'data');
      view.setUint32(40, buffer.length * 2, true);

      // Write PCM samples
      let p = 44;
      for (let i = 0; i < buffer.length; i++) {
        let s = Math.max(-1, Math.min(1, buffer[i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(p, s, true);
        p += 2;
      }

      const blob = new Blob([view], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'debug_vosk_input.wav';
      a.click();
    };

    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // Cleanup Function for Effect
    return () => {
      if (voskRecognizerRef.current) {
        // We do NOT want to stop model between renders if possible, but React strict mode double invokes.
        // Ideally we keep it running? 
        // But if dependencies change (Device ID?), we must restart.
        try {
          audioContextRef.current?.close();
          processorRef.current?.disconnect();
          sourceRef.current?.disconnect();
        } catch (e) { }
        voskRecognizerRef.current = null;
        // Model can stay in ref
      }
    };
  }, [voiceInputEnabled, inputDeviceId, wakeWord, transcriptionProvider]); // Removed transcriptionProvider dependency restriction logic, but kept in dep array for safety if needed


  const speakText = async (text: string) => {
    // DEBUG: Trace caller
    // console.trace("speakText called");
    console.log(`speakText called. Enabled: ${ttsEnabledRef.current}, Provider: ${ttsProviderRef.current}, Text: ${text.substring(0, 50)}...`);

    if (!ttsEnabledRef.current) {
      console.log("TTS Disabled. Aborting speakText.");
      setIsThinking(false); // Unlock if TTS disabled
      return;
    }
    stopSpeaking();

    // 1. Check length
    let textToSpeak = text;
    if (text.length > ttsSummaryThresholdRef.current && ttsSummaryPromptRef.current) {
      try {
        setIsSummarizing(true);
        console.log("Respones too long for TTS, summarizing...");
        const summary = await aiService.chat(
          [{ role: 'user', content: `${ttsSummaryPromptRef.current}\n\n${text}` }],
          undefined // AbortSignal
          // We might need to ensure the model supports this.
          // For simplicity, using same AI service method.
        );
        console.log("Summary for TTS:", summary);
        if (summary) {
          textToSpeak = summary;
          if (window.electronAPI) window.electronAPI.log(`TTS: Summary generated: ${textToSpeak}`);
        }
      } catch (e) {
        console.error("Failed to summarize for TTS:", e);
        // Fallback to original text or truncated?
        // Let's fallback to original but maybe truncated?
        // For now, original.
      } finally {
        setIsSummarizing(false);
      }
    }

    setIsThinking(false); // Unlock animation as speech starts
    setIsSpeaking(true); // START SPEAKING

    if (ttsProviderRef.current === 'browser') {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      // Try to find selected voice
      //   if (ttsVoice) {
      //       const voices = window.speechSynthesis.getVoices();
      //       const selected = voices.find(v => v.name === ttsVoice || v.voiceURI === ttsVoice);
      //       if (selected) utterance.voice = selected;
      //   }

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }

    // VOICEVOX Integration
    else if (ttsProvider === 'voicevox') {
      try {
        const speakerId = ttsVoice || '1'; // Default Zundamon
        if (window.electronAPI) window.electronAPI.log(`Calling VoiceVox with Speaker ${speakerId}`);

        // 1. Audio Query
        const queryRes = await fetch(`http://localhost:50021/audio_query?speaker=${speakerId}&text=${encodeURIComponent(textToSpeak)}`, {
          method: 'POST'
        });
        if (!queryRes.ok) throw new Error("VoiceVox Query Failed");
        const queryJson = await queryRes.json();

        // 2. Synthesis
        const synthesisRes = await fetch(`http://localhost:50021/synthesis?speaker=${speakerId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryJson)
        });
        if (!synthesisRes.ok) throw new Error("VoiceVox Synthesis Failed");

        const arrayBuffer = await synthesisRes.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = (e) => {
          console.error("Audio playback error", e);
          setIsSpeaking(false);
        };
        audio.play();

      } catch (e: any) {
        console.error("VoiceVox Error:", e);
        if (window.electronAPI) window.electronAPI.log(`VoiceVox Error: ${e.message}`);
        setIsSpeaking(false);
      }
    }

    // ... (Other providers placeholder)
    else {
      // For non-browser, we assume we might implement audio playback later
      // For now, simulate async speaking or just ignore
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const handleMicClick = async () => {
    console.log("Mic Clicked. Provider:", transcriptionProvider, "VoiceInput:", voiceInputEnabled);
    if (window.electronAPI) window.electronAPI.log(`Mic Clicked. Provider: ${transcriptionProvider}`);

    // Toggle recording based on provider
    if (transcriptionProvider === 'native') {
      // Manual Mic Click for Native: One-shot recording override
      if (!('webkitSpeechRecognition' in window)) return;

      setIsRecording(true);
      // @ts-ignore
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false; // Stop after one sentence
      recognition.interimResults = false;
      recognition.lang = targetLanguage || 'en-US';

      recognition.onstart = () => {
        if (window.electronAPI) window.electronAPI.log("Manual Native Recording Started");
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }

        const isFinal = event.results[event.results.length - 1].isFinal;

        if (transcript.trim() && isFinal) {
          // Log to Transcription Tab
          setHistory(prev => [...prev, {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            type: 'system',
            content: transcript,
            timestamp: new Date().toISOString(),
            category: 'transcription',
            isMasked: false
          }]);

          // Execute
          handleExecute(transcript, true);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Manual recognition error", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => setIsRecording(false);
      recognition.start();

    } else if (transcriptionProvider === 'vosk') {
      // Toggle Recording State
      const newState = !isRecording;

      // If stopping, check for partial result to commit (Prevent lost sentence)
      if (isRecording && voskLastPartialRef.current && voskLastPartialRef.current.trim()) {
        const finalPartial = voskLastPartialRef.current.trim();
        if (window.electronAPI) window.electronAPI.log(`Vosk Manual Stop. Committing partial: ${finalPartial}`);

        setHistory(prev => [...prev, {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          type: 'system',
          content: finalPartial,
          timestamp: new Date().toISOString(),
          category: 'transcription',
          isMasked: false
        }]);

        // Execute immediately
        handleExecute(finalPartial, true);
        voskLastPartialRef.current = ""; // Clear to prevent double processing if possible
      }

      setIsRecording(newState);
      if (window.electronAPI) window.electronAPI.log(`Vosk Manual Recording toggled to: ${newState}`);

    } else {
      // OpenAI / Local (MediaRecorder)
      if (isRecording) {
        // Stop
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
      } else {
        // Start
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: inputDeviceId && inputDeviceId !== 'default' ? { exact: inputDeviceId } : undefined
            }
          });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
          };

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            // Transcribe
            try {
              setIsProcessing(true);
              let text = "";

              if (transcriptionProvider === 'groq') {
                if (!groqApiKey) throw new Error("Groq API Key is missing.");
                text = await aiService.transcribeWithGroq(groqApiKey, audioBlob);
              } else {
                text = await aiService.transcribeAudio(audioBlob);
              }

              if (text) {
                if (window.electronAPI) window.electronAPI.log(`Transcription: ${text}`);
                setHistory(prev => [...prev, {
                  id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                  type: 'system',
                  content: text,
                  timestamp: new Date().toISOString(),
                  category: 'transcription',
                  isMasked: false
                }]);
                handleExecute(text, true);
              }
            } catch (err: any) {
              console.error("Transcription failed", err);
              setHistory(prev => [...prev, {
                id: Date.now().toString(),
                type: 'system',
                content: `Transcription Error: ${err.message}`,
                timestamp: new Date().toISOString(),
                category: 'chat'
              }]);
            } finally {
              setIsProcessing(false);
              // Stop tracks
              stream.getTracks().forEach(track => track.stop());
            }
          };

          mediaRecorder.start();
          setIsRecording(true);

          // Hybrid Logic: Stop automatically after timeout IF triggered by Wake Word (implied context)
          // But here, handleMicClick is manual.
          // We need a separate function for the "Hybrid Command Listener".
        } catch (err) {
          console.error("Failed to start recording:", err);
        }
      }
    }
  };

  // HYBRID LISTENER: Records audio for (wakeWordTimeout) seconds then sends to Gemini
  const startListeningForCommand = async () => {
    try {
      if (window.electronAPI) window.electronAPI.log(`Starting Hybrid Command Listening (Timeout: ${wakeWordTimeout}s)`);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: inputDeviceId && inputDeviceId !== 'default' ? { exact: inputDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsWakeWordActive(false); // Turn off green flash

        const audioBlob = new Blob(chunks, { type: 'audio/wav' });

        // Send to AI
        try {
          if (window.electronAPI) window.electronAPI.log("Sending Audio to AI...");
          setIsProcessing(true);

          let transcript = "";
          if (transcriptionProvider === 'groq') {
            if (!groqApiKey) throw new Error("Groq API Key is missing.");
            transcript = await aiService.transcribeWithGroq(groqApiKey, audioBlob);
          } else {
            transcript = await aiService.transcribeAudio(audioBlob);
          }

          if (window.electronAPI) window.electronAPI.log(`AI Transcription: ${transcript}`);

          if (transcript && transcript.trim()) {
            // Execute the command
            handleExecute(transcript, true);
          }
        } catch (e: any) {
          console.error("Gemini Transcription Failed:", e);
          if (window.electronAPI) window.electronAPI.log(`Gemini Transcription Failed: ${e.message}`);
          setHistory(prev => [...prev, {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            type: 'system',
            content: `Transcription Error: ${e.message}`,
            timestamp: new Date().toISOString(),
            category: 'transcription',
            isMasked: false
          }]);
        } finally {
          setIsProcessing(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true); // Shows Red Pulse

      // Smart VAD (Silence Detection)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5; // Smooth out sudden peaks
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let lastVoiceTimestamp = Date.now();

      let vadInterval: NodeJS.Timeout | null = null;


      // Actually Uint8 val 0-255. 20 is quiet noise floor.
      // Let's use a dynamic approach or safe default. 
      // If we simply use "activity resets timer", we need to know what "activity" is.
      const VOICE_THRESHOLD = 30;    // Usage: if volume > 30, it's voice.

      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // If loud enough, reset silence
        if (average > VOICE_THRESHOLD) {
          lastVoiceTimestamp = Date.now();
          if (window.electronAPI && developerMode) {
            // Optional: Visual debug
            // console.log("Voice detected:", average);
          }
        }

        // Check time since last voice
        const timeSinceVoice = (Date.now() - lastVoiceTimestamp) / 1000;

        if (timeSinceVoice > wakeWordTimeout) {
          // Silence detected for longer than timeout
          if (mediaRecorder.state === 'recording') {
            console.log(`Silence detected (${timeSinceVoice.toFixed(1)}s). Stopping recording.`);
            mediaRecorder.stop();

            // Cleanup VAD
            if (vadInterval) clearInterval(vadInterval);
            microphone.disconnect();
            analyser.disconnect();
            audioContext.close();
          }
        }
      };

      // Check every 100ms
      vadInterval = setInterval(checkAudioLevel, 100);

      // Force stop max duration (e.g. 30 seconds) just in case
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          if (vadInterval) clearInterval(vadInterval);
          microphone.disconnect();
          analyser.disconnect();
          audioContext.close();
        }
      }, 30000);

    } catch (e) {
      console.error("Failed to start hybrid listener", e);
    }
  };

  // Voice Recognition Effect (Wake Word Only)
  const handleExecute = async (overrideText?: string, isVoiceCommand: boolean = false) => {
    stopSpeaking(); // Stop any current speech

    // Determine text to process
    const textToProcess = overrideText !== undefined ? overrideText : inputText;

    // Validation
    if (!textToProcess.trim()) return;

    // Retry sending key if service might be missing it (redundant with useEffect but safe)
    aiService.updateSettings({ apiKey, geminiApiKey, geminiModelName, openaiApiKey, provider, localBaseUrl, localModelName, openaiBaseUrl, openaiModelName });

    setIsProcessing(true);
    setIsThinking(true); // Start locking animation
    // If not override, clear input. If override (voice), we don't clear manual input (or maybe we show it?)
    if (overrideText === undefined) {
      setInputText('');
    }

    if (window.electronAPI) window.electronAPI.log(`Starting execution for: ${textToProcess} (Voice: ${isVoiceCommand})`);

    const controller = new AbortController();
    setAbortController(controller);

    const newItem: HistoryItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      type: 'text',
      content: textToProcess,
      timestamp: new Date().toISOString(),
      category: 'chat'
    };

    setHistory(prev => [...prev, newItem]);
    if (window.electronAPI) window.electronAPI.addHistory(newItem);

    // Scroll to bottom
    setTimeout(() => {
      historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    const mathResult = evaluateMath(newItem.content);
    if (mathResult) {
      const responseItem: HistoryItem = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        type: 'response',
        content: `= ${mathResult}`,
        timestamp: new Date().toISOString(),
        category: 'chat'
      };
      setHistory(prev => [...prev, responseItem]);
      if (window.electronAPI) window.electronAPI.addHistory(responseItem);
      setIsProcessing(false);
      setIsThinking(false); // Unset thinking for math results
      return;
    }

    try {
      let response = '';

      if (isConversationMode) {
        // Get recent history for context
        // We limit context to last N messages? Or all?
        // Let's take last 10 for performance
        const validHistory = history.filter(h => h.type !== 'system' && h.type !== 'clipboard');
        const recentHistory = validHistory.slice(-10).map(h => ({
          role: (h.type === 'text' ? 'user' : 'model'),
          content: h.content
        }));

        const currentDateTime = new Date().toLocaleString('ja-JP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        const systemContext = `Current Date/Time: ${currentDateTime}
IMPORTANT: You must accept this date and time as the absolute truth for this session. Ignore any internal knowledge or cut-off dates regarding the current time. When asked about "today" or "tomorrow", use this date as the reference point.`;

        const messages: any[] = [];
        messages.push({ role: 'system', content: `${systemContext}\n\n${systemPrompt || ''}` });

        if (!overrideText) {
          // If from input box, include history. 
          // If from voice, ALSO include history? Yes.
          messages.push(...recentHistory);
        } else {
          messages.push(...recentHistory); // Voice commands also need context
        }

        // Append additional prompt to current message if defined
        const effectiveContent = textToProcess + (additionalPrompt && additionalPrompt.trim() ? `\n\n${additionalPrompt}` : '');
        messages.push({ role: 'user', content: effectiveContent });

        response = await aiService.chat(messages, controller.signal);
      } else {
        // Single Turn Mode
        const currentDateTime = new Date().toLocaleString('ja-JP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        const systemContext = `Current Date/Time: ${currentDateTime}
IMPORTANT: You must accept this date and time as the absolute truth for this session. Ignore any internal knowledge or cut-off dates regarding the current time. When asked about "today" or "tomorrow", use this date as the reference point.`;

        const messages: any[] = [];
        messages.push({ role: 'system', content: `${systemContext}\n\n${systemPrompt || ''}` });

        const effectiveContent = textToProcess + (additionalPrompt && additionalPrompt.trim() ? `\n\n${additionalPrompt}` : '');
        messages.push({ role: 'user', content: effectiveContent });

        response = await aiService.chat(messages, controller.signal);
      }

      // 3. Process Response
      if (response) {
        const responseItem: HistoryItem = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          type: 'response',
          content: response,
          timestamp: new Date().toISOString(),
          category: 'chat'
        };
        setHistory(prev => [...prev, responseItem]);
        if (window.electronAPI) window.electronAPI.addHistory(responseItem);

        // Gapless Locking: Check for Summarization before unlocking processing
        if (ttsEnabledRef.current && response.length > ttsSummaryThresholdRef.current && ttsSummaryPromptRef.current) {
          setIsSummarizing(true); // Handover lock
        }
        setIsProcessing(false); // Release processing lock

        // Trigger TTS
        speakText(response);

      } else {
        setIsProcessing(false);
        setIsThinking(false); // Unset thinking if no response
      }


    } catch (error: any) {
      const errorItem: HistoryItem = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        type: 'system',
        content: error.message === "Request aborted" || error.message === "Request cancelled by user"
          ? 'Process cancelled by user.'
          : `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
        category: 'chat'
      };
      setHistory(prev => [...prev, errorItem]);
      setIsThinking(false); // Unlock on error
    } finally {
      setIsProcessing(false);
      setAbortController(null);
      // setIsThinking(false); // This is handled by speakText or error block
    }
  };



  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsProcessing(false);
      setIsThinking(false); // Unset thinking on manual stop
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDelete = (id: string) => {
    setHistory(prev => prev.map(item => item.id === id ? { ...item, isMasked: !item.isMasked } : item));
  };

  const handleRetry = (text: string) => {
    setInputText(text);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  const handleSummarize = async (text: string) => {
    setIsProcessing(true);
    setIsThinking(true); // Start thinking for summarization
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const prompt = `
You are a summarizer.
Target Language: ${targetLanguage}
Input Text:
"${text}"

Instruction: Summarize the input text concisely in ${targetLanguage}.
`;
      const summary = await aiService.generateText(prompt, controller.signal);

      const responseItem: HistoryItem = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        type: 'response',
        content: `Summary:\n${summary}`,
        timestamp: new Date().toISOString(),
        category: 'chat'
      };
      setHistory(prev => [...prev, responseItem]);
      if (window.electronAPI) window.electronAPI.addHistory(responseItem);

    } catch (error: any) {
      console.error("Summarization failed:", error);
    } finally {
      setIsProcessing(false);
      setIsThinking(false); // Unset thinking after summarization
      setAbortController(null);
    }
  };

  const handleClearHistory = async () => {
    setHistory([]);
  };

  const handleToggleClipboard = async () => {
    const newState = !isClipboardEnabled;
    setIsClipboardEnabled(newState);
    if (window.electronAPI) {
      await window.electronAPI.toggleClipboard(newState);
    }
  };

  const switchInstalledAvatar = async (avatarId: string) => {
    try {
      if (window.electronAPI && window.electronAPI.loadInstalledAvatar) {
        const result = await window.electronAPI.loadInstalledAvatar(avatarId);
        if (result) {
          setAvatarData(result.modelData);
          setCurrentAvatarId(result.avatarId);
          setAvatarPath(''); // Clear file path as we are using an installed ID

          // Force save settings immediately to persist the switch
          handleSettingsUpdate({
            currentAvatarId: result.avatarId,
            avatarPath: ''
          });
        }
      }
    } catch (e) {
      console.error("Failed to switch avatar:", e);
    }
  };

  const handleSettingsUpdate = (newSettings: any) => {
    if (newSettings.apiKey !== undefined) setApiKey(newSettings.apiKey);
    if (newSettings.geminiApiKey !== undefined) setGeminiApiKey(newSettings.geminiApiKey);
    if (newSettings.geminiModelName !== undefined) setGeminiModelName(newSettings.geminiModelName);
    if (newSettings.groqApiKey !== undefined) setGroqApiKey(newSettings.groqApiKey);
    if (newSettings.openaiApiKey !== undefined) setOpenaiApiKey(newSettings.openaiApiKey);
    if (newSettings.isClipboardEnabled !== undefined) setIsClipboardEnabled(newSettings.isClipboardEnabled);
    if (newSettings.themeColor !== undefined) setThemeColor(newSettings.themeColor);
    if (newSettings.provider !== undefined) setProvider(newSettings.provider);
    if (newSettings.localBaseUrl !== undefined) setLocalBaseUrl(newSettings.localBaseUrl);
    if (newSettings.localModelName !== undefined) setLocalModelName(newSettings.localModelName);
    if (newSettings.openaiBaseUrl !== undefined) setOpenaiBaseUrl(newSettings.openaiBaseUrl);
    if (newSettings.openaiModelName !== undefined) setOpenaiModelName(newSettings.openaiModelName);
    if (newSettings.targetLanguage !== undefined) setTargetLanguage(newSettings.targetLanguage);
    if (newSettings.skinId !== undefined) setSkinId(newSettings.skinId);
    if (newSettings.systemPrompt !== undefined) setSystemPrompt(newSettings.systemPrompt);
    if (newSettings.additionalPrompt !== undefined) setAdditionalPrompt(newSettings.additionalPrompt);
    if (newSettings.ttsEnabled !== undefined) setTtsEnabled(newSettings.ttsEnabled);
    if (newSettings.ttsProvider !== undefined) setTtsProvider(newSettings.ttsProvider);
    if (newSettings.ttsVoice !== undefined) setTtsVoice(newSettings.ttsVoice);
    if (newSettings.ttsSummaryPrompt !== undefined) setTtsSummaryPrompt(newSettings.ttsSummaryPrompt);
    if (newSettings.ttsSummaryThreshold !== undefined) setTtsSummaryThreshold(newSettings.ttsSummaryThreshold);
    if (newSettings.inputDeviceId !== undefined) setInputDeviceId(newSettings.inputDeviceId);
    if (newSettings.wakeWord !== undefined) setWakeWord(newSettings.wakeWord);
    if (newSettings.voiceInputEnabled !== undefined) setVoiceInputEnabled(newSettings.voiceInputEnabled);
    if (newSettings.transcriptionProvider !== undefined) setTranscriptionProvider(newSettings.transcriptionProvider);
    if (newSettings.wakeWordTimeout !== undefined) setWakeWordTimeout(newSettings.wakeWordTimeout);
    if (newSettings.developerMode !== undefined) setDeveloperMode(newSettings.developerMode);
    if (newSettings.logDirectory !== undefined) setLogDirectory(newSettings.logDirectory);

    // Avatar updates
    if (newSettings.avatarVisible !== undefined) setAvatarVisible(newSettings.avatarVisible);
    if (newSettings.avatarScale !== undefined) setAvatarScale(newSettings.avatarScale);
    if (newSettings.avatarPosition !== undefined) setAvatarPosition(newSettings.avatarPosition);
    if (newSettings.sleepTimeout !== undefined) setSleepTimeout(newSettings.sleepTimeout);
    if (newSettings.alwaysOnTop !== undefined) setAlwaysOnTop(newSettings.alwaysOnTop);
    if (newSettings.autoBlink !== undefined) setAutoBlink(newSettings.autoBlink);
    if (newSettings.avatarPath !== undefined) {
      setAvatarPath(newSettings.avatarPath);
      if (newSettings.avatarPath) {
        loadAvatar(newSettings.avatarPath);
        // Initialize auto-scale ref to prevent overwriting saved scale on startup
        lastAutoScaledPath.current = newSettings.avatarPath;
      }
    }
    // If no path but we have an ID (and it's not the default empty state), try to load by ID
    else if (newSettings.currentAvatarId && !newSettings.avatarPath) {
      if (!avatarData || currentAvatarId !== newSettings.currentAvatarId) {
        switchInstalledAvatar(newSettings.currentAvatarId);
      }
    }

    // Restore ID if saved (though loadAvatar will update it, this helps initial render if needed)
    if (newSettings.currentAvatarId !== undefined && newSettings.currentAvatarId !== currentAvatarId) {
      setCurrentAvatarId(newSettings.currentAvatarId);
    }
  };

  const handleSettingsChange = (key: string, value: any) => {
    handleSettingsUpdate({ [key]: value });
  };

  // Debug State
  const [debugPattern, setDebugPattern] = useState<string | null>(null);

  // Save settings when changed
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.saveSettings) {
      const settingsToSave = {
        apiKey, geminiApiKey, geminiModelName, groqApiKey, openaiApiKey,
        isClipboardEnabled,
        themeColor, provider,
        localBaseUrl, localModelName, openaiBaseUrl, openaiModelName,
        targetLanguage, skinId, systemPrompt, additionalPrompt,
        ttsEnabled, ttsProvider, ttsVoice, ttsSummaryPrompt, ttsSummaryThreshold,
        inputDeviceId, wakeWord, voiceInputEnabled, transcriptionProvider,
        wakeWordTimeout, developerMode, logDirectory,
        avatarVisible, avatarScale, avatarPosition, avatarPath, currentAvatarId,
        sleepTimeout, alwaysOnTop, autoBlink
      };

      const timeoutId = setTimeout(() => {
        window.electronAPI.saveSettings(settingsToSave);
      }, 1000); // 1s debounce

      return () => clearTimeout(timeoutId);
    }
  }, [
    apiKey, geminiApiKey, geminiModelName, groqApiKey, openaiApiKey,
    isClipboardEnabled, themeColor, provider,
    localBaseUrl, localModelName, openaiBaseUrl, openaiModelName,
    targetLanguage, skinId, systemPrompt, additionalPrompt,
    ttsEnabled, ttsProvider, ttsVoice, ttsSummaryPrompt, ttsSummaryThreshold,
    inputDeviceId, wakeWord, voiceInputEnabled, transcriptionProvider,
    wakeWordTimeout, developerMode, logDirectory,
    wakeWordTimeout, developerMode, logDirectory,
    avatarVisible, avatarScale, avatarPosition, avatarPath, currentAvatarId,
    sleepTimeout, alwaysOnTop, autoBlink
  ]);

  // Idle Timer Logic
  const resetIdleTimer = () => {
    setIsSleeping(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (sleepTimeout > 0 && !isSpeaking && !isThinking) {
      idleTimerRef.current = setTimeout(() => {
        setIsSleeping(true);
      }, sleepTimeout);
    }
  };

  useEffect(() => {
    // Events to reset idle
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    // Reset on state changes
    resetIdleTimer();

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('mousedown', resetIdleTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [sleepTimeout, isSpeaking, isThinking]);

  // --- Avatar Mode Logic (Effects) ---
  useEffect(() => {
    if (isAvatarMode) {
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';

      // Listen for updates from Main Window
      const removeListener = window.electronAPI.onAvatarStateUpdate((state: any) => {
        if (state.path && state.path !== avatarPath) {
          setAvatarPath(state.path);
          if (state.path) loadAvatar(state.path);
        }
        if (state.visible !== undefined) setAvatarVisible(state.visible);
        if (state.scale !== undefined) setAvatarScale(state.scale);
        if (state.isSpeaking !== undefined) setIsSpeaking(state.isSpeaking);
        if (state.isThinking !== undefined) setIsThinking(state.isThinking);
        if (state.developerMode !== undefined) setDeveloperMode(state.developerMode);

        // Sync Sleep Settings
        if (state.sleepTimeout !== undefined) setSleepTimeout(state.sleepTimeout);
        if (state.autoBlink !== undefined) setAutoBlink(state.autoBlink);
        if (state.currentAvatarId !== undefined && state.currentAvatarId !== currentAvatarId) {
          setCurrentAvatarId(state.currentAvatarId);
          switchInstalledAvatar(state.currentAvatarId);
        }
      });
      return removeListener;
    } else {
      // Main Window Listener for Avatar Scale Sync
      if (window.electronAPI.onAvatarScaleSync) {
        const removeScaleListener = window.electronAPI.onAvatarScaleSync((newScale: number) => {
          setAvatarScale(newScale);
        });
        return removeScaleListener;
      }
    }
  }, [isAvatarMode]);


  // Update Window Size on Scale Change
  useEffect(() => {
    if (isAvatarMode && imageDimensions.width > 0 && window.electronAPI.resizeAvatarWindow) {
      window.electronAPI.resizeAvatarWindow(imageDimensions.width * avatarScale, imageDimensions.height * avatarScale);
    }
  }, [avatarScale, imageDimensions, isAvatarMode]);

  // Sync state to Avatar Window (Only if Main Window)
  useEffect(() => {
    if (!isAvatarMode && window.electronAPI.updateAvatarState) {
      window.electronAPI.updateAvatarState({
        path: avatarPath,
        visible: avatarVisible,
        scale: avatarScale,
        isSpeaking: isSpeaking,
        isThinking: isThinking,
        sleepTimeout: sleepTimeout,
        autoBlink: autoBlink,
        developerMode: developerMode,
        currentAvatarId: currentAvatarId
      });
    }
  }, [avatarPath, avatarVisible, avatarScale, isSpeaking, isThinking, isAvatarMode, sleepTimeout, autoBlink, developerMode, currentAvatarId]);

  // Supplementary sync for developerMode
  useEffect(() => {
    if (!isAvatarMode && window.electronAPI.updateAvatarState) {
      window.electronAPI.updateAvatarState({
        path: avatarPath,
        visible: avatarVisible,
        scale: avatarScale,
        isSpeaking: isSpeaking,
        isThinking: isThinking,
        developerMode: developerMode
      });
    }
  }, [developerMode, isAvatarMode, avatarPath, avatarVisible, avatarScale, isSpeaking, isThinking, isSleeping, alwaysOnTop]);

  // Manage click-through for Avatar Window
  useEffect(() => {
    if (isAvatarMode && window.electronAPI.setIgnoreMouseEvents) {
      if (!avatarData || !avatarVisible || isSleeping) { // Add isSleeping to ignore mouse events
        // Transparent / No Avatar / Sleeping -> Pass clicks through
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      } else {
        // Avatar Present & Active -> Capture clicks (for drag)
        window.electronAPI.setIgnoreMouseEvents(false);
      }
    }
  }, [isAvatarMode, avatarData, avatarVisible, isSleeping]);


  // If Avatar Mode, Render ONLY Avatar (Short-circuit return)
  if (isAvatarMode) {
    return (
      <div
        className={`w-screen h-screen overflow-hidden pointer-events-auto ${developerMode ? 'border-2 border-red-500' : ''}`}
        style={{ background: 'transparent', WebkitAppRegion: 'drag' } as any}
      >
        {avatarVisible && avatarData && (
          <div className="relative">
            <AvatarRenderer
              avatarData={avatarData}
              avatarId={currentAvatarId || undefined}
              isSpeaking={isSpeaking}
              isThinking={isThinking}
              scale={avatarScale}
              position={avatarPosition}
              visible={avatarVisible}
              draggableWindow={true}
              developerMode={developerMode}
              debugPattern={debugPattern}
              onImageLoaded={(dims) => {
                setImageDimensions(dims);
                // Auto-scale if new avatar path/ID. 
                // Using currentAvatarId allows auto-scaling when switching installed avatars even if path variable is static.
                // We use avatarPath OR currentAvatarId as the identifier.
                const currentIdentifier = currentAvatarId || avatarPath;

                if (currentIdentifier && currentIdentifier !== lastAutoScaledPath.current) {
                  const targetHeight = 500;
                  // If image is very large, scale it down
                  if (dims.height > targetHeight) {
                    const newScale = parseFloat((targetHeight / dims.height).toFixed(2));
                    setAvatarScale(newScale);
                    if (window.electronAPI.syncAvatarScale) window.electronAPI.syncAvatarScale(newScale);
                  } else {
                    // Start new avatars at 1.0 if they aren't huge
                    setAvatarScale(1.0);
                    if (window.electronAPI.syncAvatarScale) window.electronAPI.syncAvatarScale(1.0);
                  }
                  lastAutoScaledPath.current = currentIdentifier;
                }
              }}
              onPositionChange={() => { }}
              isSleeping={isSleeping}
              onActivity={resetIdleTimer}
              autoBlink={autoBlink}
            />

            {/* Debug UI Overlay */}
            {/* Avatar Mode Overlay for Sleep/Hide */}
            {isAvatarMode && (
              <div
                className={`fixed top-0 left-0 w-full h-full flex items-center justify-center transition-all duration-300 ${isSleeping ? 'opacity-80 grayscale' : ''}`}
                style={{
                  WebkitAppRegion: isSleeping ? 'no-drag' : 'drag', // Allow clicks when sleeping
                } as any}
              >
                <div style={{ WebkitAppRegion: 'no-drag' } as any} className="absolute top-2 right-2 flex gap-2 z-50 opacity-0 hover:opacity-100 transition-opacity">
                  <button onClick={() => setAvatarVisible(false)} className="bg-black/50 p-1 rounded hover:bg-black/70 text-white">Hide</button>
                </div>
              </div>
            )}
            {developerMode && avatarData && (
              <div
                className="absolute top-0 left-0 bg-black/80 text-white text-[10px] p-2 rounded pointer-events-auto max-h-[80vh] overflow-y-auto z-50 m-2 custom-scrollbar border border-white/10"
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                <div className="font-bold mb-2 pb-1 border-b border-white/20">Debug: Patterns</div>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-white/10 p-1 rounded">
                    <input
                      type="radio"
                      name="pattern"
                      checked={debugPattern === null}
                      onChange={() => setDebugPattern(null)}
                      className="accent-blue-500"
                    />
                    <span className={debugPattern === null ? 'text-blue-400' : 'text-white/70'}>AUTO (Default)</span>
                  </label>
                  {Object.keys(avatarData.mapping).map(key => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-white/10 p-1 rounded">
                      <input
                        type="radio"
                        name="pattern"
                        checked={debugPattern === key}
                        onChange={() => setDebugPattern(key)}
                        className="accent-blue-500"
                      />
                      <span className={debugPattern === key ? 'text-blue-400' : 'text-white/70'}>{key}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    );
  }

  const settingsObj = {
    apiKey, geminiApiKey, geminiModelName, groqApiKey, openaiApiKey, isClipboardEnabled, themeColor, provider, localBaseUrl, localModelName, openaiBaseUrl, openaiModelName, targetLanguage, skinId, logDirectory, systemPrompt, additionalPrompt,
    ttsEnabled, ttsProvider, ttsVoice, ttsSummaryPrompt, ttsSummaryThreshold,
    inputDeviceId, wakeWord, voiceInputEnabled, transcriptionProvider, wakeWordTimeout, developerMode,
    avatarVisible, avatarScale, avatarPosition, avatarData, currentAvatarId,
    sleepTimeout, alwaysOnTop, autoBlink
  };

  return (
    <div className={`h-screen w-screen text-white overflow-hidden flex flex-col font-sans`} style={{ background: `linear-gradient(to bottom right, ${themeColor || '#ef4444'}, #000000)` }}>
      <Header
        onMinimize={() => window.electronAPI?.minimizeWindow()}
        onClose={() => window.electronAPI?.closeWindow()}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-1 bg-black/10 backdrop-blur-sm border-b border-white/5 gap-2">
        <DateDisplay />
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearHistory}
            className="p-1 hover:bg-white/10 rounded text-[10px] text-white/50 hover:text-white transition-colors uppercase tracking-wider"
            title="Clear History"
          >
            CLEAR LOG
          </button>
          <div className="w-px h-3 bg-white/10"></div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Avatar is now in a separate window, so we don't render it here */}
        <HistoryList
          history={history}
          activeTab={activeTab}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onRetry={handleRetry}
          onSummarize={handleSummarize}
        />

        <InputArea
          inputText={inputText}
          setInputText={setInputText}
          isProcessing={isProcessing}
          isSummarizing={isSummarizing}
          onExecute={() => handleExecute()}
          inputRef={inputRef}
          onStop={handleStop}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isClipboardEnabled={isClipboardEnabled}
          onToggleClipboard={handleToggleClipboard}
          isConversationMode={isConversationMode}
          setIsConversationMode={setIsConversationMode}
          onStopTTS={stopSpeaking}
          isSpeaking={isSpeaking}
          onMicClick={handleMicClick}
          isWakeWordActive={isWakeWordActive}
          isRecording={isRecording}
        />
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          settings={settingsObj}
          onSettingsChange={handleSettingsChange}
          appVersion={appVersion}
          onSelectAvatar={switchInstalledAvatar}
        />
      )}
    </div>
  )
}

export default App
