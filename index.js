// index.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { GoogleSTT } from "./stt.js";
import { GoogleTTS } from "./tts.js";
import { sendToN8nAgent } from "./n8n.js";
import { startTeleCMIStream } from "./telecmi.js"; // ✅ make sure this exists
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 10000;
app.use(express.json());

// ✅ TeleCMI Answer URL route
app.post("/telecmi", async (req, res) => {
  const session_uuid = req.body?.session_uuid;
  console.log("[TeleCMI] Incoming call:", req.body);

  const ws_url = process.env.WS_URL || "wss://voice-agent-tcxk.onrender.com/ws";

  // 1. Send PCMO stream action
  const response = [
    {
      action: "stream",
      ws_url,
      listen_mode: "caller",
      voice_quality: "8000",
      stream_on_answer: true
    }
  ];
  res.json(response);

  // 2. Start stream via TeleCMI REST API
  if (session_uuid) {
    try {
      await startTeleCMIStream(session_uuid, ws_url);
      console.log("✅ Called TeleCMI REST stream API");
    } catch (err) {
      console.error("❌ TeleCMI REST API error:", err.message);
    }
  } else {
    console.warn("⚠️ Missing session_uuid in /telecmi");
  }
});

// ✅ Handle WebSocket upgrade
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// ✅ WebSocket voice agent logic
wss.on("connection", (ws, req) => {
  const clientId = Math.random().toString(36).substring(2, 8);
  console.log(`✅ WebSocket connected: ${clientId}`);

  ws.send(JSON.stringify({ event: "ready" }));
  console.log("📡 Sent 'ready' to TeleCMI");

  const pingInterval = setInterval(() => {
    ws.send(JSON.stringify({ event: "ping" }));
    console.log("⏱️ Sent ping");
  }, 5000);

  let buffer = "";

  ws.on("message", async (data) => {
    try {
      // ✅ Raw debug logging
      console.log(`📥 Raw message (${clientId}):`, data.toString());

      const msg = JSON.parse(data);

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
      console.error("❌ Error handling message:", err.message || err);
    }
  });

  ws.on("close", () => {
    console.log(`❌ WebSocket disconnected: ${clientId}`);
    clearInterval(pingInterval);
  });
});

// ✅ Start server
server.listen(PORT, () => {
  console.log(`✅ AI Agent server listening on port ${PORT}`);
});
