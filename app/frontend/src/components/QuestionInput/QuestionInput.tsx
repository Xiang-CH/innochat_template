import React, { useState, useEffect, useRef } from "react";
import { Stack, TextField } from "@fluentui/react";
import { Send28Filled, Mic28Filled } from "@fluentui/react-icons";
import { SpeechRecognizer, ResultReason, AutoDetectSourceLanguageResult } from "microsoft-cognitiveservices-speech-sdk";

import styles from "./QuestionInput.module.css";
import { sttApi } from "../../api/api";
// import { on } from "events";
// import { set } from "lodash";
// import { is } from "@react-three/fiber/dist/declarations/src/core/utils";

interface Props {
    onSend: (question: string) => Promise<void>;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
}

export const QuestionInput = ({ onSend, disabled, placeholder, clearOnSend }: Props) => {
    const [question, setQuestion] = useState<string>("");
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const [placeholdertext, setPlaceholdertext] = useState<string>(placeholder ? placeholder : "Ask a question...");
    const [isListening, setIsListening] = useState(false);

    useEffect(() => {
        let recognizer: SpeechRecognizer | null = null;

        const startRecognition = async () => {
            console.log("recognition started");
            if (!recognizer) {
                recognizer = await sttApi();
            }
            // set this property to allow more time between words in the command
            recognizer.recognizeOnceAsync(result => {
                if (result.reason === ResultReason.RecognizedSpeech) {
                    var recognizedQuestion = result.text;
                    var languageDetectionResult = AutoDetectSourceLanguageResult.fromResult(result);
                    var detectedLanguage = languageDetectionResult.language;

                    if (recognizedQuestion.trim()) {
                        setQuestion(recognizedQuestion);
                        onSend(recognizedQuestion);
                        if (clearOnSend) {
                            setTimeout(() => {
                                setQuestion("");
                            }, 100);
                        }
                        setIsListening(false);
                    }
                } else {
                    setIsListening(false);
                    console.log("ERROR: Speech was cancelled or could not be recognized. Ensure your microphone is working properly.");
                }
            });
        };

        if (isListening) {
            startRecognition();
            setPlaceholdertext("Listening...");
        } else {
            setPlaceholdertext(placeholder ? placeholder : "Ask a question...");
        }
        return () => {};
    }, [isListening]);

    useEffect(() => {
        if (textAreaRef.current) {
            // We need to reset the height momentarily to get the correct scrollHeight for the textarea
            textAreaRef.current.style.height = "0px";
            const scrollHeight = textAreaRef.current.scrollHeight;

            if (scrollHeight > 60) {
                textAreaRef.current.style.height = "80px";
            } else {
                // We then set the height directly, outside of the render loop
                // Trying to set this with state or a ref will product an incorrect value.
                textAreaRef.current.style.height = scrollHeight + "px";
            }
        }
    }, [textAreaRef, question]);

    const toggleListening = () => {
        setIsListening(!isListening);
    };

    const sendQuestion = () => {
        if (disabled || !question.trim()) {
            if (!question.trim()) {
                console.log("empty question");
            }
            return;
        }
        console.log("send question");
        onSend(question);

        if (clearOnSend) {
            setQuestion("");
        }
    };

    const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            sendQuestion();
        }
    };

    const onQuestionChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = evt.target?.value;

        if (!newValue) {
            setQuestion("");
        } else if (newValue.length <= 1000) {
            setQuestion(newValue);
        }
    };

    const sendQuestionDisabled = disabled || !question.trim();

    return (
        <Stack horizontal className={styles.questionInputContainer}>
            {/* <div className={styles.questionInputButtonsContainer}>
                <div className={styles.questionInputMicButton} aria-label="Toggle speech input button" onClick={toggleListening}>
                    {isListening ? <Mic28Filled primaryFill="#62a04e" /> : <Mic28Filled primaryFill="rgba(0, 0, 0, 0.4)" />}
                </div>
            </div> */}
            <textarea
                className={styles.questionInputTextArea}
                placeholder={placeholdertext}
                rows={15}
                ref={textAreaRef}
                value={question}
                onChange={onQuestionChange}
                onKeyDown={onEnterPress}
            />
            <div className={styles.questionInputButtonsContainer}>
                <div
                    className={`${styles.questionInputSendButton} ${sendQuestionDisabled ? styles.questionInputSendButtonDisabled : ""}`}
                    aria-label="Ask question button"
                    onClick={sendQuestion}
                >
                    <Send28Filled primaryFill="#62a04e" />
                </div>
            </div>
        </Stack>
    );
};
