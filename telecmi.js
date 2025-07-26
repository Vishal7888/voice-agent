// telecmi.js
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export async function startTeleCMIStream(session_uuid) {
  const app_id = process.env.TELECMI_APP_ID;
  const app_secret = process.env.TELECMI_APP_SECRET;

  if (!app_id || !app_secret) {
    console.error("❌ Missing TELECMI_APP_ID or TELECMI_APP_SECRET");
    return;
  }

  try {
    const url = `https://chub.telecmi.com/v1/p/call/stream/start`;
    const response = await axios.post(url, {
      session_uuid
    }, {
      headers: {
        "x-app-id": app_id,
        "x-app-secret": app_secret,
        "Content-Type": "application/json"
      }
    });

    console.log("📡 TeleCMI stream start response:", response.data);
  } catch (err) {
    console.error("❌ Failed to start TeleCMI stream:", err?.response?.data || err.message);
  }
}
