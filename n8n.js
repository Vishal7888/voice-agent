// services/n8n.js
import axios from "axios";

const N8N_WEBHOOK = process.env.N8N_WEBHOOK_URL;

export async function sendToN8nAgent({ input, phone, channel }) {
  try {
    const response = await axios.post(N8N_WEBHOOK, {
      input,
      phone,
      channel
    });
    return response.data;
  } catch (error) {
    console.error("[n8n error]", error?.response?.data || error.message);
    return { text: "Sorry, I couldn't process that." };
  }
}
