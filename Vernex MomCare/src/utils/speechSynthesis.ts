import type { VoiceLanguage } from '@/hooks/useSpeechRecognition';

const SPEECH_LANGUAGES: Record<VoiceLanguage, string> = {
  en: 'en-US',
};

let activeSpeakRequestId = 0;
export const SPEECH_EVENT_NAME = 'vnx-thozhi-speech-state';

const PREFERRED_FEMININE_VOICE_HINTS = [
  'female',
  'woman',
  'mother',
  'feminine',
  'samantha',
  'zira',
  'aria',
  'ava',
  'victoria',
  'karen',
  'moira',
  'hazel',
  'susan',
  'lisa',
  'heera',
  'priya',
  'veena',
];

const getVoiceScore = (voice: SpeechSynthesisVoice) => {
  const fingerprint = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  return PREFERRED_FEMININE_VOICE_HINTS.reduce(
    (score, hint) => score + (fingerprint.includes(hint) ? 1 : 0),
    0
  );
};

const pickVoice = (voices: SpeechSynthesisVoice[], language: VoiceLanguage) => {
  const fullLanguage = SPEECH_LANGUAGES[language].toLowerCase();
  const languagePrefix = language.toLowerCase();
  const matchingVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(languagePrefix)
  );
  const exactLanguageVoices = matchingVoices.filter(
    (voice) => voice.lang.toLowerCase() === fullLanguage
  );
  const prioritizedVoices = (exactLanguageVoices.length > 0 ? exactLanguageVoices : matchingVoices)
    .map((voice) => ({ voice, score: getVoiceScore(voice) }))
    .sort((left, right) => right.score - left.score);

  if (prioritizedVoices[0]?.score > 0) {
    return prioritizedVoices[0].voice;
  }
  return exactLanguageVoices[0] ?? matchingVoices[0] ?? null;
};

const waitForVoices = async (synthesis: SpeechSynthesis, attempts = 6, delayMs = 250) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const voices = synthesis.getVoices();
    if (voices.length > 0) {
      return voices;
    }

    await new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        synthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve();
      }, delayMs);

      const handleVoicesChanged = () => {
        window.clearTimeout(timeoutId);
        synthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve();
      };

      synthesis.addEventListener('voiceschanged', handleVoicesChanged, { once: true });
    });
  }

  return synthesis.getVoices();
};

const buildUtterance = (
  text: string,
  language: VoiceLanguage,
  voice?: SpeechSynthesisVoice | null
) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANGUAGES[language];
  if (voice) {
    utterance.voice = voice;
  }
  utterance.pitch = 1.18;
  utterance.rate = 0.9;
  utterance.volume = 1;
  return utterance;
};

const dispatchSpeechState = (state: 'start' | 'end') => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(SPEECH_EVENT_NAME, {
      detail: { state },
    })
  );
};

export function speakResponse(text: string, language: VoiceLanguage) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  const content = text.trim();
  if (!content) {
    return false;
  }

  const synthesis = window.speechSynthesis;
  const requestId = ++activeSpeakRequestId;

  void (async () => {
    const voices = await waitForVoices(synthesis);

    if (requestId !== activeSpeakRequestId) {
      return;
    }

    const voice = pickVoice(voices, language);
    const utterance = buildUtterance(content, language, voice);

    utterance.onstart = () => {
      if (requestId !== activeSpeakRequestId) return;
      dispatchSpeechState('start');
    };
    utterance.onend = () => {
      if (requestId !== activeSpeakRequestId) return;
      dispatchSpeechState('end');
    };
    utterance.onerror = () => {
      if (requestId !== activeSpeakRequestId) return;
      dispatchSpeechState('end');
    };

    synthesis.cancel();
    synthesis.speak(utterance);
  })();

  return true;
}

export function stopSpeaking() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  activeSpeakRequestId += 1;
  window.speechSynthesis.cancel();
  dispatchSpeechState('end');
}
