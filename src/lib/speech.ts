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
  private language = 'en-US';
  private onResultCallback: ((result: STTResult) => void) | null = null;
  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private webRecognition: WebSpeechRecognition | null = null;
  private cleanupListeners: Array<{ remove: () => void }> = [];
  private micSupported = false;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restartCount = 0;
  private isStoppedIntentionally = false;

  async init(): Promise<boolean> {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') {
      return this.requestPermission();
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

  async requestPermission(): Promise<boolean> {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        stream.getTracks().forEach((t) => t.stop());
        this.micSupported = true;
        console.log('Mic permission granted (web)');
        return true;
      } catch (e) {
        console.error('Mic permission denied (web):', e);
        this.micSupported = false;
        return false;
      }
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
    onStart: () => void,
    onEnd: () => void
  ): Promise<() => void> {
    if (this.isListening) return () => {};

    this.onResultCallback = onResult;
    this.onStartCallback = onStart;
    this.onEndCallback = onEnd;

    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      if (!this.micSupported) {
        console.error('Mic not supported or permission denied');
        this.isListening = false;
        this.isStoppedIntentionally = true;
        this.onEndCallback?.();
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
            this.isStoppedIntentionally = true;
            this.clearWatchdog();
            this.clearRestart();
            if (this.onEndCallback) this.onEndCallback();
          }
        });
        this.cleanupListeners = [removePartial, removeState];
        this.isStoppedIntentionally = false;
        await SpeechRecognition.start({
          language: this.language,
          maxResults: 3,
          prompt: 'बोलें...',
          partialResults: true,
          popup: false
        });
        this.isListening = true;
        this.onStartCallback?.();
        this.setWatchdog();
        return () => this.cleanupListeners.forEach((l) => l.remove());
      } catch (e: any) {
        this.isListening = false;
        this.onEndCallback?.();
        return () => {};
      }
    }

    return () => this.stopIntentionally();
  }

  private stopIntentionally() {
    this.clearWatchdog();
    this.clearRestart();
    this.isStoppedIntentionally = true;
    if (this.webRecognition) {
      try { this.webRecognition.stop(); } catch (e) {}
      this.webRecognition = null;
    }
    this.isListening = false;
    this.cleanupListeners.forEach((l) => l.remove());
    this.cleanupListeners = [];
  }

  private startWebRecognition() {
    this.clearRestart();
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.error('Web Speech API not supported');
      this.isListening = false;
      this.isStoppedIntentionally = true;
      if (this.onEndCallback) this.onEndCallback();
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = this.language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 2;

    recognition.onstart = () => {
      // "Green" state = the browser actually started recognizing.
      this.isListening = true;
      this.restartCount = 0;
      this.isStoppedIntentionally = false;
      this.clearRestart();
      this.setWatchdog();
      if (this.onStartCallback) this.onStartCallback();
    };
    recognition.onerror = () => {
      this.clearWatchdog();
      this.isListening = false;
      if (this.isStoppedIntentionally) {
        if (this.onEndCallback) this.onEndCallback();
      } else {
        this.scheduleRestart();
      }
    };
    recognition.onend = () => {
      this.clearWatchdog();
      this.isListening = false;
      if (this.isStoppedIntentionally) {
        if (this.onEndCallback) this.onEndCallback();
      } else {
        this.scheduleRestart();
      }
    };
    recognition.onresult = (event: WebSpeechRecognitionEvent) => {
      let interimTranscript = '';
      const results = event.results;
      if (!results) return;
      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i];
        if (!result || result.length === 0) continue;
        const alternative = result[0];
        if (result.isFinal) {
          this.onResultCallback?.({
            transcript: alternative.transcript,
            confidence: alternative.confidence,
            isFinal: true
          });
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
    } catch (e) {
      console.error('Web Speech start error:', e);
      this.isListening = false;
      this.isStoppedIntentionally = true;
      if (this.onEndCallback) this.onEndCallback();
    }
  }

  private scheduleRestart() {
    this.clearRestart();
    this.restartCount += 1;
    if (this.restartCount > 5) {
      // Repeated failures — give up; store resets state and shows the error.
      this.isStoppedIntentionally = true;
      this.isListening = false;
      if (this.onEndCallback) this.onEndCallback();
      return;
    }
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.isStoppedIntentionally) this.startWebRecognition();
    }, 800);
  }

  private setWatchdog() {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      const r = this.webRecognition;
      if (r) {
        try { r.stop(); } catch (e) {}
      }
      // onend fires and auto-restarts if nothing was stopped intentionally.
    }, 25000);
  }

  private clearWatchdog() {
    if (this.watchdog) { clearTimeout(this.watchdog); this.watchdog = null; }
  }

  private clearRestart() {
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
  }

  async stopListening() {
    this.isStoppedIntentionally = true;
    const platform = Capacitor.getPlatform();
    if (platform === 'web') {
      this.stopIntentionally();
    } else {
      try {
        await SpeechRecognition.stop();
      } catch (e) {
        console.error('Stop listening error:', e);
      }
      this.isListening = false;
      this.cleanupListeners.forEach((l) => l.remove());
      this.cleanupListeners = [];
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
    if (Capacitor.isNativePlatform()) {
      this.language = lang;
      return;
    }
    const supported = new Set([
      'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN',
      'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'gu-IN', 'pa-IN', 'bn-IN', 'ur-IN'
    ]);
    this.language = supported.has(lang) ? lang : 'en-US';
  }
}

export const speech = new SpeechService();
