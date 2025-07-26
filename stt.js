// services/stt.js
import speech from "@google-cloud/speech";

const sttClient = new speech.SpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_STT_KEY)
});

export const GoogleSTT = {
  async transcribe(audioBuffer) {
    const audioBytes = audioBuffer.toString("base64");
    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: 8000,
        languageCode: "en-IN"
      }
    };
    const [response] = await sttClient.recognize(request);
    return response.results?.[0]?.alternatives?.[0]?.transcript || "";
  }
};
