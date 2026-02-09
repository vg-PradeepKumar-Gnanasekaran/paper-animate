'use client';

import { PaperSection, SectionTransition } from '@/types';
import AnimationPlayer from '@/components/AnimationPlayer';
import { motion } from 'framer-motion';
import { easeProgress } from '@/lib/keyframes';

interface SectionTransitionerProps {
  prevSection: PaperSection;
  nextSection: PaperSection;
  transition: SectionTransition;
  transitionProgress: number; // 0-1
}

const defaultPlayerState = {
  isPlaying: false,
  currentSection: 0,
  currentStep: 0,
  currentSegment: 0,
  progress: 0,
  globalTime: 0,
  speed: 1,
  isTransitioning: true,
};

export default function SectionTransitioner({
  prevSection,
  nextSection,
  transition,
  transitionProgress,
}: SectionTransitionerProps) {
  const transType = transition?.type || 'crossfade';

  // Apply easing to transition progress for smooth, cinematic feel
  const p = easeProgress(transitionProgress, 'cubicInOut');

  const renderTransition = () => {
    switch (transType) {
      case 'crossfade':
        return (
          <div className="relative w-full h-full aspect-video">
            {/* Outgoing section */}
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: 1 - p }}
              transition={{ duration: 0 }}
            >
              <AnimationPlayer
                section={prevSection}
                playerState={defaultPlayerState}
                animationProgress={1}
                transitionState="exiting"
              />
            </motion.div>
            {/* Incoming section */}
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: p }}
              transition={{ duration: 0 }}
            >
              <AnimationPlayer
                section={nextSection}
                playerState={defaultPlayerState}
                animationProgress={0}
                transitionState="entering"
              />
            </motion.div>
          </div>
        );

      case 'slide-left':
        return (
          <div className="relative w-full h-full aspect-video overflow-hidden">
            {/* Outgoing section slides left */}
            <motion.div
              className="absolute inset-0"
              animate={{ x: `${-p * 100}%` }}
              transition={{ duration: 0 }}
            >
              <AnimationPlayer
                section={prevSection}
                playerState={defaultPlayerState}
                animationProgress={1}
                transitionState="exiting"
              />
            </motion.div>
            {/* Incoming section slides in from right */}
            <motion.div
              className="absolute inset-0"
              animate={{ x: `${(1 - p) * 100}%` }}
              transition={{ duration: 0 }}
            >
              <AnimationPlayer
                section={nextSection}
                playerState={defaultPlayerState}
                animationProgress={0}
                transitionState="entering"
              />
            </motion.div>
          </div>
        );

      case 'zoom-out-in':
        return (
          <div className="relative w-full h-full aspect-video overflow-hidden">
            {/* Outgoing section zooms out */}
            <motion.div
              className="absolute inset-0"
              animate={{
                scale: 1 - p * 0.3,
                opacity: 1 - p,
              }}
              transition={{ duration: 0 }}
            >
              <AnimationPlayer
                section={prevSection}
                playerState={defaultPlayerState}
                animationProgress={1}
                transitionState="exiting"
              />
            </motion.div>
            {/* Incoming section zooms in */}
            <motion.div
              className="absolute inset-0"
              animate={{
                scale: 0.7 + p * 0.3,
                opacity: p,
              }}
              transition={{ duration: 0 }}
            >
              <AnimationPlayer
                section={nextSection}
                playerState={defaultPlayerState}
                animationProgress={0}
                transitionState="entering"
              />
            </motion.div>
          </div>
        );

      case 'perspective-push':
        return (
          <div className="relative w-full h-full aspect-video overflow-hidden" style={{ perspective: '800px' }}>
            {/* Outgoing section rotates away */}
            <motion.div
              className="absolute inset-0"
              animate={{
                rotateY: -p * 45,
                scale: 1 - p * 0.15,
                opacity: 1 - p,
                x: `${-p * 30}%`,
              }}
              transition={{ duration: 0 }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <AnimationPlayer
                section={prevSection}
                playerState={defaultPlayerState}
                animationProgress={1}
                transitionState="exiting"
              />
            </motion.div>
            {/* Incoming section rotates in */}
            <motion.div
              className="absolute inset-0"
              animate={{
                rotateY: (1 - p) * 45,
                scale: 0.85 + p * 0.15,
                opacity: p,
                x: `${(1 - p) * 30}%`,
              }}
              transition={{ duration: 0 }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <AnimationPlayer
                section={nextSection}
                playerState={defaultPlayerState}
                animationProgress={0}
                transitionState="entering"
              />
            </motion.div>
          </div>
        );

      case 'parallax-wipe':
        return (
          <div className="relative w-full h-full aspect-video overflow-hidden">
            {/* Outgoing section slides left at 120% speed (foreground layer) */}
            <motion.div
              className="absolute inset-0"
              animate={{
                x: `${-p * 120}%`,
                opacity: 1 - p * 0.8,
              }}
              transition={{ duration: 0 }}
            >
              <AnimationPlayer
                section={prevSection}
                playerState={defaultPlayerState}
                animationProgress={1}
                transitionState="exiting"
              />
            </motion.div>
            {/* Incoming section slides in at 80% speed (background layer — parallax depth) */}
            <motion.div
              className="absolute inset-0"
              animate={{
                x: `${(1 - p) * 80}%`,
                opacity: Math.min(1, p * 1.5),
              }}
              transition={{ duration: 0 }}
            >
              <AnimationPlayer
                section={nextSection}
                playerState={defaultPlayerState}
                animationProgress={0}
                transitionState="entering"
              />
            </motion.div>
          </div>
        );

      case 'cut':
      default:
        // Instant cut — show incoming section
        return (
          <AnimationPlayer
            section={p < 0.5 ? prevSection : nextSection}
            playerState={defaultPlayerState}
            animationProgress={p < 0.5 ? 1 : 0}
            transitionState={p < 0.5 ? 'exiting' : 'entering'}
          />
        );
    }
  };

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden border border-gray-200/60 shadow-lg">
      {renderTransition()}
    </div>
  );
}
