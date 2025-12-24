import { useState, useEffect, useRef } from 'react';

// Types for internal model data
interface AvatarLayerMap {
    base?: string;
    mouthOpen?: string;
    mouthClosed?: string;
    eyesClosed?: string;
    mouthOpenEyesClosed?: string;
    isSleep?: boolean;
}

interface AvatarData {
    assetsRoot: string;
    mapping: Record<string, AvatarLayerMap>;
    width?: number;
    height?: number;
    anchorX?: number;
    anchorY?: number;
}

interface AvatarRendererProps {
    avatarData: AvatarData | null;
    isSpeaking: boolean;
    scale: number;
    position: { x: number; y: number };
    visible: boolean;
    onPositionChange?: (pos: { x: number; y: number }) => void;
    draggableWindow?: boolean;
    onImageLoaded?: (dimensions: { width: number; height: number }) => void;
    onActivity?: () => void;
    isThinking?: boolean;
    isSleeping?: boolean;
}

export const AvatarRenderer = ({
    avatarData,
    isSpeaking,
    scale,
    position,
    visible,
    onPositionChange,
    draggableWindow,
    onImageLoaded,
    onActivity,
    isThinking,
    isSleeping,
    debugPattern,
    autoBlink = true,
    avatarId,
    onDragDelta
}: AvatarRendererProps & {
    developerMode?: boolean;
    debugPattern?: string | null;
    onActivity?: () => void;
    autoBlink?: boolean;
    avatarId?: string;
    onDragDelta?: (dx: number, dy: number) => void;
}) => {

    // State
    const [blinkState, setBlinkState] = useState<'open' | 'closed'>('open');
    const [currentPattern, setCurrentPattern] = useState<string>('idle.neutral');
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Mouth Modulation State
    const [mouthOpenState, setMouthOpenState] = useState(false);
    const isSpeakingRef = useRef(isSpeaking);

    // Update ref
    useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

    // Blink Logic (standard)
    useEffect(() => {
        if (!visible || !avatarData || isThinking || isSleeping || !autoBlink) return;

        let timeoutId: NodeJS.Timeout;
        const blinkLoop = () => {
            // 30fps frames: ~3 seconds (90 frames)
            const minMs = 80 * 33.33; // ~2666ms
            const maxMs = 120 * 33.33; // ~4000ms
            const nextBlink = Math.random() * (maxMs - minMs) + minMs;

            timeoutId = setTimeout(() => {
                // Determine single or double blink
                const isDouble = Math.random() < 0.2; // 20% chance

                const performBlink = () => {
                    setBlinkState('closed');
                    setTimeout(() => {
                        setBlinkState('open');

                        if (isDouble) {
                            setTimeout(() => {
                                setBlinkState('closed');
                                setTimeout(() => {
                                    setBlinkState('open');
                                    blinkLoop();
                                }, 100);
                            }, 100); // Short interval between blinks
                        } else {
                            blinkLoop();
                        }
                    }, 150); // Blink duration
                };

                performBlink();
            }, nextBlink);
        };
        blinkLoop();
        return () => clearTimeout(timeoutId);
    }, [visible, avatarData, isThinking, isSleeping, autoBlink]);

    // Speech Modulation & Random Expressions
    useEffect(() => {
        if (!isSpeaking) {
            setMouthOpenState(false);
            if (!isThinking) setCurrentPattern('idle.neutral'); // Reset to neutral if just stopped
            return;
        }

        const interval = setInterval(() => {
            // Modulate mouth state (simulate clauses/syllables)
            // Randomly close for short periods
            if (Math.random() > 0.7) {
                setMouthOpenState(false);
            } else {
                setMouthOpenState(true);
            }

            // Randomly change expression (rarely)
            if (Math.random() > 0.95) {
                // Pick random key from mapping that starts with 'idle.'
                if (avatarData && avatarData.mapping) {
                    const keys = Object.keys(avatarData.mapping).filter(k => k.startsWith('idle.'));
                    if (keys.length > 0) {
                        const randomKey = keys[Math.floor(Math.random() * keys.length)];
                        setCurrentPattern(randomKey);
                    }
                }
            } else if (Math.random() > 0.95) {
                // Reset to neutral occasionally
                setCurrentPattern('idle.neutral');
            }

        }, 120); // Check every 120ms or so

        return () => clearInterval(interval);
    }, [isSpeaking, avatarData, isThinking]);

    // Drag Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        // Signal activity to parent (wake from sleep)
        if (onActivity) onActivity();

        if (draggableWindow) return; // Window handles drag
        if ((e.target as HTMLElement).closest('.debug-ui')) return; // Allow interaction with debug UI

        if (e.button !== 0) return; // Left click only
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        // JS Drag Delta mode (for moving window)
        if (onDragDelta) {
            onDragDelta(e.movementX, e.movementY);
            return;
        }

        // Standard props position update
        if (onPositionChange) {
            onPositionChange({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);


    // Modulate blink to be open if no avatar data
    // ... (existing blink logic above)

    // Costume & Reload State
    const [imageVersion, setImageVersion] = useState(0);
    const [activeBinds, setActiveBinds] = useState<number[]>([]);

    // Load initial Binds
    useEffect(() => {
        if (!avatarId) return;

        const loadBinds = async () => {
            const storageKey = `ukagaka_binds_${avatarId}`;
            const stored = localStorage.getItem(storageKey);

            if (stored) {
                try {
                    setActiveBinds(JSON.parse(stored));
                    return;
                } catch (e) {
                    console.error('Failed to parse stored binds', e);
                }
            }

            // Fallback to defaults
            try {
                const costumes = await window.electronAPI.getUkagakaCostumes(avatarId);
                const defaults = costumes.filter((c: any) => c.default).map((c: any) => c.id);
                setActiveBinds(defaults);
            } catch (e) {
                console.error('Failed to fetch costumes', e);
            }
        };

        loadBinds();
    }, [avatarId]);

    // Listeners for Costume Changes
    useEffect(() => {
        if (!window.electronAPI) return;

        const removeCostumeListener = window.electronAPI.onCostumeChanged((newBinds) => {
            setActiveBinds(newBinds);
            if (avatarId) {
                localStorage.setItem(`ukagaka_binds_${avatarId}`, JSON.stringify(newBinds));
            }
        });

        const removeReloadListener = window.electronAPI.onReloadAvatarImage(() => {
            console.log('Reloading avatar image...');
            setImageVersion(v => v + 1);
        });

        return () => {
            removeCostumeListener();
            removeReloadListener();
        };
    }, [avatarId]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (avatarId && window.electronAPI.showCostumeMenu) {
            window.electronAPI.showCostumeMenu(avatarId, activeBinds);
        }
    };


    if (!visible || !avatarData) return null;

    // Resolve Image
    let displayPattern = debugPattern || currentPattern;
    // ... (thinking/sleeping override logic)
    if (!debugPattern && isThinking && !isSpeaking) {
        const thinkingKeys = Object.keys(avatarData.mapping).filter(k => k.includes('think'));
        if (thinkingKeys.length > 0) {
            displayPattern = thinkingKeys[0];
        } else {
            displayPattern = 'idle.neutral';
        }
    } else if (!debugPattern && isSleeping && !isSpeaking) {
        const sleepKeys = Object.keys(avatarData.mapping).filter(k => k.includes('sleep'));
        if (sleepKeys.length > 0) {
            displayPattern = sleepKeys[0];
        }
    }

    const mapping = avatarData.mapping[displayPattern] || Object.values(avatarData.mapping)[0];
    if (!mapping) return null;

    // Helper
    const getPath = (key: string) => {
        if (!mapping) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assetPath = (mapping as any)[key];
        if (!assetPath) return null;

        // Use ID if available, otherwise fallback to 'current' logic
        const id = avatarId || 'current';
        return `avatar://${id}/${assetPath}?v=${imageVersion}`;
    };

    // ... (image resolution logic)
    // Fallback logic SAME as before but using updated getPath
    let imageUrl = getPath('base');
    if (!imageUrl && mapping) {
        for (const key of ['mouthClosed', 'mouthOpen', 'eyesClosed', 'mouthOpenEyesClosed'] as const) {
            const p = getPath(key);
            if (p) {
                imageUrl = p;
                break;
            }
        }
    }

    const effectiveBlinkState = (isThinking && !isSpeaking) || (isSleeping && !isSpeaking) ? 'closed' : blinkState;
    const effectiveMouthOpen = isSpeaking ? (mouthOpenState) : false;

    if (effectiveMouthOpen) {
        if (effectiveBlinkState === 'closed') {
            imageUrl = getPath('mouthOpenEyesClosed') || getPath('mouthOpen') || imageUrl;
        } else {
            imageUrl = getPath('mouthOpen') || imageUrl;
        }
    } else {
        if (effectiveBlinkState === 'closed') {
            imageUrl = getPath('eyesClosed') || imageUrl;
        } else {
            imageUrl = getPath('mouthClosed') || imageUrl;
        }
    }

    const containerStyle: React.CSSProperties = draggableWindow ? {
        position: 'relative',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        cursor: 'default'
    } : {
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        cursor: isDragging ? 'grabbing' : 'grab'
    };

    return (
        <div
            className={`z-0 pointer-events-auto select-none ${!draggableWindow ? 'fixed' : ''}`}
            style={containerStyle}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
        >
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt="Avatar"
                    className="max-w-none pointer-events-none"
                    draggable={false}
                    onLoad={(e) => {
                        if (onImageLoaded) {
                            onImageLoaded({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
                        }
                    }}
                />
            ) : null}
        </div>
    );
};
