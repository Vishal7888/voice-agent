// telecmi.js
import axios from "axios";

export async function startTeleCMIStream(session_uuid, ws_url) {
  const appid = process.env.TELECMI_APP_ID;
  const secret = process.env.TELECMI_APP_SECRET;

  const payload = {
    appid,
    secret,
    enable: true,
    session_uuid,
    ws_url,
    listen_mode: "caller"
  };

  const url = "https://rest.telecmi.com/v2/setting/stream";

  try {
    const response = await axios.post(url, payload);
    console.log("✅ TeleCMI REST stream started:", response.data);
  } catch (error) {
    console.error("❌ TeleCMI REST stream error:", error.response?.data || error.message);
  }
}
