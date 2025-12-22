import { useState, useEffect, useRef } from 'react';

// Types for internal model data
interface AvatarLayerMap {
    base?: string;
    mouthOpen?: string;
    mouthClosed?: string;
    eyesClosed?: string;
    mouthOpenEyesClosed?: string;
}

interface AvatarData {
    assetsRoot: string;
    mapping: Record<string, AvatarLayerMap>;
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
    isThinking?: boolean;
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
    isThinking
}: AvatarRendererProps) => {

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
        if (!visible || !avatarData || isThinking) return; // Stop blinking if thinking? Or close eyes.
        let timeoutId: NodeJS.Timeout;
        const blinkLoop = () => {
            const nextBlink = Math.random() * 4000 + 2000;
            timeoutId = setTimeout(() => {
                setBlinkState('closed');
                setTimeout(() => {
                    setBlinkState('open');
                    blinkLoop();
                }, 150); // Blink duration
            }, nextBlink);
        };
        blinkLoop();
        return () => clearTimeout(timeoutId);
    }, [visible, avatarData, isThinking]);

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
        if (draggableWindow) return; // Window handles drag
        if (e.button !== 0) return; // Left click only
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !onPositionChange) return;
        onPositionChange({
            x: e.clientX - dragOffset.current.x,
            y: e.clientY - dragOffset.current.y
        });
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


    if (!visible || !avatarData) return null;

    // Resolve Image
    let displayPattern = currentPattern;
    if (isThinking && !isSpeaking) {
        // Find a thinking pattern if possible, else close eyes
        const thinkingKeys = Object.keys(avatarData.mapping).filter(k => k.includes('think'));
        if (thinkingKeys.length > 0) {
            displayPattern = thinkingKeys[0];
        } else {
            displayPattern = 'idle.neutral'; // Fallback to neutral but force eyes closed via logic below
        }
    }

    const mapping = avatarData.mapping[displayPattern] || Object.values(avatarData.mapping)[0];
    if (!mapping) return null;

    // Helper
    const getPath = (key: keyof AvatarLayerMap) => {
        if (!mapping) return '';
        const relPath = mapping[key];
        if (!relPath) return undefined;
        return `avatar://current/${relPath}`;
    };

    let imageUrl = getPath('base'); // Default

    const effectiveBlinkState = (isThinking && !isSpeaking) ? 'closed' : blinkState;
    const effectiveMouthOpen = isSpeaking ? (mouthOpenState) : false; // If speaking, use modulated state.

    if (effectiveMouthOpen) {
        if (effectiveBlinkState === 'closed') {
            imageUrl = getPath('mouthOpenEyesClosed') || getPath('mouthOpen') || getPath('base');
        } else {
            imageUrl = getPath('mouthOpen') || getPath('base');
        }
    } else {
        if (effectiveBlinkState === 'closed') {
            imageUrl = getPath('eyesClosed') || getPath('base');
        } else {
            imageUrl = getPath('mouthClosed') || getPath('base');
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
        >
            {imageUrl && (
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
            )}
        </div>
    );
};
