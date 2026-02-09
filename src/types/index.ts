export type ContentType = 'equation' | 'algorithm' | 'biological_process' | 'graph' | 'diagram' | 'concept';
export type VisualizationType = 'threejs' | 'd3' | 'css' | 'katex';
export type FieldType = 'mathematics' | 'computer_science' | 'biology' | 'physics' | 'chemistry' | 'general';
export type VisualStyle = 'minimal' | 'detailed';
export type ColorScheme = 'light' | 'dark' | 'field-specific';
export type NarratorPerspective = 'first-person' | 'third-person' | 'instructor';

// ============================================
// Keyframe Types
// ============================================

/** 2D keyframe for CSS/Framer Motion elements */
export interface Keyframe {
  time: number;          // 0-1 within step
  x?: number;
  y?: number;
  z?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number | [number, number, number];
  opacity?: number;
  color?: string;
  easing?: string;       // controls interpolation FROM this keyframe TO next
}

/** 3D keyframe for Three.js objects */
export interface Keyframe3D {
  time: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  opacity?: number;
  easing?: string;
}

/** Camera track keyframe */
export interface CameraKeyframe {
  time: number;
  position: [number, number, number];
  lookAt?: [number, number, number];
  fov?: number;
  easing?: string;
}

// ============================================
// 3D Shape Types (Data-Driven ThreeRenderer)
// ============================================

export type ThreeGeometryType =
  | 'sphere' | 'box' | 'cylinder' | 'torus' | 'cone'
  | 'plane' | 'ring' | 'dodecahedron' | 'octahedron';

export type ThreeMaterialType =
  | 'standard' | 'physical' | 'wireframe' | 'glass' | 'toon';

export interface ThreeElement {
  geometry: ThreeGeometryType;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  color: string;
  label?: string;
  material?: ThreeMaterialType;
  keyframes?: Keyframe3D[];
}

export interface ThreeSceneConfig {
  threeElements?: ThreeElement[];
  cameraTrack?: CameraKeyframe[];
}

export interface PaperSection {
  id: string;
  title: string;
  contentType: ContentType;
  visualization: VisualizationType;
  concept: string;
  narration: string;
  equations?: string[];
  codeSnippet?: string;
  animationData?: AnimationData;
  manimCode?: string;
  script?: SectionScript;
}

export interface AnimationData {
  type: VisualizationType;
  config: Record<string, unknown> & Partial<ThreeSceneConfig>;
  steps: AnimationStep[];
}

export interface AnimationStep {
  id: string;
  description: string;
  duration: number; // seconds
  elements: AnimationElement[];
}

export type ContinuousAnimation = 'float' | 'pulse' | 'rotate' | 'sway' | 'none';
export type ExitAnimation = 'fadeOut' | 'slideDown' | 'scaleDown' | 'slideLeft' | 'none';

export interface AnimationElement {
  type: 'text' | 'shape' | 'equation' | 'line' | 'node' | 'edge' | 'molecule' | 'arrow' | 'highlight';
  props: Record<string, unknown>;
  animation: {
    enter: string; // 'fadeIn' | 'slideUp' | 'draw' | 'scale'
    exit?: ExitAnimation;
    continuous?: ContinuousAnimation;
    keyframes?: Keyframe[];  // Optional per-element keyframe track
    duration: number;
    delay: number;
  };
}

export interface AnalysisResult {
  field: FieldType;
  title: string;
  abstract: string;
  sections: PaperSection[];
  suggestedStyle: VisualStyle;
  totalDuration: number; // estimated seconds
  presentationScript?: PresentationScript;
}

export interface UserSettings {
  narrationSpeed: 'slow' | 'normal' | 'fast';
  visualStyle: VisualStyle;
  colorScheme: ColorScheme;
  animationDuration: number; // seconds per concept
  includeEquations: boolean;
  includeCode: boolean;
  showNarration: boolean;
  narratorPerspective: NarratorPerspective;
  enableDoodles: boolean;
  enableCharacter: boolean;
}

export interface PlayerState {
  isPlaying: boolean;
  currentSection: number;
  currentStep: number;
  currentSegment: number;
  progress: number; // 0-1
  globalTime: number; // absolute time in seconds
  speed: number; // playback speed multiplier
  isTransitioning: boolean;
}

// ============================================
// Script & Timeline Types
// ============================================

export type TransitionType = 'crossfade' | 'slide-left' | 'zoom-out-in' | 'cut' | 'perspective-push' | 'parallax-wipe';
export type PacingType = 'pause-before' | 'pause-after' | 'normal';

export interface NarrationSegment {
  id: string;
  text: string;
  stepId: string;
  estimatedDuration: number;
  startTime: number;
  endTime: number;
  emphasis?: string[];
  pacing: PacingType;
}

export interface SectionScript {
  sectionId: string;
  fullText: string;
  segments: NarrationSegment[];
  totalDuration: number;
}

export interface SectionTransition {
  fromSectionId: string;
  toSectionId: string;
  type: TransitionType;
  duration: number;
}

export interface PresentationScript {
  paperTitle: string;
  sections: SectionScript[];
  transitions: SectionTransition[];
  totalDuration: number;
}

export interface TimelineState {
  phase: 'section' | 'transition' | 'complete';
  sectionIndex: number;
  segmentIndex: number;
  sectionProgress: number;
  segmentProgress: number;
  activeStepId: string;
  currentText: string;
  emphasis: string[];
  globalTime: number;
  fromSection?: number;
  toSection?: number;
  transitionProgress?: number;
}
