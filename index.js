// index.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { GoogleSTT } from "./stt.js";
import { GoogleTTS } from "./tts.js";
import { sendToN8nAgent } from "./n8n.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 10000;
app.use(express.json());

// TeleCMI webhook - Answer URL
app.post("/telecmi", (req, res) => {
  console.log("[TeleCMI] Incoming call:", req.body);
  return res.json({
    action: "stream",
    ws_url: process.env.WS_URL || "wss://voice-agent-tcxk.onrender.com/ws",
    listen_mode: "caller",
    voice_quality: "8000"
  });
});

// WebSocket upgrade route
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// WebSocket voice logic
wss.on("connection", (ws) => {
  console.log("✅ WebSocket connected");

  ws.send(JSON.stringify({ event: "ready" }));
  console.log("📡 Sent 'ready' to TeleCMI");

  // 🔊 Send welcome TTS within 1 second
  setTimeout(async () => {
    try {
      const welcomeText = "Hi, how can I help you?";
      const audio = await GoogleTTS.synthesize(welcomeText);
      ws.send(JSON.stringify({ event: "audio-response", audio }));
      console.log("🔊 Sent welcome message");
    } catch (err) {
      console.error("❌ Error sending welcome message:", err.message || err);
    }
  }, 1000);

  // ⏱️ Keep-alive ping every 5 seconds
  const pingInterval = setInterval(() => {
    ws.send(JSON.stringify({ event: "ping" }));
    console.log("⏱️ Sent ping");
  }, 5000);

  let buffer = "";

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data);

      console.log("📥 Received:", msg.event);

      if (msg.event === "ping") {
        ws.send(JSON.stringify({ event: "pong" }));
        console.log("↩️ Replied with pong");
        return;
      }

      if (msg.event === "media" && msg.media?.payload) {
        const audioBuffer = Buffer.from(msg.media.payload, "base64");
        const text = await GoogleSTT.transcribe(audioBuffer);

        if (text) {
          buffer += text + " ";
          console.log("[STT]", text);

          if (text.trim().endsWith(".")) {
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
              ws.send(JSON.stringify({ event: "audio-response", audio }));
            }
          }
        }
      }
    } catch (err) {
      console.error("[Error]", err.message || err);
    }
  });

  ws.on("close", () => {
    console.log("❌ WebSocket disconnected");
    clearInterval(pingInterval);
  });
});

server.listen(PORT, () => {
  console.log(`✅ AI Agent server listening on port ${PORT}`);
});
