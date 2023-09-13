import os
import io
import mimetypes
import time
import logging
import re
import json
import openai
from flask import Flask, Response, request, jsonify, send_file, abort
from azure.identity import DefaultAzureCredential
# from azure.identity import  InteractiveBrowserCredential
from azure.search.documents import SearchClient
from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from azure.storage.blob import BlobServiceClient
from blendshapename import blendshape_names
import azure.cognitiveservices.speech as speechsdk
from azure.cognitiveservices.vision.face import FaceClient
from msrest.authentication import CognitiveServicesCredentials
from azure.cognitiveservices.vision.face.models import QualityForRecognition
import base64

# Replace these with your own values, either in environment variables or directly here
AZURE_STORAGE_ACCOUNT = os.environ.get("AZURE_STORAGE_ACCOUNT") or "mystorageaccount"
AZURE_STORAGE_CONTAINER = os.environ.get("AZURE_STORAGE_CONTAINER") or "content"
AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE") or "innochat-search"
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX") or "index"

AZURE_OPENAI_SERVICE = os.environ.get("AZURE_OPENAI_SERVICE") or "myopenai"
AZURE_OPENAI_GPT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_GPT_DEPLOYMENT") or "chat"
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_CHATGPT_DEPLOYMENT") or "chat"
AZURE_OPENAI_CHATGPT_MODEL = os.environ.get("AZURE_OPENAI_CHATGPT_MODEL") or "gpt-35-turbo"
AZURE_OPENAI_EMB_DEPLOYMENT = os.environ.get("AZURE_OPENAI_EMB_DEPLOYMENT") or "embedding"
SPEECH_REGION = os.environ.get("SPEECH_REGION") or "eastasia"
SPEECH_KEY = os.environ.get("SPEECH_KEY") or "49d3a59e428b48dc94fc20d81bdd5df6"
AZURE_FACE_ENDPOINT = 'https://innoface.cognitiveservices.azure.com/'
AZURE_FACE_KEY = 'f3b7d5c1dd2a4adc9dd699bad1a044b1'
PERSON_GROUP_ID = 'innovation_wing'

KB_FIELDS_CONTENT = os.environ.get("KB_FIELDS_CONTENT") or "content"
KB_FIELDS_CATEGORY = os.environ.get("KB_FIELDS_CATEGORY") or "category"
KB_FIELDS_SOURCEPAGE = os.environ.get("KB_FIELDS_SOURCEPAGE") or "sourcepage"

# Use the current user identity to authenticate with Azure OpenAI, Cognitive Search and Blob Storage (no secrets needed, 
# just use 'az login' locally, and managed identity when deployed on Azure). If you need to use keys, use separate AzureKeyCredential instances with the 
# keys for each service
# If you encounter a blocking error during a DefaultAzureCredntial resolution, you can exclude the problematic credential by using a parameter (ex. exclude_shared_token_cache_credential=True)
azure_credential = DefaultAzureCredential(exclude_shared_token_cache_credential=True)

# Used by the OpenAI SDK
openai.api_type = "azure"
openai.api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
openai.api_version = "2023-03-15-preview"

# Voice name to end-point dict
voice_endpoint = {"Daniel HicksNeural": "e892661f-d522-410f-8436-e6d5b9d20f71",
                  "Kit-Neural": "f66888bf-6dc3-40f7-8f38-ac717fc5f8ba"}

print("api base: "+ openai.api_base)
print("AZURE_OPENAI_GPT_DEPLOYMENT: " + AZURE_OPENAI_GPT_DEPLOYMENT) 
print("AZURE_OPENAI_CHATGPT_DEPLOYMENT: " + AZURE_OPENAI_CHATGPT_DEPLOYMENT)

# Comment these three lines out if using keys, set your API key in the OPENAI_API_KEY environment variable instead
openai.api_type = "azure_ad"
openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
openai.api_key = openai_token.token
# openai.api_key = 'df18afffcb2c4530a4e5c20115d99310' 

# # Comment these two lines out if using keys, set your API key in the SPEECH_KEY environment variable instead
# ibc = InteractiveBrowserCredential()
# speech_token = ibc.get_token("https://cognitiveservices.azure.com/.default")

# Set up clients for Cognitive Search and Storage
search_client = SearchClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
    index_name=AZURE_SEARCH_INDEX,
    credential=azure_credential)
blob_client = BlobServiceClient(
    account_url=f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net", 
    credential=azure_credential)
blob_container = blob_client.get_container_client(AZURE_STORAGE_CONTAINER)

# Various approaches to integrate GPT and external knowledge, most applications will use a single one of these patterns
# or some derivative, here we include several for exploration purposes

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
    blob = blob_container.get_blob_client(path).download_blob()
    if not blob.properties or not blob.properties.has_key("content_settings"):
        abort(404)
    mime_type = blob.properties["content_settings"]["content_type"]
    if mime_type == "application/octet-stream":
        mime_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    blob_file = io.BytesIO()
    blob.readinto(blob_file)
    blob_file.seek(0)
    return send_file(blob_file, mimetype=mime_type, as_attachment=False, download_name=path)
    
face_client = FaceClient(AZURE_FACE_ENDPOINT, CognitiveServicesCredentials(AZURE_FACE_KEY))
@app.route('/detectFace', methods=['POST'])
def analyze_image():
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    try:
        # receive image data from the frontend
        imageURL = request.json['imageURL']

        image_bytes = base64.b64decode(imageURL)
        image_stream = io.BytesIO(image_bytes)

        # use Azure Face API to analyze the image
        detected_faces = face_client.face.detect_with_stream(image_stream, detection_model="detection_03", recognition_model='recognition_04', return_face_attributes=['qualityForRecognition'])
        
        face_ids = []
        for face in detected_faces:
            # Only take the face if it is of sufficient quality.
            if face.face_attributes.quality_for_recognition == QualityForRecognition.high or face.face_attributes.quality_for_recognition == QualityForRecognition.medium:
                face_ids.append(face.face_id)

                # Identify faces

        results = face_client.face.identify(face_ids, PERSON_GROUP_ID)

        detect_response = [len(face_ids)]

        print('Start identifying faces in image')
        if not results:
            print('No person identified in the person group')
        for identifiedFace in results:
            if len(identifiedFace.candidates) > 0:
                # print('Person is identified for face ID {} in image, with a confidence of {}.'.format(identifiedFace.face_id, identifiedFace.candidates[0].confidence)) # Get topmost confidence score

                # Verify faces
                verify_result = face_client.face.verify_face_to_person(identifiedFace.face_id, identifiedFace.candidates[0].person_id, PERSON_GROUP_ID)
                # print('verification result: {}. confidence: {}.'.format(verify_result.is_identical, verify_result.confidence, identifiedFace.candidates[0].person_id))
                # get candidates' name
                if (verify_result.confidence > 0.5):
                    person = face_client.person_group_person.get(PERSON_GROUP_ID, identifiedFace.candidates[0].person_id)
                    print('Person name: {}.'.format(person.name))
                    detect_response.append(person.name)
            else:
                print('No person identified for face ID {} in image.'.format(identifiedFace.face_id))

        # return the results
        return jsonify(detect_response)
    except Exception as e:
        logging.exception("Exception in /detectFace")
        return jsonify({"error": str(e)}), 500

@app.route('/stt')  
def stt():
    # ensure_openai_token()
    config = {
        'speech_key': SPEECH_KEY,
        'speech_region': SPEECH_REGION
    }
    return jsonify(config)
    
@app.route("/chat", methods=["POST"])
def chat():
    ensure_openai_token()
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
    

def detectLanguage(text: str, mode: str):
    return 'en-US', text


@app.route("/tts", methods=["POST"])
def tts():
    ensure_openai_token()
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    try:
        custom_end_point = ""
        voice = request.json['voice']
        text = request.json['text']
        language = "en-US"
        print(voice)
        try:
            custom_end_point = voice_endpoint[voice]
            SPEECH_REGION = os.environ.get("SPEECH_REGION") or "eastus"
            SPEECH_KEY = os.environ.get("SPEECH_KEY") or "85fb2247be2041398aa1e55ab91ea74c"
        except:
            SPEECH_REGION = os.environ.get("SPEECH_REGION") or "eastasia"
            SPEECH_KEY = os.environ.get("SPEECH_KEY") or "49d3a59e428b48dc94fc20d81bdd5df6"
            pass
        
        # audio_buffer = io.BytesIO()
        speech_config = speechsdk.SpeechConfig(subscription= SPEECH_KEY, region= SPEECH_REGION)
        # audio_config = speechsdk.audio.AudioOutputConfig(use_default_speaker=True)
        # speech_config.speech_synthesis_voice_name='en-US-JennyNeural'
        if (custom_end_point != ""):
            speech_config.endpoint_id = custom_end_point
        print()
        if custom_end_point == "":
            
            print('voice', voice)      
            speech_config.speech_synthesis_voice_name = voice
        

        speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
        speech_synthesis_result = speech_synthesizer.speak_text_async(text).get()
        # stream = speechsdk.AudioDataStream(speech_synthesis_result)
        # stream.read_data(audio_buffer)
        audio_bytes = speech_synthesis_result.audio_data
        # audio_bytes = str(audio_bytes)[2:-1] #.encode()
        #print(audio_bytes[:50])
        
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


viseme_audio = {}
@app.route("/viseme", methods=["POST"])
def viseme():
    # ensure_openai_token()
    
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
        language = "en-US"
        print("anguage, text, voice: ", language, text, voice)

        ssml = SSML.replace("__TEXT__", text).replace("en-US-GuyNeural", voice)
        print('ssml:', ssml)

        # audio_buffer = io.BytesIO()
        speech_config = speechsdk.SpeechConfig(subscription= SPEECH_KEY, region= SPEECH_REGION)
        speech_config.speechSynthesisOutputFormat = 11; # wav

        speech_config.speech_synthesis_voice_name = voice

        try:
            speech_config.endpoint_id = voice_endpoint[voice]
        except:
            pass
        
        
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
            # print(animation)
            
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
    
@app.route("/visemeAudio", methods=["GET"])
def visemeAudio():
    # ensure_openai_token()
    if request.remote_addr in viseme_audio.keys():
        audio_bytes = viseme_audio[request.remote_addr]
        resp = Response(audio_bytes, 200)
        resp.headers["Content-Type"] = 'audio/wav'
        del viseme_audio[request.remote_addr]
        return resp
    else:
        return jsonify({"error": "no audio"}), 400
    
    

def ensure_openai_token():
    # return True
    global openai_token
    if openai_token.expires_on < int(time.time()) - 60:
        openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
        openai.api_key = openai_token.token
    

# def ensure_speech_token():
#     global speech_token
#     if openai_token.expires_on < int(time.time()) - 60:
#         ibc = InteractiveBrowserCredential()
#         speech_token = ibc.get_token("https://cognitiveservices.azure.com/.default")

if __name__ == "__main__":
    app.run()
