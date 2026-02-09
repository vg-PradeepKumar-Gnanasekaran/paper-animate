'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export type CharacterPose = 'idle' | 'pointing' | 'thinking' | 'surprised' | 'nodding' | 'waving';

interface AnimeCharacterProps {
  pose: CharacterPose;
  position?: 'bottom-left' | 'bottom-right';
  size?: number;
}

// Pose configurations for different character states
const poseConfig: Record<CharacterPose, {
  rightArm: string;
  mouthPath: string;
  headTilt: number;
  bodyY: number;
  eyeScale: number;
}> = {
  idle: {
    rightArm: 'M65,93 Q75,103 72,113',
    mouthPath: 'M44,68 Q50,72 56,68',
    headTilt: 0,
    bodyY: 0,
    eyeScale: 1,
  },
  pointing: {
    rightArm: 'M65,90 Q82,82 98,78',
    mouthPath: 'M44,68 Q50,72 56,68',
    headTilt: -2,
    bodyY: 0,
    eyeScale: 1,
  },
  thinking: {
    rightArm: 'M65,90 Q68,80 60,72',
    mouthPath: 'M46,69 L54,69',
    headTilt: -5,
    bodyY: 0,
    eyeScale: 0.9,
  },
  surprised: {
    rightArm: 'M65,88 Q78,80 82,70',
    mouthPath: 'M47,66 Q50,73 53,66',
    headTilt: 0,
    bodyY: -3,
    eyeScale: 1.25,
  },
  nodding: {
    rightArm: 'M65,93 Q75,103 72,113',
    mouthPath: 'M44,68 Q50,73 56,68',
    headTilt: 0,
    bodyY: 0,
    eyeScale: 1,
  },
  waving: {
    rightArm: 'M65,88 Q82,74 88,62',
    mouthPath: 'M43,67 Q50,74 57,67',
    headTilt: 3,
    bodyY: 0,
    eyeScale: 1,
  },
};

export default function AnimeCharacter({
  pose = 'idle',
  position = 'bottom-right',
  size = 90,
}: AnimeCharacterProps) {
  const config = poseConfig[pose];
  const [blinkState, setBlinkState] = useState(false);

  // Periodic blink effect
  useEffect(() => {
    const interval = setInterval(() => {
      setBlinkState(true);
      setTimeout(() => setBlinkState(false), 150);
    }, 3500 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  const positionClasses = position === 'bottom-right'
    ? 'absolute bottom-3 right-3'
    : 'absolute bottom-3 left-3';

  return (
    <div className={`${positionClasses} pointer-events-none z-30`}>
      <motion.div
        animate={
          pose === 'idle'
            ? { y: [0, -2, 0, 2, 0] }
            : pose === 'nodding'
            ? { y: [0, 3, 0, 3, 0] }
            : pose === 'surprised'
            ? { y: [-4, 0] }
            : {}
        }
        transition={
          pose === 'idle'
            ? { duration: 3, repeat: Infinity, ease: 'easeInOut' }
            : pose === 'nodding'
            ? { duration: 0.6, repeat: 2, ease: 'easeInOut' }
            : pose === 'surprised'
            ? { duration: 0.3, ease: 'easeOut' }
            : {}
        }
      >
        <svg
          viewBox="0 0 100 140"
          width={size}
          height={size * 1.4}
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}
        >
          <defs>
            <radialGradient id="skinGrad" cx="40%" cy="35%">
              <stop offset="0%" stopColor="#FFE8CC" />
              <stop offset="100%" stopColor="#FCCBA0" />
            </radialGradient>
            <radialGradient id="hairGrad" cx="50%" cy="30%">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#6366F1" />
            </radialGradient>
            <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
          </defs>

          {/* Body */}
          <motion.g
            animate={{ y: config.bodyY }}
            transition={{ duration: 0.3 }}
          >
            {/* Torso */}
            <rect x={35} y={84} width={30} height={36} rx={8} fill="url(#bodyGrad)" stroke="#475569" strokeWidth={0.8} />

            {/* Scarf / tie accent */}
            <path d="M42,84 Q50,91 58,84" fill="none" stroke="#34D399" strokeWidth={2.5} strokeLinecap="round" />

            {/* Left arm (static) */}
            <path
              d="M35,93 Q25,103 28,113"
              fill="none"
              stroke="#FCCBA0"
              strokeWidth={5.5}
              strokeLinecap="round"
            />

            {/* Right arm (animated per pose) */}
            <motion.path
              d={config.rightArm}
              fill="none"
              stroke="#FCCBA0"
              strokeWidth={5.5}
              strokeLinecap="round"
              animate={
                pose === 'waving'
                  ? { rotate: [-12, 12, -12, 12, 0] }
                  : pose === 'pointing'
                  ? { x: [0, 2, 0] }
                  : {}
              }
              transition={
                pose === 'waving'
                  ? { duration: 1.2, ease: 'easeInOut' }
                  : pose === 'pointing'
                  ? { duration: 1, repeat: 2, ease: 'easeInOut' }
                  : {}
              }
              style={{ transformOrigin: '65px 90px' }}
            />

            {/* Little feet */}
            <ellipse cx={42} cy={122} rx={6} ry={3} fill="#1E293B" />
            <ellipse cx={58} cy={122} rx={6} ry={3} fill="#1E293B" />
          </motion.g>

          {/* Head group (tiltable) */}
          <motion.g
            animate={{ rotate: config.headTilt }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ transformOrigin: '50px 55px' }}
          >
            {/* Hair back layer */}
            <path
              d="M22,48 Q50,12 78,48 Q82,72 72,82 L28,82 Q18,72 22,48"
              fill="url(#hairGrad)"
            />

            {/* Head / face */}
            <circle cx={50} cy={56} r={27} fill="url(#skinGrad)" />

            {/* Hair front bangs */}
            <path
              d="M26,44 Q33,28 50,34 Q67,28 74,44 L72,52 Q60,38 40,38 Q30,42 28,52 Z"
              fill="#6366F1"
            />

            {/* Hair side strands */}
            <path d="M23,50 Q20,62 24,74" fill="none" stroke="#7C3AED" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
            <path d="M77,50 Q80,62 76,74" fill="none" stroke="#7C3AED" strokeWidth={3} strokeLinecap="round" opacity={0.7} />

            {/* Eyes */}
            <motion.g
              animate={{ scaleY: blinkState ? 0.1 : config.eyeScale }}
              transition={{ duration: 0.1 }}
              style={{ transformOrigin: '50px 56px' }}
            >
              {/* Left eye */}
              <ellipse cx={40} cy={56} rx={5} ry={5.5} fill="white" />
              <circle cx={41} cy={56} r={3.5} fill="#60A5FA" />
              <circle cx={40} cy={54.5} r={1.5} fill="white" />
              <circle cx={43} cy={57} r={0.8} fill="white" opacity={0.6} />

              {/* Right eye */}
              <ellipse cx={60} cy={56} rx={5} ry={5.5} fill="white" />
              <circle cx={61} cy={56} r={3.5} fill="#60A5FA" />
              <circle cx={60} cy={54.5} r={1.5} fill="white" />
              <circle cx={63} cy={57} r={0.8} fill="white" opacity={0.6} />
            </motion.g>

            {/* Cheek blush */}
            <circle cx={32} cy={63} r={4} fill="#FCA5A5" opacity={0.35} />
            <circle cx={68} cy={63} r={4} fill="#FCA5A5" opacity={0.35} />

            {/* Mouth */}
            <motion.path
              d={config.mouthPath}
              fill="none"
              stroke="#B45309"
              strokeWidth={1.5}
              strokeLinecap="round"
            />

            {/* Thinking dots (only for thinking pose) */}
            {pose === 'thinking' && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <circle cx={72} cy={30} r={1.5} fill="#94A3B8" />
                <circle cx={78} cy={24} r={2} fill="#94A3B8" />
                <circle cx={85} cy={18} r={2.5} fill="#94A3B8" />
              </motion.g>
            )}
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}
