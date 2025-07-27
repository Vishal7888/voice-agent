const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// Load environment variables
const PORT = process.env.PORT || 10000;
const TELECMI_APP_ID = process.env.TELECMI_APP_ID;
const TELECMI_APP_SECRET = process.env.TELECMI_APP_SECRET;

// Middleware
app.use(cors());
app.use(express.json()); // 💡 required to parse JSON body

// ✅ WebSocket handler
io.of('/ws').on('connection', (socket) => {
  console.log('[Socket.IO] WebSocket client connected');

  socket.emit('ready', { message: 'Socket connected and ready' });

  socket.on('pong', () => {
    console.log('[Socket.IO] Pong received');
  });

  // Optional: send keep-alive ping every 5 seconds
  const pingInterval = setInterval(() => {
    socket.emit('ping');
  }, 5000);

  socket.on('disconnect', () => {
    console.log('[Socket.IO] WebSocket client disconnected');
    clearInterval(pingInterval);
  });
});

// ✅ Route to receive TeleCMI webhook
app.post('/telecmi', async (req, res) => {
  console.log('[TeleCMI] Incoming webhook payload:', JSON.stringify(req.body, null, 2));

  const { call_id, session_uuid } = req.body;

  if (!call_id || !session_uuid) {
    console.error('❌ Missing call_id or session_uuid from TeleCMI');
    return res.status(400).send('Missing call_id or session_uuid');
  }

  try {
    await startTeleCMIStream(call_id, session_uuid);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Failed to start TeleCMI stream:', error.response?.data || error.message);
    res.status(500).send('Stream start failed');
  }
});

// ✅ Function to start REST audio stream via TeleCMI
async function startTeleCMIStream(call_id, session_uuid) {
  const payload = {
    app_id: TELECMI_APP_ID,
    app_secret: TELECMI_APP_SECRET,
    call_id,
    session_uuid
  };

  console.log('[TeleCMI] Starting stream with payload:', payload);

  const response = await axios.post('https://chub.telecmi.com/v1/start_stream', payload);
  console.log('✅ TeleCMI REST stream started:', response.data);
}

// ✅ Start server
server.listen(PORT, () => {
  console.log(`✅ AI Agent server listening on port ${PORT}`);
});
