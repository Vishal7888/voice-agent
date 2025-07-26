require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const bodyParser = require('body-parser');
const { GoogleAuth } = require('google-auth-library');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// ✅ Create Google Auth using env vars
const googleAuth = new GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const sttClient = new speech.SpeechClient({ auth: googleAuth });
const ttsClient = new textToSpeech.TextToSpeechClient({ auth: googleAuth });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Test route
app.get('/', (req, res) => {
  res.send('✅ Voice AI Agent Server is running');
});

// 🎙️ Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  socket.on('audio', async (audioBuffer) => {
    try {
      console.log('🎧 Received audio buffer');

      // 1. Transcribe speech
      const [sttResponse] = await sttClient.recognize({
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 8000,
          languageCode: 'en-US',
        },
      });

      const transcript = sttResponse.results?.[0]?.alternatives?.[0]?.transcript || '';
      console.log('📝 Transcript:', transcript);

      // 2. Generate AI response (replace with GPT if needed)
      const aiReply = `You said: ${transcript}`;

      // 3. Convert AI response to speech
      const [ttsResponse] = await ttsClient.synthesizeSpeech({
        input: { text: aiReply },
        voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'LINEAR16' },
      });

      // 4. Emit audio response
      socket.emit('audio-response', ttsResponse.audioContent);
      console.log('📤 Sent audio response');
    } catch (err) {
      console.error('❌ Error in processing audio:', err.message);
      socket.emit('error', 'Speech processing failed.');
    }
  });

  socket.on('disconnect', () => {
    console.log(`❎ Client disconnected: ${socket.id}`);
  });
});

// 🚀 Start server
const PORT = process.env.PORT || 3100;
server.listen(PORT, () => {
  console.log(`✅ Voice Agent server running on http://localhost:${PORT}`);
});
