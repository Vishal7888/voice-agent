// index.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { GoogleSTT } from "./stt.js";
import { GoogleTTS } from "./tts.js";
import { sendToN8nAgent } from "./n8n.js";
import { startTeleCMIStream } from "./telecmi.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 10000;
app.use(express.json());

// ✅ /telecmi webhook endpoint
app.post("/telecmi", async (req, res) => {
  const session_uuid = req.body?.session_uuid;
  console.log("[TeleCMI] Incoming call:", req.body);

  const ws_url = process.env.WS_URL || "wss://voice-agent-tcxk.onrender.com/ws";

  // ✅ Respond with PCMO stream action
  const response = [
    {
      action: "stream",
      ws_url,
      listen_mode: "caller",
      voice_quality: "8000",
      stream_on_answer: true
    }
  ];

  // ✅ Explicitly start the stream via TeleCMI REST API
  if (session_uuid) {
    await startTeleCMIStream(session_uuid);
  } else {
    console.warn("⚠️ session_uuid missing — cannot start stream");
  }

  return res.json(response);
});

// ✅ Upgrade HTTP -> WebSocket for TeleCMI
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// ✅ WebSocket agent logic
wss.on("connection", (ws) => {
  console.log("✅ WebSocket connected");

  ws.send(JSON.stringify({ event: "ready" }));
  console.log("📡 Sent 'ready' to TeleCMI");

  const pingInterval = setInterval(() => {
    ws.send(JSON.stringify({ event: "ping" }));
    console.log("⏱️ Sent ping");
  }, 5000);

  let buffer = "";

  ws.on("message", async (raw) => {
    try {
      console.log("📩 Raw message:", raw.toString());

      const msg = JSON.parse(raw);

      if (msg.event === "ping") {
        ws.send(JSON.stringify({ event: "pong" }));
        console.log("↩️ Sent pong");
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

            const reply = await sendToN8nAgent({
              input: fullText,
              phone: process.env.AGENT_PHONE || "+911203134402",
              channel: "call"
            });

            if (reply?.text) {
              console.log("[n8n AI]", reply.text);
              const audio = await GoogleTTS.synthesize(reply.text);
              ws.send(JSON.stringify({ event: "audio-response", audio }));
            }
          }
        }
      }
    } catch (err) {
      console.error("[WebSocket Error]", err.message || err);
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
