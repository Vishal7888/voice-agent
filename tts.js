// tts.js
import textToSpeech from "@google-cloud/text-to-speech";

const client = new textToSpeech.TextToSpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_TTS_KEY),
});

export const GoogleTTS = {
  synthesize: async (text) => {
    const request = {
      input: { text },
      voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
      audioConfig: { audioEncoding: "LINEAR16" },
    };

    const [response] = await client.synthesizeSpeech(request);
    return response.audioContent.toString("base64");
  },
};
