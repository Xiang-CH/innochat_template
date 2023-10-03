import os
import logging
import json
import openai
from flask import Flask, Response, request, jsonify, send_file, abort
from azure.core.credentials import AzureKeyCredential
# from azure.identity import  InteractiveBrowserCredential
from azure.search.documents import SearchClient
from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from blendshapename import blendshape_names
import azure.cognitiveservices.speech as speechsdk
from dotenv import load_dotenv

load_dotenv()

# Replace these with your own values, either in environment variables or directly here

AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE") or "innochat-workshop"
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX") or "index"

AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT") or "https://workshop-apim.azure-api.net"
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_CHATGPT_DEPLOYMENT") or "chat"
AZURE_OPENAI_CHATGPT_MODEL = os.environ.get("AZURE_OPENAI_CHATGPT_MODEL") or "gpt-35-turbo"
AZURE_OPENAI_EMB_DEPLOYMENT = os.environ.get("AZURE_OPENAI_EMB_DEPLOYMENT") or "embedding"
SPEECH_REGION = os.environ.get("SPEECH_REGION") or "eastasia"
SPEECH_KEY = os.environ.get("SPEECH_KEY")

KB_FIELDS_CONTENT = os.environ.get("KB_FIELDS_CONTENT") or "content"
KB_FIELDS_SOURCEPAGE = os.environ.get("KB_FIELDS_SOURCEPAGE") or "sourcepage"

# Use the current user identity to authenticate with Azure OpenAI, Cognitive Search
azure_search_credential = AzureKeyCredential(os.environ.get("AZURE_SEARCH_KEY"))

# Used by the OpenAI SDK
openai.api_type = "azure"
openai.api_base = AZURE_OPENAI_ENDPOINT
openai.api_version = "2023-07-01-preview"
openai.api_key =  os.environ.get("AZURE_OPENAI_KEY")

# Set up clients for Cognitive Search and Storage
search_client = SearchClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
    index_name=AZURE_SEARCH_INDEX,
    credential=azure_search_credential)


chat_approaches = {
     "rrr": ChatReadRetrieveReadApproach(search_client, 
                                        AZURE_OPENAI_CHATGPT_DEPLOYMENT,
                                        AZURE_OPENAI_CHATGPT_MODEL, 
                                        AZURE_OPENAI_EMB_DEPLOYMENT,
                                        KB_FIELDS_SOURCEPAGE, 
                                        KB_FIELDS_CONTENT)
}

app = Flask(__name__)

@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_file(path):
    return app.send_static_file(path)

# Serve content files from blob storage from within the app to keep the example self-contained. 
# *** NOTE *** this assumes that the content files are public, or at least that all users of the app
# can access all the files. This is also slow and memory hungry.
@app.route("/content/<path>")
def content_file(path):
    return static_file('Database/' + path)
    
#OpenAI GPT Chat API
@app.route("/chat", methods=["POST"])
def chat():
    
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    approach = request.json["approach"]
    try:
        impl = chat_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(request.json["history"], request.json.get("overrides") or {})
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

#Speech to text
@app.route('/stt')  
def stt():
    config = {
        'speech_key': SPEECH_KEY,
        'speech_region': SPEECH_REGION
    }
    return jsonify(config)
    
#Text to Speech
@app.route("/tts", methods=["POST"])
def tts():
    
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    try:
        voice = request.json['voice']
        text = request.json['text']
        language = "en-US"
        # print(voice)

        SPEECH_REGION = os.environ.get("SPEECH_REGION") or "eastasia"
        SPEECH_KEY = os.environ.get("SPEECH_KEY")

        speech_config = speechsdk.SpeechConfig(subscription= SPEECH_KEY, region= SPEECH_REGION)
        speech_config.speech_synthesis_voice_name = voice
        
        speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
        speech_synthesis_result = speech_synthesizer.speak_text_async(text).get()
        audio_bytes = speech_synthesis_result.audio_data
        
        if speech_synthesis_result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            resp = Response(audio_bytes, 200)
            resp.headers["Content-Type"] = 'audio/wav'
        else:
            cancellation_details = speech_synthesis_result.cancellation_details
            resp = jsonify({"error": "Audio synthsis failed"}), 400
        return resp
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

#generate 3d model animation(viseme key and blender shape keys)
viseme_audio = {}
@app.route("/viseme", methods=["POST"])
def viseme():
    
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    try:
        SSML = '''
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
        <voice name="en-US-GuyNeural">
        <mstts:viseme type="FacialExpression"/>
        __TEXT__
        </voice>
        </speak>
        '''
        voice = request.json['voice']
        text = request.json['text']
        
        ssml = SSML.replace("__TEXT__", text).replace("en-US-GuyNeural", voice)
        print('ssml:', ssml)

        speech_config = speechsdk.SpeechConfig(subscription= SPEECH_KEY, region= SPEECH_REGION)
        speech_config.speechSynthesisOutputFormat = 11; # wav

        speech_config.speech_synthesis_voice_name = voice
        
        blendData = []
        animations = []
        timeStep = 1/60
        timeStamp = 0
        
        def viseme_cb(evt):
            nonlocal timeStamp
            # print("Viseme event received: audio offset: {}ms, viseme id: {}.".format(
                # evt.audio_offset / 10000, evt.viseme_id))

            # `Animation` is an xml string for SVG or a json string for blend shapes
            animation = json.loads(evt.animation)
            animations.append(animation)
            
            for blend_array in animation["BlendShapes"]:
                blend = {}
                for i, shapeName in enumerate(blendshape_names()):
                    blend[shapeName] = blend_array[i]
                blendData.append({"time": timeStamp, "blendshapes": blend})
                timeStamp += timeStep

        speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
        
        speech_synthesizer.viseme_received.connect(viseme_cb)
        speech_synthesis_result = speech_synthesizer.speak_ssml_async(ssml).get()
        audio_bytes = speech_synthesis_result.audio_data
        
        print('result reason:', speech_synthesis_result.reason)
        
        if speech_synthesis_result.reason == speechsdk.ResultReason.Canceled:
            print("CANCELED: Reason={}".format(speech_synthesis_result.cancellation_details.reason))
        
        if speech_synthesis_result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            viseme_audio[request.remote_addr] = audio_bytes
            # print(blendData)
            resp = jsonify({"blend_data": blendData}), 200
        else: 
            cancellation_details = speech_synthesis_result.cancellation_details
            speech_synthesis_result.close()
            resp = jsonify({"error": cancellation_details.ToString()}), 400
        return resp
        
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

# generate 3d model voice
@app.route("/visemeAudio", methods=["GET"])
def visemeAudio():
    
    if request.remote_addr in viseme_audio.keys():
        audio_bytes = viseme_audio[request.remote_addr]
        resp = Response(audio_bytes, 200)
        resp.headers["Content-Type"] = 'audio/wav'
        del viseme_audio[request.remote_addr]
        return resp
    else:
        return jsonify({"error": "no audio"}), 400
    

if __name__ == "__main__":
    app.run()
