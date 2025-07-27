import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { startTeleCMIStream } from './telecmi.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// WebSocket handler
io.of('/ws').on('connection', (socket) => {
  console.log('[Socket.IO] WebSocket client connected');
  socket.emit('ready', { message: 'Socket connected and ready' });

  socket.on('pong', () => console.log('[Socket.IO] Pong received'));

  const pingInterval = setInterval(() => {
    socket.emit('ping');
  }, 5000);

  socket.on('disconnect', () => {
    console.log('[Socket.IO] WebSocket client disconnected');
    clearInterval(pingInterval);
  });
});

// TeleCMI webhook
app.post('/telecmi', async (req, res) => {
  console.log('[TeleCMI] Incoming webhook payload:', JSON.stringify(req.body, null, 2));

  const { session_uuid } = req.body;

  if (!session_uuid) {
    console.error('❌ Missing session_uuid from TeleCMI');
    return res.status(400).send('Missing session_uuid');
  }

  try {
    const ws_url = 'wss://voice-agent-tcxk.onrender.com/ws'; // ✅ No port needed
    await startTeleCMIStream(session_uuid, ws_url);
    res.json({ socketUrl: ws_url });
  } catch (error) {
    console.error('❌ Failed to start TeleCMI stream:', error.response?.data || error.message);
    res.status(500).send('Stream start failed');
  }
});

server.listen(PORT, () => {
  console.log(`✅ AI Agent server listening on port ${PORT}`);
});
