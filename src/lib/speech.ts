'use client';

export interface SpeechOptions {
  rate: number;       // 0.5 - 2.0
  pitch: number;      // 0 - 2
  volume: number;     // 0 - 1
  voice?: SpeechSynthesisVoice;
  onWord?: (wordIndex: number, word: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onBoundary?: (charIndex: number, charLength: number) => void;
}

const DEFAULT_OPTIONS: SpeechOptions = {
  rate: 1,
  pitch: 1,
  volume: 1,
};

class SpeechEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isReady = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis;
      this.loadVoices();
    }
  }

  private loadVoices() {
    if (!this.synth) return;

    const loadFn = () => {
      this.voices = this.synth!.getVoices();
      this.isReady = this.voices.length > 0;
    };

    loadFn();

    // Voices load async in some browsers
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadFn;
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  getPreferredVoices(): SpeechSynthesisVoice[] {
    // Prefer English voices that sound natural
    const preferred = this.voices.filter((v) => {
      const lang = v.lang.toLowerCase();
      return lang.startsWith('en') && !v.name.toLowerCase().includes('compact');
    });

    // Sort: Google/Microsoft/premium voices first
    return preferred.sort((a, b) => {
      const aScore = this.voiceQualityScore(a);
      const bScore = this.voiceQualityScore(b);
      return bScore - aScore;
    });
  }

  private voiceQualityScore(voice: SpeechSynthesisVoice): number {
    let score = 0;
    const name = voice.name.toLowerCase();

    if (name.includes('google')) score += 10;
    if (name.includes('microsoft')) score += 8;
    if (name.includes('natural')) score += 5;
    if (name.includes('neural')) score += 5;
    if (name.includes('premium')) score += 4;
    if (name.includes('enhanced')) score += 3;
    if (voice.lang === 'en-US') score += 2;
    if (voice.lang === 'en-GB') score += 1;

    return score;
  }

  speak(text: string, options: Partial<SpeechOptions> = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Speech synthesis not available'));
        return;
      }

      // Cancel any ongoing speech
      this.stop();

      const opts = { ...DEFAULT_OPTIONS, ...options };
      const utterance = new SpeechSynthesisUtterance(text);

      utterance.rate = opts.rate;
      utterance.pitch = opts.pitch;
      utterance.volume = opts.volume;

      // Set voice
      if (opts.voice) {
        utterance.voice = opts.voice;
      } else {
        const preferred = this.getPreferredVoices();
        if (preferred.length > 0) {
          utterance.voice = preferred[0];
        }
      }

      // Event handlers
      utterance.onstart = () => {
        opts.onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        opts.onEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        if (event.error !== 'canceled') {
          reject(new Error(`Speech error: ${event.error}`));
        } else {
          resolve();
        }
      };

      // Word boundary event - key for word-by-word highlighting
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          opts.onBoundary?.(event.charIndex, event.charLength);

          // Calculate which word index we're at
          const spokenSoFar = text.substring(0, event.charIndex);
          const wordIndex = spokenSoFar.split(/\s+/).filter(Boolean).length;
          const currentWord = text.substring(event.charIndex, event.charIndex + event.charLength);
          opts.onWord?.(wordIndex, currentWord);
        }
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    });
  }

  pause() {
    this.synth?.pause();
  }

  resume() {
    this.synth?.resume();
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  get isSpeaking(): boolean {
    return this.synth?.speaking ?? false;
  }

  get isPaused(): boolean {
    return this.synth?.paused ?? false;
  }

  get available(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}

// Singleton instance
let speechEngineInstance: SpeechEngine | null = null;

export function getSpeechEngine(): SpeechEngine {
  if (!speechEngineInstance) {
    speechEngineInstance = new SpeechEngine();
  }
  return speechEngineInstance;
}

// Speed mapping for narration speeds
export function getNarrationRate(speed: 'slow' | 'normal' | 'fast'): number {
  switch (speed) {
    case 'slow': return 0.8;
    case 'normal': return 1.0;
    case 'fast': return 1.3;
  }
}
