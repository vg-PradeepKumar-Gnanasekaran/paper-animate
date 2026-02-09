'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { AnimationStep } from '@/types';

interface DoodleOverlayProps {
  currentStep: AnimationStep | null;
  animationProgress: number;
  width?: number;
  height?: number;
}

interface DoodleItem {
  type: 'wavy-underline' | 'sketchy-circle' | 'star' | 'squiggle-connector';
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

export default function DoodleOverlay({
  currentStep,
  animationProgress,
  width = 800,
  height = 500,
}: DoodleOverlayProps) {
  const doodles = useMemo(() => {
    if (!currentStep?.elements) return [];

    const result: DoodleItem[] = [];

    currentStep.elements.forEach((element, i) => {
      const ex = (element.props.x as number) || (width / (currentStep.elements.length + 1)) * (i + 1);
      const ey = (element.props.y as number) || height / 2;

      // Wavy underline beneath text and highlight elements
      if (element.type === 'text' || element.type === 'highlight') {
        result.push({
          type: 'wavy-underline',
          x: ex - 40,
          y: ey + 22,
          size: 80,
          color: element.type === 'highlight' ? 'rgba(251, 191, 36, 0.35)' : 'rgba(129, 140, 248, 0.25)',
          delay: (element.animation.delay || 0) + 0.4,
        });
      }

      // Sketchy circle around nodes
      if (element.type === 'node') {
        result.push({
          type: 'sketchy-circle',
          x: ex,
          y: ey,
          size: ((element.props.size as number) || 22) + 14,
          color: 'rgba(167, 139, 250, 0.2)',
          delay: (element.animation.delay || 0) + 0.5,
        });
      }

      // Small star accent near first 2 shapes
      if (element.type === 'shape' && i < 2) {
        result.push({
          type: 'star',
          x: ex + ((element.props.width as number) || 100) / 2 + 10,
          y: ey - 10,
          size: 8,
          color: 'rgba(251, 191, 36, 0.4)',
          delay: (element.animation.delay || 0) + 0.7,
        });
      }

      // Squiggle connector between consecutive node/shape pairs
      if (i > 0) {
        const prev = currentStep.elements[i - 1];
        if (
          (prev.type === 'node' || prev.type === 'shape') &&
          (element.type === 'node' || element.type === 'shape')
        ) {
          const px = (prev.props.x as number) || (width / (currentStep.elements.length + 1)) * i;
          const py = (prev.props.y as number) || height / 2;
          result.push({
            type: 'squiggle-connector',
            x: (px + ex) / 2,
            y: (py + ey) / 2,
            size: Math.sqrt((ex - px) ** 2 + (ey - py) ** 2),
            color: 'rgba(96, 165, 250, 0.15)',
            delay: (element.animation.delay || 0) + 0.5,
          });
        }
      }
    });

    // Cap at 6 doodles for minimalism
    return result.slice(0, 6);
  }, [currentStep, width, height]);

  if (doodles.length === 0 || animationProgress < 0.05) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-20"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: 'visible' }}
    >
      {doodles.map((doodle, i) => (
        <motion.g
          key={`doodle-${i}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: animationProgress > 0.1 ? 1 : 0 }}
          transition={{ duration: 0.8, delay: doodle.delay }}
        >
          {doodle.type === 'wavy-underline' && (
            <motion.path
              d={`M${doodle.x},${doodle.y} q${doodle.size * 0.25},-5 ${doodle.size * 0.5},0 q${doodle.size * 0.25},5 ${doodle.size * 0.5},0`}
              fill="none"
              stroke={doodle.color}
              strokeWidth={1.5}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, delay: doodle.delay }}
            />
          )}

          {doodle.type === 'sketchy-circle' && (
            <motion.ellipse
              cx={doodle.x}
              cy={doodle.y}
              rx={doodle.size}
              ry={doodle.size * 0.88}
              fill="none"
              stroke={doodle.color}
              strokeWidth={1.2}
              strokeDasharray="4,3"
              strokeLinecap="round"
              transform={`rotate(-3, ${doodle.x}, ${doodle.y})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, delay: doodle.delay }}
            />
          )}

          {doodle.type === 'star' && (
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: doodle.delay, type: 'spring' }}
            >
              <path
                d={`M${doodle.x},${doodle.y - doodle.size} L${doodle.x + doodle.size * 0.3},${doodle.y - doodle.size * 0.3} L${doodle.x + doodle.size},${doodle.y} L${doodle.x + doodle.size * 0.3},${doodle.y + doodle.size * 0.3} L${doodle.x},${doodle.y + doodle.size} L${doodle.x - doodle.size * 0.3},${doodle.y + doodle.size * 0.3} L${doodle.x - doodle.size},${doodle.y} L${doodle.x - doodle.size * 0.3},${doodle.y - doodle.size * 0.3} Z`}
                fill={doodle.color}
                stroke="none"
              />
            </motion.g>
          )}

          {doodle.type === 'squiggle-connector' && (
            <motion.path
              d={`M${doodle.x - doodle.size * 0.35},${doodle.y} q${doodle.size * 0.09},-4 ${doodle.size * 0.175},0 q${doodle.size * 0.09},4 ${doodle.size * 0.175},0 q${doodle.size * 0.09},-4 ${doodle.size * 0.175},0 q${doodle.size * 0.09},4 ${doodle.size * 0.175},0`}
              fill="none"
              stroke={doodle.color}
              strokeWidth={1}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: doodle.delay }}
            />
          )}
        </motion.g>
      ))}
    </svg>
  );
}
