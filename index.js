import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

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

// TeleCMI CHUB webhook
app.post('/telecmi', (req, res) => {
  console.log('[TeleCMI] Incoming webhook payload:', JSON.stringify(req.body, null, 2));

  // ✅ Return WebSocket URL for TeleCMI CHUB to connect to
  res.json({
    socketUrl: 'wss://voice-agent-tcxk.onrender.com/ws'
  });
});

server.listen(PORT, () => {
  console.log(`✅ AI Agent server listening on port ${PORT}`);
});
