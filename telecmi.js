import { startTeleCMIStream } from "./telecmi.js";

app.post("/telecmi", async (req, res) => {
  const session_uuid = req.body?.session_uuid;
  console.log("[TeleCMI] Incoming call:", req.body);

  const ws_url = process.env.WS_URL || "wss://voice-agent-tcxk.onrender.com/ws";

  // Respond with PCMO stream action
  const response = [
    {
      action: "stream",
      ws_url,
      listen_mode: "caller",
      voice_quality: "8000",
      stream_on_answer: true
    }
  ];

  // ✅ Explicitly start the stream using TeleCMI REST API
  if (session_uuid) {
    await startTeleCMIStream(session_uuid);
  } else {
    console.warn("⚠️ Missing session_uuid in TeleCMI webhook — cannot start stream");
  }

  return res.json(response);
});
