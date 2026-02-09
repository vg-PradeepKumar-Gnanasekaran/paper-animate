'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSpeechEngine, getNarrationRate } from '@/lib/speech';
import { NarrationSegment } from '@/types';
import {
  Volume2,
  VolumeX,
  Mic,
  Settings2,
} from 'lucide-react';

interface CaptionsProps {
  text: string;
  isPlaying: boolean;
  narrationSpeed: 'slow' | 'normal' | 'fast';
  onNarrationComplete?: () => void;
  showCaptions: boolean;
  enableVoice: boolean;
  onVoiceToggle: (enabled: boolean) => void;
  onCaptionsToggle: (show: boolean) => void;
  currentSegment?: NarrationSegment | null;
  segmentProgress?: number;
}

export default function Captions({
  text,
  isPlaying,
  narrationSpeed,
  onNarrationComplete,
  showCaptions,
  enableVoice,
  onVoiceToggle,
  onCaptionsToggle,
  currentSegment,
  segmentProgress = 0,
}: CaptionsProps) {
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const speakingRef = useRef(false);
  const currentSegmentIdRef = useRef<string | null>(null);

  // Use segment text if available, otherwise fall back to full text
  const displayText = currentSegment?.text || text;
  const displayWords = displayText.split(/\s+/).filter(Boolean);

  // Load available voices
  useEffect(() => {
    const engine = getSpeechEngine();
    const loadVoices = () => {
      const voices = engine.getPreferredVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    const interval = setInterval(() => {
      const voices = engine.getPreferredVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const stopSpeaking = useCallback(() => {
    const engine = getSpeechEngine();
    engine.stop();
    setIsSpeaking(false);
    speakingRef.current = false;
    setActiveWordIndex(-1);
  }, []);

  const speakSegment = useCallback(async (segmentText: string) => {
    if (!enableVoice || speakingRef.current) return;

    const engine = getSpeechEngine();
    if (!engine.available) return;

    speakingRef.current = true;
    setIsSpeaking(true);
    setActiveWordIndex(0);

    try {
      await engine.speak(segmentText, {
        rate: getNarrationRate(narrationSpeed),
        voice: availableVoices[selectedVoiceIndex] || undefined,
        onWord: (wordIndex) => {
          setActiveWordIndex(wordIndex);
        },
        onEnd: () => {
          setIsSpeaking(false);
          speakingRef.current = false;
          setActiveWordIndex(-1);
          onNarrationComplete?.();
        },
      });
    } catch {
      setIsSpeaking(false);
      speakingRef.current = false;
      setActiveWordIndex(-1);
    }
  }, [enableVoice, narrationSpeed, availableVoices, selectedVoiceIndex, onNarrationComplete]);

  // Speak new segment when it changes
  useEffect(() => {
    if (!currentSegment || !isPlaying || !enableVoice) return;

    const segId = currentSegment.id;
    if (segId !== currentSegmentIdRef.current) {
      currentSegmentIdRef.current = segId;
      stopSpeaking();
      const timer = setTimeout(() => {
        speakSegment(currentSegment.text);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentSegment?.id, isPlaying, enableVoice, stopSpeaking, speakSegment, currentSegment]);

  // Handle play/pause
  useEffect(() => {
    if (isPlaying && enableVoice && !speakingRef.current && currentSegment) {
      speakSegment(currentSegment.text);
    } else if (!isPlaying && speakingRef.current) {
      const engine = getSpeechEngine();
      engine.pause();
    }
  }, [isPlaying, enableVoice, speakSegment, currentSegment]);

  // Stop speech when full text changes (section changed via manual nav)
  useEffect(() => {
    return () => {
      stopSpeaking();
      currentSegmentIdRef.current = null;
    };
  }, [text, stopSpeaking]);

  // Compute word highlighting from segment progress when voice is off
  const computedWordIndex = !enableVoice && isPlaying && displayWords.length > 0
    ? Math.min(Math.floor(segmentProgress * displayWords.length), displayWords.length - 1)
    : activeWordIndex;

  const displayActiveIndex = enableVoice ? activeWordIndex : computedWordIndex;

  // Sliding window for caption display
  const windowSize = 12;
  const windowStart = Math.max(0, displayActiveIndex - 3);
  const windowEnd = Math.min(displayWords.length, windowStart + windowSize);
  const visibleWords = displayWords.slice(windowStart, windowEnd);

  // Emphasis highlighting
  const emphasisWords = new Set(
    (currentSegment?.emphasis || []).map((w) => w.toLowerCase())
  );

  return (
    <div className="space-y-2">
      {/* Controls bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Voice toggle */}
          <button
            onClick={() => {
              if (enableVoice) {
                stopSpeaking();
              }
              onVoiceToggle(!enableVoice);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              enableVoice
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
          >
            {enableVoice ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            Voice {enableVoice ? 'On' : 'Off'}
          </button>

          {/* Captions toggle */}
          <button
            onClick={() => onCaptionsToggle(!showCaptions)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showCaptions
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Captions {showCaptions ? 'On' : 'Off'}
          </button>

          {/* Voice settings */}
          {enableVoice && (
            <div className="relative">
              <button
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <AnimatePresence>
                {showVoiceSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-8 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[240px]"
                  >
                    <p className="text-xs font-semibold text-gray-600 mb-2">Voice</p>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {availableVoices.map((voice, i) => (
                        <button
                          key={voice.name}
                          onClick={() => {
                            setSelectedVoiceIndex(i);
                            setShowVoiceSettings(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                            i === selectedVoiceIndex
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span className="truncate">{voice.name}</span>
                          <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">
                            {voice.lang}
                          </span>
                        </button>
                      ))}
                      {availableVoices.length === 0 && (
                        <p className="text-xs text-gray-400 px-2 py-1">
                          Loading voices...
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-blue-500 rounded-full"
                  animate={{
                    height: [4, 12, 4],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-blue-500 font-medium">Speaking</span>
          </div>
        )}
      </div>

      {/* Captions display - word by word */}
      <AnimatePresence>
        {showCaptions && displayWords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-900/90 backdrop-blur-sm rounded-xl px-6 py-4 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 min-h-[36px]">
              {displayActiveIndex >= 0 ? (
                visibleWords.map((word, i) => {
                  const globalIndex = windowStart + i;
                  const isActive = globalIndex === displayActiveIndex;
                  const isPast = globalIndex < displayActiveIndex;
                  const isEmphasis = emphasisWords.has(word.toLowerCase().replace(/[.,!?;:]/g, ''));

                  return (
                    <motion.span
                      key={`${globalIndex}-${word}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{
                        opacity: isActive ? 1 : isPast ? 0.5 : 0.3,
                        y: 0,
                        scale: isActive ? 1.1 : 1,
                      }}
                      transition={{
                        duration: 0.2,
                        ease: 'easeOut',
                      }}
                      className={`text-sm font-medium transition-colors ${
                        isActive
                          ? isEmphasis
                            ? 'text-yellow-300'
                            : 'text-white'
                          : isPast
                          ? 'text-gray-400'
                          : 'text-gray-500'
                      }`}
                      style={{
                        textShadow: isActive
                          ? isEmphasis
                            ? '0 0 12px rgba(253, 224, 71, 0.6)'
                            : '0 0 8px rgba(96, 165, 250, 0.5)'
                          : 'none',
                      }}
                    >
                      {word}
                    </motion.span>
                  );
                })
              ) : (
                displayWords.slice(0, windowSize).map((word, i) => (
                  <span
                    key={`preview-${i}`}
                    className="text-sm text-gray-500 font-medium"
                  >
                    {word}
                  </span>
                ))
              )}
            </div>

            {/* Segment progress indicator */}
            <div className="mt-2 w-full h-0.5 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{
                  width: `${segmentProgress * 100}%`,
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
