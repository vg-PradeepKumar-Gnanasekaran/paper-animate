'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import DoodleOverlay from './DoodleOverlay';
import type { AnimationStep } from '@/types';
import { easeProgress } from '@/lib/keyframes';

interface EquationRendererProps {
  equations: string[];
  narration: string;
  animationProgress: number;
  title: string;
  transitionState?: 'entering' | 'active' | 'exiting';
  enableDoodles?: boolean;
}

export default function EquationRenderer({
  equations,
  narration,
  animationProgress,
  title,
  transitionState = 'active',
  enableDoodles = true,
}: EquationRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderedEquations, setRenderedEquations] = useState<string[]>([]);
  const containerOpacity = transitionState === 'active' ? 1 : 0.9;
  const containerScale = transitionState === 'entering' ? 0.97 : transitionState === 'exiting' ? 1.02 : 1;

  useEffect(() => {
    const rendered = equations.map((eq) => {
      try {
        return katex.renderToString(eq, {
          displayMode: true,
          throwOnError: false,
          trust: true,
        });
      } catch {
        return `<span class="text-red-400">Invalid LaTeX: ${eq}</span>`;
      }
    });
    setRenderedEquations(rendered);
  }, [equations]);

  // Apply easing for smoother equation transitions
  const easedProgress = easeProgress(animationProgress, 'easeInOut');

  // Single equation at a time (lifecycle rendering)
  const currentEqIndex = Math.min(
    Math.floor(easedProgress * equations.length),
    equations.length - 1
  );

  // Synthetic step for doodle overlay (current equation only)
  const syntheticStep: AnimationStep | null = useMemo(() => {
    if (currentEqIndex < 0 || equations.length === 0) return null;
    return {
      id: `eq-step-${currentEqIndex}`,
      description: 'equation',
      duration: 5,
      elements: [{
        type: 'highlight' as const,
        props: {
          content: equations[currentEqIndex]?.substring(0, 20) || '',
          x: 400,
          y: 200,
          size: 16,
        },
        animation: {
          enter: 'fadeIn' as const,
          duration: 0.6,
          delay: 0,
        },
      }],
    };
  }, [equations, currentEqIndex]);

  // Accent colors per equation card for variety
  const cardAccents = [
    { border: 'rgba(99, 102, 241, 0.3)', glow: 'rgba(99, 102, 241, 0.08)', icon: '#818CF8' },
    { border: 'rgba(52, 211, 153, 0.3)', glow: 'rgba(52, 211, 153, 0.08)', icon: '#34D399' },
    { border: 'rgba(251, 191, 36, 0.3)', glow: 'rgba(251, 191, 36, 0.08)', icon: '#FBBF24' },
    { border: 'rgba(244, 114, 182, 0.3)', glow: 'rgba(244, 114, 182, 0.08)', icon: '#F472B6' },
    { border: 'rgba(96, 165, 250, 0.3)', glow: 'rgba(96, 165, 250, 0.08)', icon: '#60A5FA' },
    { border: 'rgba(167, 139, 250, 0.3)', glow: 'rgba(167, 139, 250, 0.08)', icon: '#A78BFA' },
  ];

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 40%, #312E81 100%)',
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
        transition: 'opacity 0.45s ease, transform 0.6s ease',
      }}
    >
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Glow accents */}
      <div
        className="absolute top-[-10%] right-[-5%] w-80 h-80 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #6366F1, transparent)' }}
      />
      <div
        className="absolute bottom-[-10%] left-[-5%] w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #34D399, transparent)' }}
      />

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-10 py-8">
        <motion.h3
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: animationProgress > 0 ? 1 : 0, y: animationProgress > 0 ? 0 : -20 }}
          transition={{ duration: 0.6 }}
          className="text-2xl font-bold text-white mb-6 tracking-tight"
        >
          {title}
        </motion.h3>

        <div className="space-y-5 max-w-2xl w-full">
          <AnimatePresence mode="wait">
            {renderedEquations[currentEqIndex] && (
              <motion.div
                key={currentEqIndex}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.8 }}
                className="relative equation-block rounded-xl px-8 py-6 backdrop-blur-sm"
                style={{
                  background: cardAccents[currentEqIndex % cardAccents.length].glow,
                  border: `1px solid ${cardAccents[currentEqIndex % cardAccents.length].border}`,
                  boxShadow: `0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
                }}
              >
                {/* Equation number badge */}
                <div
                  className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${cardAccents[currentEqIndex % cardAccents.length].icon}, ${cardAccents[currentEqIndex % cardAccents.length].icon}CC)`,
                    color: '#fff',
                    boxShadow: `0 2px 12px ${cardAccents[currentEqIndex % cardAccents.length].icon}60`,
                  }}
                >
                  {currentEqIndex + 1}
                </div>

                {/* KaTeX equation content */}
                <div
                  className="katex-equation-content"
                  style={{ color: '#E2E8F0' }}
                  dangerouslySetInnerHTML={{ __html: renderedEquations[currentEqIndex] }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: animationProgress > 0.3 ? 0.7 : 0 }}
          transition={{ duration: 0.8 }}
          className="mt-6 text-slate-400 text-center max-w-lg leading-relaxed text-sm"
        >
          {narration}
        </motion.p>
      </div>

      {/* Doodle decoration overlay */}
      {enableDoodles && (
        <DoodleOverlay
          currentStep={syntheticStep}
          animationProgress={animationProgress}
          width={800}
          height={500}
        />
      )}

      {/* Global style override for KaTeX in dark mode */}
      <style jsx global>{`
        .katex-equation-content .katex { color: #E2E8F0; }
        .katex-equation-content .katex .mord { color: #E2E8F0; }
        .katex-equation-content .katex .mbin { color: #818CF8; }
        .katex-equation-content .katex .mrel { color: #60A5FA; }
        .katex-equation-content .katex .mopen,
        .katex-equation-content .katex .mclose { color: #94A3B8; }
        .katex-equation-content .katex .mpunct { color: #94A3B8; }
      `}</style>
    </div>
  );
}
