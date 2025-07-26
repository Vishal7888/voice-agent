// index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { startTeleCMIStream } from "./telecmi.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Step 2: Debug TeleCMI Webhook POST data
app.post("/telecmi", async (req, res) => {
  console.log("📞 [TeleCMI] Incoming webhook payload:\n", JSON.stringify(req.body, null, 2));

  const session_uuid = req.body?.session_uuid;
  const ws_url = process.env.WS_URL || "wss://voice-agent-tcxk.onrender.com/ws";

  // Response for TeleCMI: Tell it to open a WebSocket stream
  const response = [
    {
      action: "stream",
      ws_url,
      listen_mode: "caller",
      voice_quality: "8000",
      stream_on_answer: true
    }
  ];

  // Start stream via REST API if we have the session_uuid
  if (session_uuid) {
    try {
      await startTeleCMIStream(session_uuid, ws_url);
    } catch (err) {
      console.error("❌ Failed to start TeleCMI REST stream");
    }
  } else {
    console.warn("⚠️ Missing session_uuid in TeleCMI webhook payload");
  }

  return res.json(response);
});

// WebSocket for audio streaming
io.of("/ws").on("connection", (socket) => {
  console.log(`✅ WebSocket connected: ${socket.id}`);
  socket.emit("ready");

  const pingInterval = setInterval(() => {
    socket.emit("ping");
    console.log("⏱️ Sent ping");
  }, 5000);

  socket.on("disconnect", () => {
    clearInterval(pingInterval);
    console.log(`❌ WebSocket disconnected: ${socket.id}`);
  });

  socket.on("audio", (data) => {
    console.log(`🎧 Received audio chunk (${data.length} bytes)`);
    // Process STT, AI, and reply here...
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`✅ AI Agent server listening on port ${PORT}`);
});
