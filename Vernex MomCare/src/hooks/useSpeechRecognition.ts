import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceLanguage = 'en';

const RECOGNITION_LANGUAGES: Record<VoiceLanguage, string> = {
  en: 'en-US',
};

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  [index: number]: BrowserSpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface BrowserSpeechRecognitionResultList {
  [index: number]: BrowserSpeechRecognitionResult;
  length: number;
}

interface BrowserSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onend: ((event: Event) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onstart: ((event: Event) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const getSpeechRecognitionError = (error: string) => {
  switch (error) {
    case 'audio-capture':
      return 'No microphone was detected.';
    case 'network':
      return 'Speech recognition is unavailable right now.';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked.';
    case 'no-speech':
      return 'No speech was detected.';
    default:
      return 'Voice input could not be started.';
  }
};

export function useSpeechRecognition(language: VoiceLanguage) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const finalTranscriptRef = useRef('');
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = RECOGNITION_LANGUAGES[language];
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };
    recognition.onresult = (event) => {
      let nextFinalTranscript = '';
      let nextInterimTranscript = '';

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const chunk = result?.[0]?.transcript ?? '';

        if (result?.isFinal) {
          nextFinalTranscript += chunk;
        } else {
          nextInterimTranscript += chunk;
        }
      }

      const normalizedFinalTranscript = nextFinalTranscript.trim();
      const nextTranscript = `${normalizedFinalTranscript} ${nextInterimTranscript}`.trim();
      transcriptRef.current = nextTranscript;
      setTranscript(nextTranscript);

      if (normalizedFinalTranscript) {
        finalTranscriptRef.current = normalizedFinalTranscript;
        setFinalTranscript(normalizedFinalTranscript);
      }
    };
    recognition.onerror = (event) => {
      setError(getSpeechRecognitionError(event.error));
      setIsListening(false);
    };
    recognition.onend = () => {
      const normalizedTranscript = transcriptRef.current.trim();

      if (normalizedTranscript && !finalTranscriptRef.current) {
        finalTranscriptRef.current = normalizedTranscript;
        setFinalTranscript(normalizedTranscript);
      }

      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();

      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.lang = RECOGNITION_LANGUAGES[language];
  }, [language]);

  const clearTranscript = useCallback(() => {
    transcriptRef.current = '';
    finalTranscriptRef.current = '';
    setTranscript('');
    setFinalTranscript('');
  }, []);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;

    if (!recognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) return;

    recognition.lang = RECOGNITION_LANGUAGES[language];
    transcriptRef.current = '';
    finalTranscriptRef.current = '';
    setTranscript('');
    setFinalTranscript('');
    setError(null);

    try {
      recognition.start();
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : 'Voice input could not be started.'
      );
      setIsListening(false);
    }
  }, [isListening, language]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return {
    clearTranscript,
    error,
    finalTranscript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    transcript,
  };
}
