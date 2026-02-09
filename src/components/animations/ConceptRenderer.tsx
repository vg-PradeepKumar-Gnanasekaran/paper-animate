'use client';

import { motion, AnimatePresence, type TargetAndTransition } from 'framer-motion';
import { AnimationData, AnimationElement } from '@/types';
import DoodleOverlay from './DoodleOverlay';
import { interpolateKeyframes, keyframesFromLegacyAnimation, easeProgress } from '@/lib/keyframes';

interface ConceptRendererProps {
  animationData: AnimationData;
  narration: string;
  animationProgress: number;
  title: string;
  transitionState?: 'entering' | 'active' | 'exiting';
  enableDoodles?: boolean;
}

// Canvas dimensions for absolute positioning (matches Gemini prompt: ~600x300)
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 300;

// Continuous animation definitions (infinite looping Framer Motion targets)
const continuousAnimations: Record<string, TargetAndTransition> = {
  float: {
    y: [0, -5, 0, 5, 0],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
  pulse: {
    scale: [1, 1.03, 1, 0.97, 1],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
  rotate: {
    rotate: [0, 360],
    transition: { duration: 8, repeat: Infinity, ease: 'linear' },
  },
  sway: {
    x: [0, 3, 0, -3, 0],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
};

// Exit animation variants
const exitVariants: Record<string, TargetAndTransition> = {
  fadeOut: { opacity: 0, transition: { duration: 0.4 } },
  slideDown: { opacity: 0, y: 40, transition: { duration: 0.4 } },
  scaleDown: { opacity: 0, scale: 0.5, transition: { duration: 0.4 } },
  slideLeft: { opacity: 0, x: -40, transition: { duration: 0.4 } },
};

const getEnterVariants = (enter: string) => {
  switch (enter) {
    case 'slideUp':
      return { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } };
    case 'slideRight':
      return { initial: { opacity: 0, x: -40 }, animate: { opacity: 1, x: 0 } };
    case 'scale':
      return { initial: { opacity: 0, scale: 0 }, animate: { opacity: 1, scale: 1 } };
    case 'draw':
      return { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 } };
    case 'fadeIn':
    default:
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
  }
};

const getColorForType = (type: string) => {
  switch (type) {
    case 'highlight': return '#FDE68A';
    case 'arrow': return '#60A5FA';
    case 'node': return '#818CF8';
    case 'equation': return '#F1F5F9';
    default: return '#374151';
  }
};

// ============================================
// PositionedMotionElement — keyframe-driven, absolute positioned
// ============================================

function PositionedMotionElement({
  element,
  index,
  stepProgress,
}: {
  element: AnimationElement;
  index: number;
  stepProgress: number;
}) {
  const content = (element.props.content as string) || '';
  const color = (element.props.color as string) || getColorForType(element.type);
  const size = (element.props.size as number) || 16;
  const x = (element.props.x as number) || 0;
  const y = (element.props.y as number) || 0;

  // Get keyframes — from element data, or synthesized from legacy animation
  const keyframes = element.animation.keyframes
    || keyframesFromLegacyAnimation(
      element.animation,
      { x, y },
      index,
    );

  // Interpolate position/opacity/scale at current step progress
  const state = interpolateKeyframes(keyframes, stepProgress);

  // Convert canvas coordinates to percentages
  const leftPct = `${(state.x / CANVAS_WIDTH) * 100}%`;
  const topPct = `${(state.y / CANVAS_HEIGHT) * 100}%`;

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: leftPct,
    top: topPct,
    transform: `translate(-50%, -50%) scale(${state.scaleX}) rotate(${state.rotateZ || 0}deg)`,
    opacity: state.opacity,
    willChange: 'transform, opacity',
    transition: 'none', // keyframes handle smoothness
  };

  if (element.type === 'text') {
    return (
      <div style={{ ...baseStyle, color: state.color || '#E2E8F0', fontSize: `${size}px` }} className="px-4 py-2">
        {content}
      </div>
    );
  }

  if (element.type === 'equation') {
    return (
      <div
        style={{
          ...baseStyle,
          background: 'rgba(241, 245, 249, 0.08)',
          color: state.color || '#F1F5F9',
          fontSize: `${size}px`,
        }}
        className="px-5 py-3 rounded-xl font-mono text-lg backdrop-blur-sm border border-slate-500/30"
      >
        {content}
      </div>
    );
  }

  if (element.type === 'shape') {
    const width = (element.props.width as number) || 100;
    const height = (element.props.height as number) || 64;
    return (
      <div
        style={{
          ...baseStyle,
          background: `linear-gradient(135deg, ${color}, ${color}CC)`,
          width: `${width}px`,
          height: `${height}px`,
          boxShadow: `0 8px 32px ${color}40`,
        }}
        className="rounded-xl flex items-center justify-center text-white font-semibold shadow-xl border border-white/10"
      >
        {content}
      </div>
    );
  }

  if (element.type === 'node') {
    return (
      <div
        style={{
          ...baseStyle,
          background: `linear-gradient(135deg, ${color}, ${color}BB)`,
          boxShadow: `0 4px 24px ${color}50`,
        }}
        className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold border-2 border-white/20"
      >
        {content}
      </div>
    );
  }

  if (element.type === 'arrow') {
    return (
      <div
        style={{ ...baseStyle }}
        className="text-3xl text-indigo-400/80"
      >
        {content || '\u2192'}
      </div>
    );
  }

  if (element.type === 'highlight') {
    return (
      <div
        style={{
          ...baseStyle,
          background: 'rgba(251, 191, 36, 0.12)',
          boxShadow: '0 4px 24px rgba(251, 191, 36, 0.15)',
        }}
        className="px-6 py-3 rounded-xl border border-amber-400/40 backdrop-blur-sm"
      >
        <span className="text-amber-300 font-semibold">{content}</span>
      </div>
    );
  }

  // Default fallback
  return (
    <div style={{ ...baseStyle }} className="text-slate-300">
      {content}
    </div>
  );
}

// ============================================
// Legacy MotionElement — flex layout (no x/y coords)
// ============================================

function MotionElement({ element, index }: { element: AnimationElement; index: number }) {
  const enterVars = getEnterVariants(element.animation.enter);
  const continuous: TargetAndTransition = element.animation.continuous && element.animation.continuous !== 'none'
    ? continuousAnimations[element.animation.continuous] || {}
    : {};
  const exitAnim: TargetAndTransition = element.animation.exit && element.animation.exit !== 'none'
    ? exitVariants[element.animation.exit] || { opacity: 0 }
    : { opacity: 0 };

  const content = (element.props.content as string) || '';
  const color = (element.props.color as string) || getColorForType(element.type);
  const size = (element.props.size as number) || 16;

  // Merge enter + continuous animations
  const animateState = { ...enterVars.animate, ...continuous };

  const baseTransition = {
    duration: element.animation.duration || 0.6,
    delay: element.animation.delay || index * 0.15,
  };

  if (element.type === 'text') {
    return (
      <motion.div
        initial={enterVars.initial}
        animate={animateState}
        exit={exitAnim}
        transition={baseTransition}
        className="px-4 py-2"
        style={{ color: '#E2E8F0', fontSize: `${size}px`, willChange: 'transform, opacity' }}
      >
        {content}
      </motion.div>
    );
  }

  if (element.type === 'equation') {
    return (
      <motion.div
        initial={enterVars.initial}
        animate={animateState}
        exit={exitAnim}
        transition={baseTransition}
        className="px-5 py-3 rounded-xl font-mono text-lg backdrop-blur-sm border border-slate-500/30"
        style={{
          background: 'rgba(241, 245, 249, 0.08)',
          color: '#F1F5F9',
          fontSize: `${size}px`,
          willChange: 'transform, opacity',
        }}
      >
        {content}
      </motion.div>
    );
  }

  if (element.type === 'shape') {
    const width = (element.props.width as number) || 100;
    const height = (element.props.height as number) || 64;
    return (
      <motion.div
        initial={enterVars.initial}
        animate={animateState}
        exit={exitAnim}
        transition={baseTransition}
        className="rounded-xl flex items-center justify-center text-white font-semibold shadow-xl border border-white/10"
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}CC)`,
          width: `${width}px`,
          height: `${height}px`,
          boxShadow: `0 8px 32px ${color}40`,
          willChange: 'transform, opacity',
        }}
      >
        {content}
      </motion.div>
    );
  }

  if (element.type === 'node') {
    return (
      <motion.div
        initial={enterVars.initial}
        animate={animateState}
        exit={exitAnim}
        transition={baseTransition}
        className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold border-2 border-white/20"
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}BB)`,
          boxShadow: `0 4px 24px ${color}50`,
          willChange: 'transform, opacity',
        }}
      >
        {content}
      </motion.div>
    );
  }

  if (element.type === 'arrow') {
    return (
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1, ...continuous }}
        exit={exitAnim}
        transition={baseTransition}
        className="text-3xl text-indigo-400/80"
        style={{ willChange: 'transform, opacity' }}
      >
        {content || '\u2192'}
      </motion.div>
    );
  }

  if (element.type === 'highlight') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1, ...continuous }}
        exit={exitAnim}
        transition={baseTransition}
        className="px-6 py-3 rounded-xl border border-amber-400/40 backdrop-blur-sm"
        style={{
          background: 'rgba(251, 191, 36, 0.12)',
          boxShadow: '0 4px 24px rgba(251, 191, 36, 0.15)',
          willChange: 'transform, opacity',
        }}
      >
        <span className="text-amber-300 font-semibold">{content}</span>
      </motion.div>
    );
  }

  // Default fallback
  return (
    <motion.div
      initial={enterVars.initial}
      animate={animateState}
      exit={exitAnim}
      transition={baseTransition}
      className="text-slate-300"
      style={{ willChange: 'transform, opacity' }}
    >
      {content}
    </motion.div>
  );
}

// ============================================
// Main ConceptRenderer
// ============================================

export default function ConceptRenderer({
  animationData,
  narration,
  animationProgress,
  title,
  transitionState = 'active',
  enableDoodles = true,
}: ConceptRendererProps) {
  const steps = animationData?.steps || [];
  const containerOpacity = transitionState === 'active' ? 1 : 0.88;
  const containerScale = transitionState === 'entering' ? 0.97 : transitionState === 'exiting' ? 1.02 : 1;

  // Apply easing to animation progress for smoother step transitions
  const easedProgress = easeProgress(animationProgress, 'easeInOut');

  const currentStepIndex = Math.min(
    Math.floor(easedProgress * steps.length),
    steps.length - 1
  );

  const currentStep = steps[currentStepIndex];

  // Compute intra-step progress (0-1 within the current step)
  const rawStepProgress = easedProgress * steps.length;
  const stepProgress = rawStepProgress - currentStepIndex; // 0-1 within step

  // Check if ANY element in the current step has x/y coordinates
  const hasPositionedElements = currentStep?.elements?.some(
    (el) => (el.props.x !== undefined && el.props.y !== undefined)
  );

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 40%, #334155 100%)',
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
        transition: 'opacity 0.45s ease, transform 0.6s ease',
      }}
    >
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Soft glow accent */}
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #818CF8, transparent)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #34D399, transparent)' }}
      />

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-10 py-8">
        <motion.h3
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-2xl font-bold text-white mb-5 tracking-tight"
        >
          {title}
        </motion.h3>

        <div className="relative w-full max-w-3xl flex-1 flex flex-col items-center justify-center gap-5">
          <AnimatePresence mode="wait">
            {currentStep && (
              <motion.div
                key={currentStep.id || currentStepIndex}
                className="w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                {/* Step label */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 mb-3"
                >
                  <span className="w-6 h-6 rounded-full bg-indigo-500/30 border border-indigo-400/50 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                    {currentStepIndex + 1}
                  </span>
                  <span className="text-sm text-indigo-300/80 font-medium">
                    {currentStep.description}
                  </span>
                </motion.div>

                {/* Elements rendering — positioned canvas OR flex layout */}
                {hasPositionedElements ? (
                  // Absolute positioning canvas (keyframe-driven)
                  <div
                    className="relative w-full"
                    style={{
                      paddingBottom: `${(CANVAS_HEIGHT / CANVAS_WIDTH) * 100}%`, // maintain aspect ratio
                    }}
                  >
                    <div className="absolute inset-0">
                      {currentStep.elements?.map((element, elIdx) => (
                        <PositionedMotionElement
                          key={`${currentStep.id}-${elIdx}`}
                          element={element}
                          index={elIdx}
                          stepProgress={stepProgress}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  // Fallback: flex layout (legacy behavior)
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <AnimatePresence>
                      {currentStep.elements?.map((element, elIdx) => (
                        <MotionElement key={elIdx} element={element} index={elIdx} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: animationProgress > 0.2 ? 0.7 : 0 }}
          transition={{ duration: 0.8 }}
          className="mt-5 text-slate-400 text-center max-w-lg leading-relaxed text-sm"
        >
          {narration}
        </motion.p>
      </div>

      {/* Doodle decoration overlay */}
      {enableDoodles && (
        <DoodleOverlay
          currentStep={steps[currentStepIndex] || null}
          animationProgress={animationProgress}
          width={800}
          height={500}
        />
      )}
    </div>
  );
}
