// tts.js
import textToSpeech from "@google-cloud/text-to-speech";
import dotenv from "dotenv";
dotenv.config();

const client = new textToSpeech.TextToSpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_TTS_KEY)
});

export const GoogleTTS = {
  async synthesize(text) {
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
      audioConfig: { audioEncoding: "LINEAR16" }
    });

    return response.audioContent;
  }
};
