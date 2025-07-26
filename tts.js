// services/tts.js
import textToSpeech from "@google-cloud/text-to-speech";
const ttsClient = new textToSpeech.TextToSpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_TTS_KEY)
});

export const GoogleTTS = {
  async synthesize(text) {
    const request = {
      input: { text },
      voice: {
        languageCode: "en-IN",
        ssmlGender: "FEMALE"
      },
      audioConfig: {
        audioEncoding: "LINEAR16",
        sampleRateHertz: 8000
      }
    };
    const [response] = await ttsClient.synthesizeSpeech(request);
    return response.audioContent;
  }
};
