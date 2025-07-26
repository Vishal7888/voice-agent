// stt.js
import speech from "@google-cloud/speech";

const client = new speech.SpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_STT_KEY),
});

export const GoogleSTT = {
  transcribe: async (audioBuffer) => {
    const audioBytes = audioBuffer.toString("base64");

    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: 8000,
        languageCode: "en-US",
      },
    };

    const [response] = await client.recognize(request);
    const transcription =
      response.results
        .map((result) => result.alternatives[0]?.transcript)
        .join(" ")
        .trim();

    return transcription;
  },
};
