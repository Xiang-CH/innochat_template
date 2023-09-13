import { useRef, useState, useEffect } from "react";
import { Checkbox, Panel, DefaultButton, TextField, SpinButton, Dropdown, DropdownMenuItemType, IDropdownStyles, IDropdownOption } from "@fluentui/react";

import styles from "./Chat.module.css";

import { chatApi, RetrievalMode, Approaches, AskResponse, ChatRequest, ChatTurn, ttsApi, faceApi, FaceResponse } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { SettingsButton } from "../../components/SettingsButton";
import { ClearChatButton } from "../../components/ClearChatButton";
import { SelectAvatarButton } from "../../components/SelectAvatarButton/SelectAvatarButton";

import Layout from "../../components/layout/Layout";
import Avatar from "../../components/Avatar/Avatar";
import { set, stubFalse } from "lodash";

// declare global {
//     interface Window {
//         cv: typeof import("mirada/dist/src/types/opencv/_types");
//     }
// }

const Chat = () => {
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [promptTemplate, setPromptTemplate] = useState<string>("");
    const [retrieveCount, setRetrieveCount] = useState<number>(3);
    const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>(RetrievalMode.Hybrid);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(false);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(false);
    const [excludeCategory, setExcludeCategory] = useState<string>("");
    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(false);
    const [activateTTS, setActivateTTS] = useState<boolean>(true);
    const [faceDetection, setFaceDetection] = useState<boolean>(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoRef_ = useRef<HTMLVideoElement>(null);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [isListening, setIsListening] = useState(false);
    const [continuesListening, setContinuesListening] = useState(false);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);
    const [mode, setMode] = useState<string>("chat");
    const [speakText, setSpeakText] = useState<string>("");

    const videoForFace = document.createElement("video");

    var source = useRef<AudioBufferSourceNode | null>(null);

    // set defualt voice
    const [voice, setVoice] = useState<string>("en-US-JennyNeural");
    const voiceOptions: IDropdownOption[] = [
        { key: "en-US-JennyNeural", text: "Female Default" },
        { key: "en-US-GuyNeural", text: "Male Default" },
        { key: "custom", text: "Custom Voices", itemType: DropdownMenuItemType.Header },
        { key: "Daniel HicksNeural", text: "Daniel Hicks" },
        { key: "Kit-Neural", text: "Dr. Chui" }
    ];

    // set defualt avatar
    const [currentAvatar, setCurrentAvatar] = useState<string>("cartoon");

    // const avatarOptions: IDropdownOption[] = [
    //     { key: "ROBOT.glb", text: "Robot" },
    //     { key: "KitFiexed_3.glb", text: "Manikin" }
    // ];

    const dropdownStyles: Partial<IDropdownStyles> = {
        dropdown: { width: 300 }
    };

    function playByteArray(bytes: ArrayBuffer) {
        // var buffer = new Uint8Array( bytes.length );
        // buffer.set( new Uint8Array(bytes), 0 );
        // Create an AudioContext instance
        var AudioContext =
            window.AudioContext || // Default
            window.webkitAudioContext || // Safari and old versions of Chrome
            false;

        if (AudioContext) {
            // Do whatever you want using the Web Audio API
            var audioContext = new AudioContext();
            // ...
        } else {
            // Web Audio API is not supported
            // Alert the user
            alert(
                "Sorry, but the Web Audio API is not supported by your browser. Please, consider upgrading to the latest version or downloading Google Chrome or Mozilla Firefox"
            );
            return;
        }

        // Decode the WAV byte array into an AudioBuffer
        audioContext.decodeAudioData(bytes, function (buffer) {
            // Create a new AudioBufferSourceNode
            // const source = audioContext.createBufferSource();
            source.current = audioContext.createBufferSource();

            // Set the buffer of the source node to the decoded AudioBuffer
            source.current.buffer = buffer;

            // Connect the source node to the AudioContext destination, which is the speakers
            source.current.connect(audioContext.destination);

            // Start playing the source node
            source.current.start();
            if (continuesListening) {
                source.current.onended = () => {
                    setIsListening(true);
                };
            }
        });
    }

    async function setAnswersWithTTS(question: string, result: AskResponse) {
        console.log("TTS activcation: " + activateTTS + ": " + result.answer);
        const text = result.answer.replaceAll(/\[[^\]]*\]/g, "");
        // console.log("Speak text: " + text);

        if (mode == "avatar") {
            console.log("avatar speak text set");
            setSpeakText(text);
        } else if (activateTTS) {
            // Get speech audio from tts api
            const ttsresult = await ttsApi(text, voice);
            playByteArray(ttsresult);
        }

        result.answer = result.answer.replaceAll(/\$[^\$]*\$/g, "");
        console.log("TTS activcation: " + activateTTS + ": " + result.answer);
        setAnswers([...answers, [question, result]]);
        setIsLoading(false);
    }

    const makeApiRequest = async (question: string) => {
        if (source.current) {
            source.current.disconnect();
            source.current.stop(0);
            source.current = null;
        }
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        try {
            const history: ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
            const request: ChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                approach: Approaches.ReadRetrieveRead,
                overrides: {
                    retrievalMode: retrievalMode,
                    promptTemplate: promptTemplate.length === 0 ? undefined : promptTemplate,
                    excludeCategory: excludeCategory.length === 0 ? undefined : excludeCategory,
                    top: retrieveCount,
                    semanticRanker: useSemanticRanker,
                    semanticCaptions: useSemanticCaptions,
                    suggestFollowupQuestions: useSuggestFollowupQuestions
                }
            };

            const result = await chatApi(request);

            console.log("response", result);

            await setAnswersWithTTS(question, result);

            return Promise.resolve();
        } catch (e) {
            setError(e);
            return Promise.reject();
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        //start streaming after 3 seconds
        // setTimeout(() => {
        //     setFaceDetection(true);
        // }, 3000);
        setAnswers([]);
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    // useEffect(() => {
    //     console.log(mode);
    //     setFaceDetection(mode == "avatar");
    // }, [mode]);

    useEffect(() => {
        if (mode == "avatar") {
            // setFaceDetection(true);
            setVoice("en-US-GuyNeural");
            if (!activateTTS) {
                setActivateTTS(true);
            }
        } else {
            setSpeakText("");
            // setFaceDetection(false);
        }
    }, [mode]);

    useEffect(() => {
        if (faceDetection) {
            startStreaming();
        } else {
            stopStreaming();
        }
    }, [faceDetection]);

    const startStreaming = () => {
        console.log("start streaming");
        // Check if the browser supports getUserMedia
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Set the desired frame rate constraints
            const constraints = { video: { frameRate: { ideal: 30, max: 60 } } };

            // Access the user's camera
            navigator.mediaDevices
                .getUserMedia(constraints)
                .then(stream => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play();
                        // processVideo();
                    }
                    if (videoRef_.current) {
                        videoRef_.current.srcObject = stream;
                        videoRef_.current.play();
                        processVideo();
                    }
                })
                .catch(error => {
                    console.error("Error accessing media devices.", error);
                });
        } else {
            console.log("getUserMedia is not supported");
        }
        return () => {};
    };

    const stopStreaming = () => {
        const video = videoRef_.current;
        if (video && video.srcObject)
            setTimeout(() => {
                // video.srcObject?.getTracks().forEach(track => track.stop());
                var stream = video.srcObject as MediaStream;
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
                video.srcObject = null;
            }, 100);
    };

    const processVideo = async () => {
        console.log("process video");
        // const video = videoRef.current;
        const video = videoRef_.current;
        // const video = videoForFace;
        // const canvas = document.querySelector("canvas");
        // const canvas = canvasRef.current;
        const canvas = document.createElement("canvas");

        if (video && faceDetection && canvas && !lastQuestionRef.current)
            try {
                if (video.videoHeight == 0) {
                    setTimeout(processVideo, 300);
                    return;
                }
                canvas.width = video.offsetWidth;
                canvas.height = video.offsetHeight;
                // console.log(video.offsetHeight, video.offsetWidth);

                var ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(video, 0, 0, video.offsetWidth, video.offsetHeight);
                    // console.log("draw canvas");
                    const imageURL = canvas.toDataURL("image/jpeg").split(";base64,")[1]; // Convert to data URL
                    const faceResult: FaceResponse = await faceApi(imageURL);
                    if (faceResult && faceResult.face_number > 0) {
                        // stop streaming after a successful face detection
                        stopStreaming();

                        //generate greet response

                        let greetResponse: AskResponse = {
                            answer: "Good morning, how can I help you?",
                            thoughts: null,
                            data_points: []
                        };
                        if (faceResult.name) {
                            greetResponse.answer = "Good morning, " + faceResult.name + ", how can I help you?";
                        }

                        lastQuestionRef.current = "(detect_face)";
                        setAnswersWithTTS("(detect_face)", greetResponse);
                    }
                }

                let begin = Date.now();
                // schedule the next one.
                let delay = 3000 - ((Date.now() - begin) % 100);
                if (!lastQuestionRef.current) setTimeout(processVideo, delay);
            } catch (error) {
                console.log("Error processing video: ", error);
            }
        else {
            if (lastQuestionRef.current) {
                console.log("chatting: ", lastQuestionRef.current);
            } else if (!video) {
                console.log("load video source...");
            } else if (!canvas) {
                console.log("load canvas source...");
            } else {
                console.log("face detection is not activated");
            }
            setTimeout(processVideo, 3000);
        }
    };

    const onPromptTemplateChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setPromptTemplate(newValue || "");
    };

    const onRetrieveCountChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setRetrieveCount(parseInt(newValue || "3"));
    };

    const onUseSemanticRankerChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticRanker(!!checked);
    };

    const onUseSemanticCaptionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticCaptions(!!checked);
    };

    const onExcludeCategoryChanged = (_ev?: React.FormEvent, newValue?: string) => {
        setExcludeCategory(newValue || "");
    };

    const onUseSuggestFollowupQuestionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSuggestFollowupQuestions(!!checked);
    };

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };

    const onRetrievalModeChange = (_ev: React.FormEvent<HTMLDivElement>, option?: IDropdownOption<RetrievalMode> | undefined, index?: number | undefined) => {
        setRetrievalMode(option?.data || RetrievalMode.Hybrid);
    };

    const onShowCitation = (citation: string, index: number) => {
        if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveCitation(citation);
            setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
        }

        setSelectedAnswer(index);
    };

    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        if (activeAnalysisPanelTab === tab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }

        setSelectedAnswer(index);
    };

    const onVoiceModelChange = (_ev?: React.FormEvent<HTMLDivElement>, option?: IDropdownOption<any> | undefined, index?: number | undefined) => {
        if (option?.key) {
            setVoice(String(option?.key));
        }
        console.log(String(option?.key));
    };

    return (
        <div className={styles.layout}>
            <video ref={videoRef_} autoPlay style={{ visibility: "hidden", position: "absolute" }} />
            {mode == "avatar" && <SelectAvatarButton setSelectedAvatar={setCurrentAvatar} selectedAvatar={currentAvatar} />}

            <Layout setMode={setMode} mode={mode} />

            {mode == "avatar" && currentAvatar == "cartoon" && (
                <Avatar inputText={speakText} coninuousListening={continuesListening} setIsListening={setIsListening} avatar={currentAvatar} />
            )}
            {mode == "avatar" && currentAvatar == "robot" && (
                <Avatar inputText={speakText} coninuousListening={continuesListening} setIsListening={setIsListening} avatar={currentAvatar} />
            )}
            <div className={mode == "avatar" ? styles.containerWhenAvatarMode : styles.container}>
                <div className={styles.chatRoot}>
                    <div className={styles.chatContainer}>
                        <div className={styles.chatHeader}>
                            <div className={styles.commandsContainer}>
                                <ClearChatButton
                                    className={styles.commandButton}
                                    onClick={clearChat}
                                    disabled={!lastQuestionRef.current || isLoading}
                                    mode={mode}
                                />
                                <SettingsButton className={styles.commandButton} onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)} mode={mode} />
                            </div>
                        </div>
                        {!lastQuestionRef.current && mode != "avatar" ? (
                            <div className={styles.chatEmptyState}>
                                <h1 className={styles.chatEmptyStateTitle}>Chat about Innovation Wing</h1>
                                <h2 className={styles.chatEmptyStateSubtitle}>Ask anything or try an example</h2>
                                <ExampleList onExampleClicked={onExampleClicked} />
                            </div>
                        ) : (
                            <div className={styles.chatMessageStream}>
                                {answers.map((answer, index) => (
                                    <div key={index}>
                                        {answer[0] != "(detect_face)" && <UserChatMessage message={answer[0]} />}
                                        <div className={styles.chatMessageGpt}>
                                            <Answer
                                                key={index}
                                                answer={answer[1]}
                                                isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                                onCitationClicked={c => onShowCitation(c, index)}
                                                onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                                onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                                onFollowupQuestionClicked={q => makeApiRequest(q)}
                                                showFollowupQuestions={useSuggestFollowupQuestions && answers.length - 1 === index}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <>
                                        <UserChatMessage message={lastQuestionRef.current} />
                                        <div className={styles.chatMessageGptMinWidth}>
                                            <AnswerLoading />
                                        </div>
                                    </>
                                )}
                                {error ? (
                                    <>
                                        <UserChatMessage message={lastQuestionRef.current} />
                                        <div className={styles.chatMessageGptMinWidth}>
                                            <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                        </div>
                                    </>
                                ) : null}
                                <div ref={chatMessageStreamEnd} />
                            </div>
                        )}

                        <div className={styles.chatInput}>
                            <QuestionInput
                                clearOnSend
                                placeholder="Ask a new question"
                                disabled={isLoading}
                                onSend={makeApiRequest}
                                isListening={isListening}
                                setIsListening={setIsListening}
                                setContinuousListening={setContinuesListening}
                            />
                        </div>
                    </div>

                    {answers.length > 0 && activeAnalysisPanelTab && (
                        <AnalysisPanel
                            className={styles.chatAnalysisPanel}
                            activeCitation={activeCitation}
                            onActiveTabChanged={x => onToggleTab(x, selectedAnswer)}
                            citationHeight="810px"
                            answer={answers[selectedAnswer][1]}
                            activeTab={activeAnalysisPanelTab}
                        />
                    )}

                    <Panel
                        headerText="ChatBot Configure"
                        isOpen={isConfigPanelOpen}
                        isBlocking={false}
                        onDismiss={() => setIsConfigPanelOpen(false)}
                        closeButtonAriaLabel="Close"
                        onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>Close</DefaultButton>}
                        isFooterAtBottom={true}
                    >
                        <Dropdown
                            onChange={onVoiceModelChange}
                            className={styles.chatSettingsSeparator}
                            defaultSelectedKey={voice}
                            label="Text to Speech Voice Model:"
                            options={voiceOptions}
                            styles={dropdownStyles}
                            disabled={!activateTTS || mode == "avatar"}
                        />

                        <Checkbox
                            className={styles.chatSettingsSeparator}
                            checked={activateTTS}
                            label="Activate Text to Speech"
                            onChange={() => setActivateTTS(!activateTTS)}
                            disabled={mode == "avatar"}
                        />

                        {/* <TextField
                            className={styles.chatSettingsSeparator}
                            defaultValue={promptTemplate}
                            label="Override prompt template"
                            multiline
                            autoAdjustHeight
                            onChange={onPromptTemplateChange}
                        /> */}

                        <SpinButton
                            className={styles.chatSettingsSeparator}
                            label="Retrieve this many documents from search:"
                            min={1}
                            max={50}
                            defaultValue={retrieveCount.toString()}
                            onChange={onRetrieveCountChange}
                        />
                        {/* <TextField className={styles.chatSettingsSeparator} label="Exclude category" onChange={onExcludeCategoryChanged} /> */}
                        <Dropdown
                            className={styles.chatSettingsSeparator}
                            label="Retrieval mode"
                            options={[
                                { key: "hybrid", text: "Vectors + Text (Hybrid)", selected: retrievalMode == RetrievalMode.Hybrid, data: RetrievalMode.Hybrid },
                                { key: "vectors", text: "Vectors", selected: retrievalMode == RetrievalMode.Vectors, data: RetrievalMode.Vectors },
                                { key: "text", text: "Text", selected: retrievalMode == RetrievalMode.Text, data: RetrievalMode.Text }
                            ]}
                            required
                            onChange={onRetrievalModeChange}
                        />
                        {/* <Checkbox
                            className={styles.chatSettingsSeparator}
                            checked={useSemanticRanker}
                            label="Use semantic ranker for retrieval"
                            onChange={onUseSemanticRankerChange}
                        /> */}
                        <Checkbox
                            className={styles.chatSettingsSeparator}
                            checked={useSemanticCaptions}
                            label="Use query-contextual summaries instead of whole documents"
                            onChange={onUseSemanticCaptionsChange}
                            disabled={!useSemanticRanker}
                        />
                        <Checkbox
                            className={styles.chatSettingsSeparator}
                            checked={useSuggestFollowupQuestions}
                            label="Suggest follow-up questions"
                            onChange={onUseSuggestFollowupQuestionsChange}
                        />
                        <Checkbox
                            className={styles.chatSettingsSeparator}
                            checked={faceDetection}
                            label="Activate Face Recognition"
                            onChange={() => setFaceDetection(!faceDetection)}
                        />
                        {faceDetection && <video ref={videoRef} className={styles.videoElement} autoPlay />}
                        {/* {faceDetection && <canvas ref={canvasRef}></canvas>} */}
                    </Panel>
                </div>
            </div>
        </div>
    );
};

export default Chat;
