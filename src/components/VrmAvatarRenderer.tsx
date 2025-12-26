import { useState, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
// @ts-ignore
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import * as THREE from 'three';

interface InternalVRMModelProps {
    url: string;
    isSpeaking: boolean;
    setIsLoading?: (loading: boolean) => void;
}

const VRMModel = ({ url, isSpeaking, setIsLoading }: InternalVRMModelProps) => {
    const gltf = useLoader(GLTFLoader, url, (loader) => {
        loader.register((parser: any) => new VRMLoaderPlugin(parser));
    });

    const [vrm, setVrm] = useState<any>(null);

    useEffect(() => {
        if (gltf.userData.vrm) {
            const v = gltf.userData.vrm;
            VRMUtils.removeUnnecessaryVertices(gltf.scene);
            VRMUtils.combineSkeletons(gltf.scene);
            v.scene.rotation.y = Math.PI; // Face forward
            setVrm(v);
            if (setIsLoading) setIsLoading(false);
        }
    }, [gltf, setIsLoading]);

    useFrame((state, delta) => {
        if (vrm) {

            if (vrm.expressionManager) {
                // Auto Blink (Simple)
                const blinkValue = Math.sin(state.clock.elapsedTime * 2) > 0.9 ? 1 : 0;
                vrm.expressionManager.setValue('blink', blinkValue);

                // Lip Sync (Simple Volume based or explicit prop)
                if (isSpeaking) {
                    const mouthOpen = Math.sin(state.clock.elapsedTime * 20) * 0.5 + 0.5;
                    vrm.expressionManager.setValue('aa', mouthOpen);
                } else {
                    vrm.expressionManager.setValue('aa', 0);
                }
                vrm.expressionManager.update();
            }
            vrm.update(delta);
        }
    });

    return <primitive object={gltf.scene} position={[0, -0.8, 0]} />; // Lowered a bit to center
};

interface VrmAvatarRendererProps {
    avatarUrl: string;
    isSpeaking: boolean;
    scale?: number; // Not used inside canvas, but kept for interface compatibility if needed
    onLoaded?: () => void;
    controlsEnabled?: boolean;
}

export const VrmAvatarRenderer = ({ avatarUrl, isSpeaking, onLoaded, controlsEnabled = false }: VrmAvatarRendererProps) => {
    // Note: avatarUrl should be `avatar://${id}/${vrmFile}`
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Canvas
                camera={{ fov: 30, position: [0, 0.0, 4.0] }}
                gl={{ alpha: true, antialias: true }}
                onCreated={({ gl }) => {
                    gl.setClearColor(new THREE.Color(0x000000), 0); // Transparent
                }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[1, 1, 1]} intensity={1} />
                <VRMModel url={avatarUrl} isSpeaking={isSpeaking} setIsLoading={(l) => { if (!l && onLoaded) onLoaded() }} />
                <OrbitControls enabled={controlsEnabled} target={[0, 0, 0]} mouseButtons={{ LEFT: -1 as any, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }} />
            </Canvas>
        </div>
    );
};
