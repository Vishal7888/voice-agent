import { startTeleCMIStream } from "./telecmi.js";

app.post("/telecmi", async (req, res) => {
  const call_id = req.body?.call_id;
  console.log("[TeleCMI] Incoming call:", req.body);

  const ws_url = process.env.WS_URL || "wss://voice-agent-tcxk.onrender.com/ws";

  // Respond with standard PCMO stream action
  const response = [
    {
      action: "stream",
      ws_url,
      listen_mode: "caller",
      voice_quality: "8000",
      stream_on_answer: true
    }
  ];

  // 🔁 Also explicitly start the stream via REST API
  if (call_id) {
    await startTeleCMIStream(call_id, ws_url);
  } else {
    console.warn("⚠️ No call_id received from TeleCMI — cannot start REST stream.");
  }

  return res.json(response);
});
