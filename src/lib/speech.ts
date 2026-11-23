import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

interface WebSpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface WebSpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: WebSpeechRecognitionAlternative;
}
interface WebSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<WebSpeechRecognitionResult>;
}
interface WebSpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface WebSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
}

class SpeechService {
  private isListening = false;
  private language = 'hi-IN';
  private onResultCallback: ((result: STTResult) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private webRecognition: WebSpeechRecognition | null = null;
  private cleanupListeners: Array<{ remove: () => void }> = [];
  private micSupported = false;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<boolean> {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        stream.getTracks().forEach((t) => t.stop());
        this.micSupported = true;
        console.log('Mic permission granted (web)');
      } catch (e) {
        console.error('Mic permission denied (web):', e);
        this.micSupported = false;
      }
      return this.micSupported;
    }
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) return false;
      await SpeechRecognition.requestPermissions();
      return true;
    } catch (e) {
      console.error('Speech init error:', e);
      return false;
    }
  }

  async startListening(
    onResult: (result: STTResult) => void,
    onEnd: () => void
  ): Promise<() => void> {
    if (this.isListening) return () => {};

    this.onResultCallback = onResult;
    this.onEndCallback = onEnd;
    this.isListening = true;

    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      if (!this.micSupported) {
        console.error('Mic not supported or permission denied');
        this.isListening = false;
        onEnd();
        return () => {};
      }
      this.startWebRecognition();
    } else {
      try {
        const removePartial = await SpeechRecognition.addListener('partialResults', (data: any) => {
          const transcript = data?.matches?.[0] || '';
          if (transcript.trim()) {
            this.onResultCallback?.({ transcript, confidence: 0.8, isFinal: false });
          }
        });
        const removeState = await SpeechRecognition.addListener('listeningState', (data: any) => {
          if (data?.status === 'stopped') {
            this.isListening = false;
            if (this.onEndCallback) this.onEndCallback();
          }
        });
        this.cleanupListeners = [removePartial, removeState];
        await SpeechRecognition.start({
          language: this.language,
          maxResults: 3,
          prompt: 'बोलें...',
          partialResults: true,
          popup: false
        });
        return () => {
          this.cleanupListeners.forEach((l) => l.remove());
          this.cleanupListeners = [];
        };
      } catch (e: any) {
        this.isListening = false;
        return () => {};
      }
    }

    return () => {
      if (this.isListening) {
        this.clearWatchdog();
        if (this.webRecognition) {
          try { this.webRecognition.stop(); } catch (e) {}
        }
        this.isListening = false;
        if (this.cleanupListeners.length > 0) {
          this.cleanupListeners.forEach((l) => l.remove());
          this.cleanupListeners = [];
        }
      }
    };
  }

  private startWebRecognition() {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.error('Web Speech API not supported');
      this.isListening = false;
      if (this.onEndCallback) this.onEndCallback();
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = this.language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 2;

    recognition.onstart = () => {
      console.log('Web Speech recognition started');
    };
    recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
      console.error('Web Speech error:', event.error);
      if (this.watchdog) { clearTimeout(this.watchdog); this.watchdog = null; }
      this.isListening = false;
      if (this.onEndCallback) this.onEndCallback();
    };
    recognition.onend = () => {
      console.log('Web Speech recognition ended');
      if (this.watchdog) { clearTimeout(this.watchdog); this.watchdog = null; }
      this.isListening = false;
      if (this.onEndCallback) this.onEndCallback();
    };
    recognition.onresult = (event: WebSpeechRecognitionEvent) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alternative = result[0];
        if (result.isFinal) {
          this.onResultCallback?.({ transcript: alternative.transcript, confidence: alternative.confidence, isFinal: true });
        } else {
          interimTranscript += alternative.transcript;
        }
      }
      if (interimTranscript.trim()) {
        this.onResultCallback?.({ transcript: interimTranscript, confidence: 0.7, isFinal: false });
      }
    };

    this.webRecognition = recognition;
    try {
      recognition.start();
      // Watchdog: auto-stop if no final result comes back within 25s
      this.watchdog = setTimeout(() => {
        try { recognition.stop(); } catch (e) {}
      }, 25000);
    } catch (e) {
      console.error('Web Speech start error:', e);
      this.isListening = false;
      if (this.onEndCallback) this.onEndCallback();
    }
  }

  private clearWatchdog() {
    if (this.watchdog) { clearTimeout(this.watchdog); this.watchdog = null; }
  }

  async stopListening() {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') {
      this.clearWatchdog();
      if (this.webRecognition) {
        try { this.webRecognition.stop(); } catch (e) {}
        this.webRecognition = null;
      }
      this.isListening = false;
    } else {
      try {
        await SpeechRecognition.stop();
      } catch (e) {
        console.error('Stop listening error:', e);
      }
      this.isListening = false;
      if (this.cleanupListeners.length > 0) {
        this.cleanupListeners.forEach((l) => l.remove());
        this.cleanupListeners = [];
      }
    }
  }

  async speak(text: string, language?: string): Promise<void> {
    const lang = language || this.language;
    try {
      await TextToSpeech.speak({
        text,
        lang: lang,
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient'
      });
    } catch (e) {
      console.error('TTS error:', e);
    }
  }

  async stopSpeaking() {
    try {
      await TextToSpeech.stop();
    } catch (e) {
      console.error('Stop TTS error:', e);
    }
  }

  getIsListening() {
    return this.isListening;
  }

  setLanguage(lang: string) {
    this.language = lang;
  }
}

export const speech = new SpeechService();
