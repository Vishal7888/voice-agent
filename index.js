// index.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { startTeleCMIStream } from "./telecmi.js";
import { GoogleSTT } from "./stt.js";
import { GoogleTTS } from "./tts.js";
import { sendToN8nAgent } from "./n8n.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 10000;
app.use(express.json());

// ✅ /telecmi route — receives initial webhook from TeleCMI
app.post("/telecmi", async (req, res) => {
  const call_id = req.query.call_id || req.body?.call_id;
  const session_uuid = req.query.session_uuid || req.body?.session_uuid;
  const from = req.query.from || req.body?.from;

  console.log("📞 [TeleCMI] Incoming webhook payload:");
  console.log("  call_id:", call_id);
  console.log("  session_uuid:", session_uuid);
  console.log("  from:", from);

  const ws_url = process.env.WS_URL || "wss://voice-agent-tcxk.onrender.com/ws";

  const response = [
    {
      action: "stream",
      ws_url,
      listen_mode: "caller",
      voice_quality: "8000",
      stream_on_answer: true
    }
  ];

  if (call_id && session_uuid) {
    try {
      await startTeleCMIStream(session_uuid, ws_url);
    } catch (err) {
      console.error("❌ TeleCMI REST stream error:", err.message);
    }
  } else {
    console.warn("⚠️ Missing session_uuid or call_id in /telecmi");
  }

  return res.json(response);
});

// ✅ Upgrade HTTP to WebSocket
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// ✅ WebSocket call logic
wss.on("connection", (ws, req) => {
  const socketId = Math.random().toString(36).substring(2, 10);
  console.log("✅ WebSocket connected:", socketId);

  ws.send(JSON.stringify({ event: "ready" }));
  console.log("📡 Sent 'ready' to TeleCMI");

  const pingInterval = setInterval(() => {
    ws.send(JSON.stringify({ event: "ping" }));
    console.log("⏱️ Sent ping");
  }, 5000);

  let buffer = "";

  ws.on("message", async (data) => {
    try {
      const raw = data.toString();
      console.log("📩 Raw WebSocket message:", raw);

      const msg = JSON.parse(raw);
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
    console.log("❌ WebSocket disconnected:", socketId);
    clearInterval(pingInterval);
  });
});

server.listen(PORT, () => {
  console.log(`✅ AI Agent server listening on port ${PORT}`);
});
