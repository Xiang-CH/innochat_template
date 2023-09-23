import { ChatResponse, ChatRequest, visemeResponse } from "./models";

import { SpeechRecognizer, SpeechConfig, AudioConfig, AutoDetectSourceLanguageConfig } from "microsoft-cognitiveservices-speech-sdk";

//ChatApi
export async function chatApi(options: ChatRequest): Promise<ChatResponse> {
    const response = await fetch("/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            history: options.history,
            approach: options.approach,
            overrides: {
                retrieval_mode: options.overrides?.retrievalMode,
                semantic_ranker: options.overrides?.semanticRanker,
                semantic_captions: options.overrides?.semanticCaptions,
                top: options.overrides?.top,
                temperature: options.overrides?.temperature,
                prompt_template: options.overrides?.promptTemplate,
                prompt_template_prefix: options.overrides?.promptTemplatePrefix,
                prompt_template_suffix: options.overrides?.promptTemplateSuffix,
                exclude_category: options.overrides?.excludeCategory,
                suggest_followup_questions: options.overrides?.suggestFollowupQuestions
            }
        })
    });

    const parsedResponse: ChatResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

//speech to text Api: get the speech to text service configuration
export async function sttApi(): Promise<SpeechRecognizer> {
    const response = await fetch("/stt");
    if (response.status > 299 || !response.ok) {
        throw Error("Failed to get configuration of speech-to-text service");
    }

    const config = await response.json();
    const { speech_key, speech_region } = config;
    // console.log("speech_key, speech_region:", speech_key, speech_region);
    const speechConfig = SpeechConfig.fromSubscription(speech_key, speech_region);
    speechConfig.setProperty("timeout", "2000");
    const audioConfig = AudioConfig.fromDefaultMicrophoneInput();

    const autoDetectSourceLanguageConfig = AutoDetectSourceLanguageConfig.fromLanguages(["en-US", "zh-CN", "zh-HK"]);
    var speechRecognizer = SpeechRecognizer.FromConfig(speechConfig, autoDetectSourceLanguageConfig, audioConfig);

    return speechRecognizer;
}

// text to speech
export async function ttsApi(text: string, voice: string): Promise<ArrayBuffer> {
    const response = await fetch("/tts", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: text,
            voice: voice
        })
    });

    const responseAudio: ArrayBuffer = await response.arrayBuffer();
    if (response.status > 299 || !response.ok) {
        throw Error("Unknown error");
    }

    return responseAudio;
}

//viseme: blend shapes for avatar animation
export async function viseme(text: string, voice: string): Promise<visemeResponse> {
    const response = await fetch("/viseme", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: text,
            voice: voice
        })
    });

    const responseBlendShapes: visemeResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error("Unknown error");
    }

    return responseBlendShapes;
}

//visemeAudio: audio for avatar animation
export async function visemeAudio(): Promise<ArrayBuffer> {
    const response = await fetch("/visemeAudio", {
        method: "GET"
    });

    const responseAudio: ArrayBuffer = await response.arrayBuffer();
    if (response.status > 299 || !response.ok) {
        throw Error("Unknown error");
    }

    return responseAudio;
}

//getCitationFilePath: get the path of the citation file
export function getCitationFilePath(citation: string): string {
    return `/content/${citation}`;
}
