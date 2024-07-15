import React, { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState([]);
  const [input, setInput] = useState('');
  const [criticalInfo, setCriticalInfo] = useState({
    Location: 'Unknown',
    Description: 'Unknown',
    Service: 'Unknown',
    Situation: 'Unknown'
  });
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio();

    // Fetch the system prompt from the server
    fetch('https://api-ai-911-dispatch-system-2e828cac3d00.herokuapp.com/api/system-prompt')
      .then(response => response.json())
      .then(data => {
        setConversation([{ role: 'system', content: data.prompt }]);
      })
      .catch(error => {
        console.error('Error fetching system prompt:', error);
        setConversation([{ role: 'system', content: 'You are a 911 call responder...' }]);
      });
  }, []);

  const handleSendMessage = async (message) => {
    if (message.trim() === '') return;

    // Update messages state for UI
    const newMessages = [...messages, { sender: 'user', text: message }];
    setMessages(newMessages);
    setInput('');

    // Update conversation state for API
    const newConversation = [...conversation, { role: 'user', content: message }];
    setConversation(newConversation);

    try {
      console.log('Sending request to server...');
      const response = await fetch('https://api-ai-911-dispatch-system-2e828cac3d00.herokuapp.com/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          conversation: newConversation
        }),
      });

      console.log('Response received:', response);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Data received:', data);

      // Update messages state for UI
      setMessages(prevMessages => [...prevMessages, { sender: 'ai', text: data.message, speechFile: data.speechFile }]);

      // Update conversation state for API
      setConversation(prevConversation => [...prevConversation, { role: 'assistant', content: data.message }]);

      setCriticalInfo(data.criticalInfo);

      // Play the AI's response
      playAudio(data.speechFile);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prevMessages => [...prevMessages, { sender: 'ai', text: 'Sorry, there was an error processing your request.' }]);
    }
  };

    const clearHistory = async () => {
      setMessages([]);

      fetch('https://api-ai-911-dispatch-system-2e828cac3d00.herokuapp.com/api/system-prompt')
      .then(response => response.json())
      .then(data => {
        setConversation([{ role: 'system', content: data.prompt }]);
      })
      .catch(error => {
        console.error('Error fetching system prompt:', error);
        setConversation([{ role: 'system', content: 'You are a 911 call responder...' }]);
      });

      setCriticalInfo({
        Location: 'Unknown',
        Description: 'Unknown',
        Service: 'Unknown',
        Situation: 'Unknown'
      });
    };

  const startRecording = () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();

        const audioChunks = [];
        mediaRecorder.addEventListener("dataavailable", event => {
          audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener("stop", () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          sendAudioToServer(audioBlob);
        });

        setIsRecording(true);
      });
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const sendAudioToServer = async (audioBlob) => {
    // Convert the blob to .wav format
    const wavBlob = await convertToWav(audioBlob);

    const formData = new FormData();
    formData.append('audio', wavBlob, 'recording.wav');

    try {
      const response = await fetch('https://api-ai-911-dispatch-system-2e828cac3d00.herokuapp.com/api/speech-to-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      handleSendMessage(data.text);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const convertToWav = (blob) => {
    return new Promise((resolve) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const fileReader = new FileReader();

      fileReader.onload = (e) => {
        audioContext.decodeAudioData(e.target.result, (buffer) => {
          const wavBuffer = audioBufferToWav(buffer);
          const wavBlob = new Blob([new DataView(wavBuffer)], { type: 'audio/wav' });
          resolve(wavBlob);
        });
      };

      fileReader.readAsArrayBuffer(blob);
    });
  };

  const audioBufferToWav = (buffer) => {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferData = new ArrayBuffer(length),
        view = new DataView(bufferData),
        channels = [],
        sample,
        offset = 0,
        pos = 0;

    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746D66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);  // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded in this demo)

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    // write interleaved data
    for(let i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

    while(pos < length) {
      for(let i = 0; i < numOfChan; i++) {             // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // scale to 16-bit signed int
        view.setInt16(pos, sample, true);             // write 16-bit sample
        pos += 2;
      }
      offset++                                     // next source sample
    }

    // create Blob
    return bufferData;

    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  };

  const playAudio = (speechFile) => {
    audioRef.current.src = `https://api-ai-911-dispatch-system-2e828cac3d00.herokuapp.com/api/audio/${speechFile}`;
    audioRef.current.play().catch(e => console.error("Error playing audio:", e));
  };

  const inputRef = useRef(null);
  useEffect(() => {
    const input = inputRef.current;
    const handleKeyDown = (event) => {
      if (event.key === 'Enter') {
        handleSendMessage(input.value);
      }
    };
    
    if (input) {
      input.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (input) {
        input.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, []);

  return (
    <div className="container">
      <h1 className="title">9-1-1 Assistant</h1>
      <div className="content">
        <div className="chat-box">
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.sender}`}>
                {message.text}
                {message.sender === 'ai' && message.speechFile && (
                  <button class="button" onClick={() => playAudio(message.speechFile)}>Play Audio</button>
                )}
              </div>
            ))}
          </div>
          <div className="input-container">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message 9-1-1 Assistant"
              className="input"
            />
            <button className="button" onClick={() => handleSendMessage(inputRef.current.value)}>
              <img src="https://i.ibb.co/KbF30Sd/send-alt-2-svgrepo-com.png" alt="Send"/>
            </button>
            <button style={{marginRight: '10px'}} className="button" onClick={isRecording ? stopRecording : startRecording}>
              <img src={isRecording ? 'https://i.ibb.co/vZrKQTb/microphone-svgrepo-com-2.png' : 'https://i.ibb.co/p0RYNvL/microphone-svgrepo-com-1.png'} alt="Record"/>
            </button>
          </div>
        </div>
        <div className="info-box">
          <h2>Critical Information</h2>
          <p><strong>Location:</strong> {criticalInfo.Location}</p>
          <p><strong>Description / Status:</strong> {criticalInfo.Description}</p>
          <p><strong>Type of Service:</strong> {criticalInfo.Service}</p>
          <p><strong>Situation Details:</strong> {criticalInfo.Situation}</p>
          <button className="clear" onClick={clearHistory}>Clear History</button>
        </div>
      </div>
    </div>
  );
}

export default App;
