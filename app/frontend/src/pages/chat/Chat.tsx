import { useRef, useState, useEffect } from "react";
import { Checkbox, Panel, DefaultButton, TextField, SpinButton, Dropdown, IDropdownStyles, IDropdownOption } from "@fluentui/react";

import styles from "./Chat.module.css";

import { chatApi, RetrievalMode, Approaches, ChatResponse, ChatRequest, ChatTurn, ttsApi} from "../../api";
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

const Chat = () => {
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [promptTemplate, setPromptTemplate] = useState<string>("");
    const [retrieveCount, setRetrieveCount] = useState<number>(3);
    const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>(RetrievalMode.Hybrid);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(false);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(false);
    const [excludeCategory, setExcludeCategory] = useState<string>("");
    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(false);
    const [activateTTS, setActivateTTS] = useState<boolean>(false);
    const videoRef_ = useRef<HTMLVideoElement>(null);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: ChatResponse][]>([]);
    const [mode, setMode] = useState<string>("chat");
    const [speakText, setSpeakText] = useState<string>("");

    const [playing, setPlaying] = useState<boolean>(false);
    const [playPaused, setPlayPaused] = useState<boolean>(false);
    const [previousAudio, setPreviousAudio] = useState<ArrayBuffer | undefined>(undefined);

    var source = useRef<AudioBufferSourceNode | undefined>(undefined);
    var audioContext = useRef<AudioContext | undefined>(undefined);

    // TODO set defualt voice
    const [voice, setVoice] = useState<string>("en-US-JennyNeural");
    const voiceOptions: IDropdownOption[] = [
        { key: "en-US-JennyNeural", text: "Default: Jenny" },
        { key: "en-US-__Name__Neural", text: "__Name__"},
    ];

    // TODO set defualt avatar
    const [currentAvatar, setCurrentAvatar] = useState<string>("cartoon");

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
            if (audioContext.current == undefined) {
                // Do whatever you want using the Web Audio API
                audioContext.current = new AudioContext();
                // ...
            }
        } else {
            // Web Audio API is not supported
            // Alert the user
            alert(
                "Sorry, but the Web Audio API is not supported by your browser. Please, consider upgrading to the latest version or downloading Google Chrome or Mozilla Firefox"
            );
            return;
        }

        // Decode the WAV byte array into an AudioBuffer
        audioContext.current.decodeAudioData(bytes.slice(0), function (buffer) {
            if (audioContext.current != undefined) {
                // Create a new AudioBufferSourceNode
                // const source = audioContext.createBufferSource();
                source.current = audioContext.current.createBufferSource();

                // Set the buffer of the source node to the decoded AudioBuffer
                source.current.buffer = buffer;

                // Connect the source node to the AudioContext destination, which is the speakers
                source.current.connect(audioContext.current.destination);

                // Start playing the source node
                source.current.start();
                setPlaying(true);

                source.current.onended = () => {
                    setPlaying(false);
                    setPlayPaused(false);
                };
            }
        });
    }

    function pauseByteArray() {
        console.log("pauseByteArray");
        audioContext.current?.suspend();
        setPlayPaused(true);
    }

    function resumeByteArray() {
        console.log("resumeByteArray");
        audioContext.current?.resume();
        setPlayPaused(false);
    }

    function replayByteArray() {
        if (previousAudio) {
            playByteArray(previousAudio);
        }
    }

    async function setAnswersWithTTS(question: string, result: ChatResponse) {
        console.log("TTS activcation: " + activateTTS + ": " + result.answer);
        const text = result.answer.replaceAll(/\[[^\]]*\]/g, "");
        // console.log("Speak text: " + text);

        if (mode == "avatar") {
            console.log("avatar speak text set");
            setSpeakText(text);
        } else if (activateTTS) {
            // Get speech audio from tts api
            const ttsresult = await ttsApi(text, voice);
            setPreviousAudio(ttsresult);
            playByteArray(ttsresult);
        }

        result.answer = result.answer.replaceAll(/\$[^\$]*\$/g, "");
        console.log("TTS activcation: " + activateTTS + ": " + result.answer);
        setAnswers([...answers, [question, result]]);
        setIsLoading(false);
    }

    const makeApiRequest = async (question: string) => {
        if (source.current) {
            source.current.stop(0);
            source.current.disconnect();
            source.current = undefined;
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
        setAnswers([]);
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    useEffect(() => {
        if (mode == "avatar") {
            if (!activateTTS) {
                setActivateTTS(true);
            }
        } else {
            setSpeakText("");
        }
    }, [mode]);


    const onRetrieveCountChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setRetrieveCount(parseInt(newValue || "3"));
    };

    const onUseSemanticCaptionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticCaptions(!!checked);
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
            {mode == "avatar" && <SelectAvatarButton setSelectedAvatar={setCurrentAvatar} selectedAvatar={currentAvatar} setSpeakText={setSpeakText} />}

            <Layout setMode={setMode} mode={mode} />

            {mode == "avatar" && currentAvatar == "cartoon" && <Avatar inputText={speakText} avatar={currentAvatar} />}
            {mode == "avatar" && currentAvatar == "robot" && <Avatar inputText={speakText} avatar={currentAvatar} />}
            {mode == "avatar" && currentAvatar == "custom" && <Avatar inputText={speakText} avatar={currentAvatar} />}
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
                                <h1 className={styles.chatEmptyStateTitle}>Chat about your own data</h1>
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
                                                mode={mode}
                                                playing={playing}
                                                isLast={answers.length - 1 === index}
                                                pausePlay={pauseByteArray}
                                                resumePlay={resumeByteArray}
                                                rePlay={replayByteArray}
                                                paused={playPaused}
                                                ttsOn={activateTTS}
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
                            <QuestionInput clearOnSend placeholder="Ask a new question" disabled={isLoading} onSend={makeApiRequest} />
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
                        
                        {/* <Dropdown
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
                        /> */}

                        <SpinButton
                            className={styles.chatSettingsSeparator}
                            label="Retrieve this many documents from search:"
                            min={1}
                            max={50}
                            defaultValue={retrieveCount.toString()}
                            onChange={onRetrieveCountChange}
                        />
                        
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


                    </Panel>
                </div>
            </div>
        </div>
    );
};

export default Chat;
