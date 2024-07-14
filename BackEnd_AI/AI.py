import uuid
from flask import Flask, request, jsonify, make_response, send_file, session
from flask_cors import CORS
import openai
import re
import os
import speech_recognition as sr
from pydub import AudioSegment
from gtts import gTTS
import tempfile
from werkzeug.utils import secure_filename
from openai import OpenAI


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

os.environ["OPENAI_API_KEY"] = "sk-None-fqRBR0V3R2GGz3JUPcrhT3BlbkFJSk0DJ3d5kcwZdynMoC2O"
app.secret_key = '0-0-0-0-destruct-0'

# Specify the path to your system prompt text file here
SYSTEM_PROMPT_PATH = "prompt.txt"
AUDIO_FOLDER = "audio_files"

if not os.path.exists(AUDIO_FOLDER):
    os.makedirs(AUDIO_FOLDER)

def read_system_prompt(file_path):
    try:
        with open(file_path, 'r') as file:
            return file.read()
    except FileNotFoundError:
        print(f"Error: System prompt file not found at {file_path}")
        return None
    except IOError:
        print(f"Error: Unable to read system prompt file at {file_path}")
        return None

system_prompt = read_system_prompt(SYSTEM_PROMPT_PATH)



def get_ai_response(messages):
    try:
        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4o",  # Changed from "gpt-4o" to "gpt-4"
            messages=messages
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"Error in OpenAI API call: {e}")
        return "I apologize, but I'm having trouble processing your request right now. Please try again."


def extract_information(response_text):
    patterns = {
        'Location': r'Location: (.*?)\n',
        'Description / Status of Individuals': r'Description / Status of Individuals: (.*?)\n',
        'Type of Service': r'Type of Service: (.*?)\n',
        'Situation Details': r'Situation Details: (.*?)\n',
        'Outputted Message to Caller': r'Outputted Message to Caller: (.*?)$'
    }
    extracted_info = {}
    for key, pattern in patterns.items():
        matches = re.findall(pattern, response_text, re.DOTALL)
        extracted_info[key] = matches[0].strip() if matches else 'Unknown'
    return extracted_info


def speech_to_text(audio_file):
    recognizer = sr.Recognizer()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio_file:
        audio_file.save(temp_audio_file.name)
        temp_audio_file_path = temp_audio_file.name

    try:
        # Convert the audio to WAV format
        audio = AudioSegment.from_file(temp_audio_file_path)
        wav_path = temp_audio_file_path + ".wav"
        audio.export(wav_path, format="wav")

        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            return text
    except sr.UnknownValueError:
        return "Speech recognition could not understand the audio"
    except sr.RequestError:
        return "Could not request results from the speech recognition service"
    except Exception as e:
        print(f"Error in speech_to_text: {str(e)}")
        return "An error occurred while processing the audio"
    finally:
        os.remove(temp_audio_file_path)
        if os.path.exists(wav_path):
            os.remove(wav_path)


def text_to_speech(text):
    filename = f"{uuid.uuid4()}.mp3"
    filepath = os.path.join(AUDIO_FOLDER, filename)
    tts = gTTS(text=text, lang='en')
    tts.save(filepath)
    return filename


# In AI.py

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def chat():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    elif request.method == "POST":
        data = request.json
        user_message = data.get('message', '')
        conversation = data.get('conversation', [])

        # If the conversation is empty, add the system prompt
        if not conversation:
            conversation = [{"role": "system", "content": system_prompt}]

        # Add the new user message to the conversation
        conversation.append({"role": "user", "content": user_message})

        ai_response = get_ai_response(conversation)
        extracted_info = extract_information(ai_response)

        # Add the AI's response to the conversation
        conversation.append({"role": "assistant", "content": ai_response})

        # Generate speech for AI response
        speech_file = text_to_speech(extracted_info['Outputted Message to Caller'])

        return _corsify_actual_response(jsonify({
            'message': extracted_info['Outputted Message to Caller'],
            'criticalInfo': {
                'Location': extracted_info['Location'],
                'Description': extracted_info['Description / Status of Individuals'],
                'Service': extracted_info['Type of Service'],
                'Situation': extracted_info['Situation Details']
            },
            'conversation': conversation,
            'speechFile': speech_file
        }))


@app.route('/api/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    return send_file(os.path.join(AUDIO_FOLDER, filename), mimetype="audio/mpeg")


def _build_cors_preflight_response():
    response = make_response()
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add('Access-Control-Allow-Headers', "*")
    response.headers.add('Access-Control-Allow-Methods', "*")
    return response


def _corsify_actual_response(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response



@app.route('/api/speech-to-text', methods=['POST', 'OPTIONS'])
def handle_speech_to_text():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    elif request.method == "POST":
        if 'audio' not in request.files:
            return _corsify_actual_response(jsonify({'error': 'No audio file provided'})), 400

        audio_file = request.files['audio']
        text = speech_to_text(audio_file)

        return _corsify_actual_response(jsonify({'text': text}))

@app.route('/api/system-prompt', methods=['GET'])
def get_system_prompt():
    try:
        with open(SYSTEM_PROMPT_PATH, 'r') as file:
            prompt = file.read()
        return jsonify({"prompt": prompt})
    except Exception as e:
        print(f"Error reading system prompt: {e}")
        return jsonify({"error": "Failed to read system prompt"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')