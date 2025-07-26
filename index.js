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

/**
 * This endpoint is used in PIOPIY as the "Answer URL"
 * It instructs TeleCMI to connect the call audio via WebSocket
 */
app.post("/telecmi", (req, res) => {
  console.log("[TeleCMI] Call received:", req.body);

  const wsUrl = process.env.WS_URL || "wss://voice-agent-tcxk.onrender.com/ws";

  return res.json([
    {
      action: "connect",
      from: "+911203134402",
      to: "agent",
      type: "websocket",
      url: wsUrl,
      headers: {
        caller: req.body.caller_id || "",
        uuid: req.body.uuid || ""
      }
    }
  ]);
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
