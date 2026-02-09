'use client';

import { useMemo } from 'react';
import { PaperSection, PlayerState } from '@/types';
import dynamic from 'next/dynamic';
import AnimeCharacter, { CharacterPose } from './animations/AnimeCharacter';

const EquationRenderer = dynamic(
  () => import('./animations/EquationRenderer'),
  { ssr: false }
);
const GraphRenderer = dynamic(
  () => import('./animations/GraphRenderer'),
  { ssr: false }
);
const ConceptRenderer = dynamic(
  () => import('./animations/ConceptRenderer'),
  { ssr: false }
);
const ThreeRenderer = dynamic(
  () => import('./animations/ThreeRenderer'),
  { ssr: false }
);

interface AnimationPlayerProps {
  section: PaperSection;
  playerState: PlayerState;
  animationProgress: number;
  activeStepId?: string;
  transitionState?: 'entering' | 'active' | 'exiting';
  enableDoodles?: boolean;
  enableCharacter?: boolean;
}

export default function AnimationPlayer({
  section,
  animationProgress,
  transitionState = 'active',
  enableDoodles = true,
  enableCharacter = true,
}: AnimationPlayerProps) {
  // Progress is now driven by the parent (TimelineController via AppContent)
  // No internal requestAnimationFrame loop needed

  // Compute current step index for character pose logic
  const steps = section.animationData?.steps || [];

  // Determine character pose based on animation state
  const characterPose: CharacterPose = useMemo(() => {
    if (transitionState === 'entering' || transitionState === 'exiting') {
      return 'waving';
    }

    if (steps.length === 0) return 'idle';

    // Local progress within current step
    const stepLocalProgress = (animationProgress * steps.length) % 1;

    if (stepLocalProgress < 0.25) {
      return 'pointing'; // New elements appearing
    } else if (stepLocalProgress > 0.85) {
      return 'nodding'; // Wrapping up step
    } else if (stepLocalProgress > 0.5 && stepLocalProgress < 0.7) {
      return 'thinking'; // Mid-step contemplation
    }

    return 'idle';
  }, [animationProgress, steps.length, transitionState]);

  const renderVisualization = () => {
    switch (section.visualization) {
      case 'katex':
        return (
          <EquationRenderer
            equations={section.equations || []}
            narration={section.narration}
            animationProgress={animationProgress}
            title={section.title}
            transitionState={transitionState}
            enableDoodles={enableDoodles}
          />
        );
      case 'd3':
        return (
          <GraphRenderer
            animationData={section.animationData!}
            narration={section.narration}
            animationProgress={animationProgress}
            title={section.title}
            transitionState={transitionState}
            enableDoodles={enableDoodles}
          />
        );
      case 'threejs':
        return (
          <ThreeRenderer
            animationData={section.animationData!}
            narration={section.narration}
            animationProgress={animationProgress}
            title={section.title}
            contentType={section.contentType}
            transitionState={transitionState}
          />
        );
      case 'css':
      default:
        return (
          <ConceptRenderer
            animationData={section.animationData!}
            narration={section.narration}
            animationProgress={animationProgress}
            title={section.title}
            transitionState={transitionState}
            enableDoodles={enableDoodles}
          />
        );
    }
  };

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden border border-gray-200/60 shadow-lg relative">
      {renderVisualization()}
      {enableCharacter && (
        <AnimeCharacter
          pose={characterPose}
          position="bottom-right"
          size={85}
        />
      )}
    </div>
  );
}
