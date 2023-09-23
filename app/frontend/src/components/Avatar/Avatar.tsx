import styles from "./Avatar.module.css";
import React, { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, extend, ThreeElements } from "@react-three/fiber";
import { useGLTF, useTexture, Loader, Environment, useFBX, useAnimations, PerspectiveCamera } from "@react-three/drei";
import { avatar_const } from "./avatarConsts";

import createAnimation from "./converter";
import blinkData from "./blendDataBlink.json";
// import avatar_type from

import * as THREE from "three";
import _ from "lodash";
extend({ PlaneBufferGeometry: THREE.PlaneGeometry });

import { viseme, visemeAudio } from "../../api";

interface makeAvatarProps {
    avatar_name: string;
    speak: boolean;
    setSpeak: any;
    text: string;
    playing: boolean;
    playAudio: any;
}

const VOICE = "en-US-GuyNeural";

async function makeSpeech(text: string, voice: string) {
    const blendshape = await viseme(text, voice);
    const audio = await visemeAudio();
    return { blendshape: blendshape, audio: audio };
}

function MakeAvatar({ avatar_name, speak, setSpeak, text, playing, playAudio }: makeAvatarProps) {
    const avatar = avatar_const[avatar_name];
    const SCALE = avatar.scale;

    let gltf = useGLTF(avatar.filename);
    gltf.scene.scale.set(SCALE, SCALE, SCALE);
    gltf.scene.position.setX(avatar.x);
    gltf.scene.position.setY(avatar.y);
    gltf.scene.position.setZ(avatar.z);
    gltf.scene.rotation.y = avatar.r;

    let morphTargetDictionaryHead: { [key: string]: number } | undefined = undefined;
    let morphTargetDictionaryTeeth: { [key: string]: number } | undefined = undefined;

    gltf.scene.traverse(node => {
        // console.log("gltfnode", node)
        if (node.type === "Mesh" || node.type === "LineSegments" || node.type === "SkinnedMesh") {
            node.castShadow = true;
            node.receiveShadow = true;
            node.frustumCulled = false;

            if (node.name.includes(avatar.head_dic)) {
                morphTargetDictionaryHead = (node as THREE.Mesh).morphTargetDictionary;
            }

            if (node.name.includes(avatar.teeth_dic)) {
                morphTargetDictionaryTeeth = (node as THREE.Mesh).morphTargetDictionary;
            }
        }
    });

    const [clips, setClips] = useState<any[]>([]);
    const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), []);

    useEffect(() => {
        if (speak === false) return;

        makeSpeech(text, avatar.voice)
            .then(response => {
                console.log("viseme response", response);
                let blendData = response.blendshape.blend_data;
                console.log(morphTargetDictionaryHead);
                if (morphTargetDictionaryHead && morphTargetDictionaryTeeth) {
                    let newClips = [
                        createAnimation(blendData, morphTargetDictionaryHead, avatar.head),
                        createAnimation(blendData, morphTargetDictionaryTeeth, avatar.teeth)
                    ];
                    setClips(newClips);
                    playAudio(response.audio);
                }
            })
            .catch(err => {
                console.error(err);
                setSpeak(false);
            });
    }, [speak]);

    let idleFbx = useFBX("/idle.fbx");
    // console.log(idleFbx)
    let { clips: idleClips } = useAnimations(idleFbx.animations);
    // console.log(idleClips)
    idleClips[0].tracks = _.filter(idleClips[0].tracks, track => {
        return track.name.includes("Head") || track.name.includes("Neck") || track.name.includes("Spine2");
    });

    idleClips[0].tracks = _.map(idleClips[0].tracks, track => {
        if (track.name.includes("Head")) {
            track.name = "head.quaternion";
        }

        if (track.name.includes("Neck")) {
            track.name = "neck.quaternion";
        }

        if (track.name.includes("Spine")) {
            track.name = "spine2.quaternion";
        }

        return track;
    });

    //blink
    useEffect(() => {
        // console.log(idleClips)
        // console.log(mixer)
        let idleClipAction = mixer.clipAction(idleClips[0]);
        idleClipAction.timeScale = 1 / 4;
        // console.log(idleClipAction);
        idleClipAction.play();
        // console.log(morphTargetDictionaryHead)

        let blinkAction: any = undefined;
        if (morphTargetDictionaryHead) {
            let blinkClip = createAnimation(blinkData, morphTargetDictionaryHead, avatar.head);
            // console.log(morphTargetDictionaryHead)

            if (blinkClip) {
                blinkAction = mixer.clipAction(blinkClip);
                blinkAction.timeScale = 1 / 2;
                blinkAction.play();
            }
        }

        // destroy on dismount
        return () => {
            idleClipAction.stop();
            if (blinkAction) {
                blinkAction.stop();
            }
            console.log("Avatar Action stoped");
            gltf.scene.traverse(function (obj) {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry.dispose();
                    obj.material.dispose();
                    gltf.scene.remove(obj);
                }
            });
            gltf.scene.remove();
            mixer.stopAllAction();
            mixer.uncacheClip(idleClips[0]);
            console.log("Avatar Unmounted");
        };
    }, []);

    // Play animation clips when available
    useEffect(() => {
        if (playing === false) return;
        console.log("Clip playing");
        _.each(clips, clip => {
            let clipAction = mixer.clipAction(clip);
            clipAction.setLoop(THREE.LoopOnce, 1);
            clipAction.play();
        });
    }, [playing]);

    useFrame((state, delta) => {
        mixer.update(delta);
    });

    return (
        <group name="avatar">
            <primitive object={gltf.scene} dispose={null} />
        </group>
    );
}

interface AvatarProps {
    inputText: string;
    avatar: string;
}

const Avatar = ({ inputText, avatar }: AvatarProps) => {
    const [speak, setSpeak] = useState(false);
    const [playing, setPlaying] = useState(false);
    const source = useRef<AudioBufferSourceNode | null>(null);

    function playByteArray(bytes: ArrayBuffer) {
        console.log("playByteArray");
        var AudioContext =
            window.AudioContext || // Default
            window.webkitAudioContext || // Safari and old versions of Chrome
            false;

        if (AudioContext) {
            var audioContext = new AudioContext();
        } else {
            alert(
                "Sorry, but the Web Audio API is not supported by your browser. Please, consider upgrading to the latest version or downloading Google Chrome or Mozilla Firefox"
            );
            return;
        }

        // Decode the WAV byte array into an AudioBuffer
        audioContext.decodeAudioData(bytes, function (buffer) {
            source.current = audioContext.createBufferSource();
            source.current.buffer = buffer;
            setPlaying(true);
            source.current.connect(audioContext.destination);
            source.current.start();
            source.current.onended = () => {
                console.log("clip ended");
                playerEnded();
            };
        });
    }

    // End of play
    function playerEnded() {
        console.log("animation ended");
        setSpeak(false);
        setPlaying(false);
    }

    useEffect(() => {
        // console.log("inputTextchanged: ", inputText);
        if (inputText !== "") {
            setSpeak(true);
        }
    }, [inputText]);

    return (
        <div className={styles.Avatar}>
            {/* <Stats /> */}
            <Canvas
                dpr={2}
                onCreated={ctx => {
                    // ctx.gl.physicallyCorrectLights = true;
                }}
            >
                <PerspectiveCamera makeDefault zoom={2} position={[0.05, 1.65, 1]} resolution={window.innerWidth / 2} />

                {/* <OrbitControls
                    target={[0, 1.65, 0]}
                /> */}

                <Suspense fallback={null}>
                    <Environment background={false} files="/photo_studio_loft_hall_1k.hdr" />
                </Suspense>

                <Suspense fallback={null}>
                    <Bg avatar={avatar} />
                </Suspense>

                <Suspense fallback={null}>
                    <MakeAvatar avatar_name={avatar} speak={speak} setSpeak={setSpeak} text={inputText} playing={playing} playAudio={playByteArray} />
                </Suspense>
            </Canvas>
            <Loader dataInterpolation={p => `Loading... please wait`} />
        </div>
    );
};

interface BgProps {
    avatar: string;
}

function Bg({ avatar }: BgProps) {
    const texture = useTexture(avatar_const[avatar].bg);
    const planeBufferGeometryRef = useRef<ThreeElements["planeBufferGeometry"]>(null!);

    return (
        <mesh position={[0.05, 1.7, 0]} scale={[1.1, 1.1, 1]}>
            <planeBufferGeometry ref={planeBufferGeometryRef} />
            <meshBasicMaterial map={texture} />
        </mesh>
    );
}

export default Avatar;
