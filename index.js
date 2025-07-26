// index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { GoogleSTT } from "./services/stt.js";
import { GoogleTTS } from "./services/tts.js";
import { sendToN8nAgent } from "./services/n8n.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;
app.use(express.json());

// Answer URL for PIOPIY
app.post("/telecmi", (req, res) => {
  console.log("[TeleCMI] Call received:", req.body);
  return res.json({
    action: "stream",
    ws_url: process.env.WS_URL || "wss://your-app.onrender.com/ws",
    listen_mode: "caller",
    voice_quality: "8000"
  });
});

// WebSocket handler
io.of("/ws").on("connection", (socket) => {
  console.log("[Socket.IO] Client connected:", socket.id);
  let buffer = "";

  socket.on("audio", async (chunk) => {
    try {
      const text = await GoogleSTT.transcribe(chunk);
      if (text) {
        buffer += text + " ";
        console.log("[STT]", text);

        if (text.endsWith(".")) {
          const fullText = buffer.trim();
          buffer = "";

          const n8nReply = await sendToN8nAgent({
            input: fullText,
            phone: process.env.AGENT_PHONE || "+911203134402",
            channel: "call"
          });

          if (n8nReply?.text) {
            console.log("[n8n AI]", n8nReply.text);
            const audio = await GoogleTTS.synthesize(n8nReply.text);
            socket.emit("audio-response", audio);
          }
        }
      }
    } catch (err) {
      console.error("[ERROR]", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("[Socket.IO] Disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ AI Agent server listening on port ${PORT}`);
});
