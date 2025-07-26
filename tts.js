// tts.js
import textToSpeech from "@google-cloud/text-to-speech";
import util from "util";
import dotenv from "dotenv";
dotenv.config();

const credentials = JSON.parse(process.env.GOOGLE_TTS_KEY);

const client = new textToSpeech.TextToSpeechClient({
  credentials,
});

export const GoogleTTS = {
  async synthesize(text) {
    const request = {
      input: { text },
      voice: {
        languageCode: "en-US",
        ssmlGender: "NEUTRAL",
      },
      audioConfig: {
        audioEncoding: "LINEAR16",
        sampleRateHertz: 8000,
      },
    };

    const [response] = await client.synthesizeSpeech(request);
    return response.audioContent;
  },
};
