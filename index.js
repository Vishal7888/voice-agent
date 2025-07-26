// index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { GoogleSTT } from "./stt.js";
import { GoogleTTS } from "./tts.js";
import { sendToN8nAgent } from "./n8n.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;
app.use(express.json());

// TeleCMI POST route
app.post("/telecmi", (req, res) => {
  console.log("[TeleCMI] Incoming call:", req.body);
  return res.json({
    action: "stream",
    ws_url: process.env.WS_URL || "wss://voice-agent-tcxk.onrender.com/ws",
    listen_mode: "caller",
    voice_quality: "8000"
  });
});

// WebSocket voice agent
io.of("/ws").on("connection", (socket) => {
  console.log("[Socket.IO] Connected:", socket.id);

  // Send ready signal immediately
  socket.emit("message", JSON.stringify({ event: "ready" }));

  // Start ping every 5 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    socket.emit("message", JSON.stringify({ event: "ping" }));
  }, 5000);

  let buffer = "";

  socket.on("message", async (data) => {
    try {
      const msg = JSON.parse(data);

      // Handle audio from TeleCMI
      if (msg.event === "media" && msg.media && msg.media.payload) {
        const audioBuffer = Buffer.from(msg.media.payload, "base64");
        const text = await GoogleSTT.transcribe(audioBuffer);

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
      }
    } catch (err) {
      console.error("[Message Error]", err.message || err);
    }
  });

  socket.on("disconnect", () => {
    console.log("[Socket.IO] Disconnected:", socket.id);
    clearInterval(pingInterval);
  });
});

server.listen(PORT, () => {
  console.log(`✅ AI Agent server listening on port ${PORT}`);
});
