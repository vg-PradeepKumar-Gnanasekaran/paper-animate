import {
  PresentationScript,
  SectionScript,
  SectionTransition,
  TimelineState,
} from '@/types';

type TimelineListener = (state: TimelineState) => void;

const COMPLETE_STATE: TimelineState = {
  phase: 'complete',
  sectionIndex: 0,
  segmentIndex: 0,
  sectionProgress: 1,
  segmentProgress: 1,
  activeStepId: '',
  currentText: '',
  emphasis: [],
  globalTime: 0,
};

export class TimelineController {
  private currentTime: number = 0;
  private speed: number = 1;
  private playing: boolean = false;
  private rafId: number | null = null;
  private lastTimestamp: number | null = null;
  private listeners: Set<TimelineListener> = new Set();

  private sectionScripts: SectionScript[];
  private transitions: SectionTransition[];
  private totalDuration: number;

  // Pre-computed: absolute start time of each section and transition
  private sectionStartTimes: number[] = [];
  private transitionStartTimes: number[] = [];

  constructor(script: PresentationScript) {
    this.sectionScripts = script.sections;
    this.transitions = script.transitions;
    this.totalDuration = script.totalDuration;
    this.computeStartTimes();
  }

  private computeStartTimes(): void {
    let offset = 0;
    for (let i = 0; i < this.sectionScripts.length; i++) {
      this.sectionStartTimes.push(offset);
      offset += this.sectionScripts[i].totalDuration;

      if (i < this.transitions.length) {
        this.transitionStartTimes.push(offset);
        offset += this.transitions[i].duration;
      }
    }
  }

  getStateAtTime(time: number): TimelineState {
    if (time >= this.totalDuration) {
      return {
        ...COMPLETE_STATE,
        globalTime: this.totalDuration,
        sectionIndex: this.sectionScripts.length - 1,
      };
    }

    const clampedTime = Math.max(0, time);

    for (let i = 0; i < this.sectionScripts.length; i++) {
      const sectionStart = this.sectionStartTimes[i];
      const script = this.sectionScripts[i];
      const sectionEnd = sectionStart + script.totalDuration;

      // Are we within this section?
      if (clampedTime >= sectionStart && clampedTime < sectionEnd) {
        const sectionTime = clampedTime - sectionStart;
        const sectionProgress = script.totalDuration > 0
          ? sectionTime / script.totalDuration
          : 0;

        // Find active segment
        let segmentIndex = 0;
        let activeSegment = script.segments[0];
        for (let s = 0; s < script.segments.length; s++) {
          const seg = script.segments[s];
          if (sectionTime >= seg.startTime && sectionTime < seg.endTime) {
            segmentIndex = s;
            activeSegment = seg;
            break;
          }
          // Past the last segment's end — clamp to last
          if (s === script.segments.length - 1) {
            segmentIndex = s;
            activeSegment = seg;
          }
        }

        const segmentDuration = activeSegment.endTime - activeSegment.startTime;
        const segmentProgress = segmentDuration > 0
          ? Math.min(1, (sectionTime - activeSegment.startTime) / segmentDuration)
          : 0;

        return {
          phase: 'section',
          sectionIndex: i,
          segmentIndex,
          sectionProgress,
          segmentProgress,
          activeStepId: activeSegment.stepId,
          currentText: activeSegment.text,
          emphasis: activeSegment.emphasis || [],
          globalTime: clampedTime,
        };
      }

      // Are we within the transition after this section?
      if (i < this.transitions.length) {
        const transitionStart = this.transitionStartTimes[i];
        const transition = this.transitions[i];
        const transitionEnd = transitionStart + transition.duration;

        if (clampedTime >= transitionStart && clampedTime < transitionEnd) {
          const transitionProgress = transition.duration > 0
            ? (clampedTime - transitionStart) / transition.duration
            : 0;

          return {
            phase: 'transition',
            sectionIndex: i,
            segmentIndex: 0,
            sectionProgress: 1,
            segmentProgress: 1,
            activeStepId: '',
            currentText: '',
            emphasis: [],
            globalTime: clampedTime,
            fromSection: i,
            toSection: i + 1,
            transitionProgress,
          };
        }
      }
    }

    // Fallback — shouldn't reach here
    return { ...COMPLETE_STATE, globalTime: clampedTime };
  }

  private tick = (timestamp: number): void => {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
    }

    const delta = (timestamp - this.lastTimestamp) / 1000; // seconds
    this.lastTimestamp = timestamp;
    this.currentTime += delta * this.speed;

    if (this.currentTime >= this.totalDuration) {
      this.currentTime = this.totalDuration;
      this.playing = false;
      this.rafId = null;
      this.notify();
      return;
    }

    this.notify();

    if (this.playing) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private notify(): void {
    const state = this.getStateAtTime(this.currentTime);
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  play(): void {
    if (this.playing) return;
    if (this.currentTime >= this.totalDuration) {
      this.currentTime = 0;
    }
    this.playing = true;
    this.lastTimestamp = null;
    this.rafId = requestAnimationFrame(this.tick);
  }

  pause(): void {
    this.playing = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTimestamp = null;
  }

  seek(time: number): void {
    this.currentTime = Math.max(0, Math.min(time, this.totalDuration));
    this.lastTimestamp = null;
    this.notify();
  }

  seekToSection(sectionIndex: number): void {
    if (sectionIndex >= 0 && sectionIndex < this.sectionStartTimes.length) {
      this.seek(this.sectionStartTimes[sectionIndex]);
    }
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  getSpeed(): number {
    return this.speed;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getTotalDuration(): number {
    return this.totalDuration;
  }

  getSectionStartTime(sectionIndex: number): number {
    return this.sectionStartTimes[sectionIndex] ?? 0;
  }

  subscribe(listener: TimelineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.pause();
    this.listeners.clear();
  }
}
