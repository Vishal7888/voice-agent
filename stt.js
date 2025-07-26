// stt.js
import speech from "@google-cloud/speech";
import dotenv from "dotenv";
dotenv.config();

const client = new speech.SpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_STT_KEY)
});

export const GoogleSTT = {
  async transcribe(audioBuffer) {
    const audioBytes = audioBuffer.toString("base64");

    const [response] = await client.recognize({
      audio: { content: audioBytes },
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: 8000,
        languageCode: "en-US"
      }
    });

    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join(" ");

    return transcription;
  }
};
