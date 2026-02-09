import { AnimationData, AnimationStep, CameraKeyframe, Keyframe3D, PaperSection, ThreeElement, ThreeGeometryType, VisualizationType } from '@/types';

const COLOR_PALETTE = ['#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#22D3EE', '#94A3B8'];

const GEOMETRY_GROUPS: Record<string, ThreeGeometryType[]> = {
  biological_process: ['sphere', 'dodecahedron', 'cylinder', 'torus', 'sphere', 'octahedron'],
  algorithm: ['box', 'cylinder', 'torus', 'cone', 'box', 'octahedron'],
  graph: ['sphere', 'box', 'cylinder', 'torus', 'sphere', 'cone'],
  diagram: ['box', 'cylinder', 'sphere', 'cone', 'torus', 'dodecahedron'],
  equation: ['torus', 'sphere', 'box', 'cylinder', 'octahedron', 'cone'],
  concept: ['sphere', 'box', 'torus', 'cone', 'dodecahedron', 'cylinder'],
  default: ['sphere', 'box', 'cylinder', 'torus', 'cone', 'octahedron'],
};

const VISUALIZATION_SYNONYMS: Record<string, VisualizationType> = {
  three: 'threejs',
  'three-js': 'threejs',
  'three_js': 'threejs',
  'threejs': 'threejs',
  'three.js': 'threejs',
  'r3f': 'threejs',
  '3d': 'threejs',
  'css': 'css',
  'd3': 'd3',
  'katex': 'katex',
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeVector3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (Array.isArray(value)) {
    const [xRaw, yRaw, zRaw] = value as unknown[];
    const coords = [xRaw, yRaw, zRaw].map((component) => {
      if (typeof component === 'number' && Number.isFinite(component)) return component;
      if (typeof component === 'string') {
        const parsed = Number(component);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    });
    if (coords.every((c) => typeof c === 'number')) {
      return [coords[0] as number, coords[1] as number, coords[2] as number];
    }
  }
  if (value && typeof value === 'object') {
    const vec = value as Record<string, unknown>;
    const xRaw = vec.x ?? vec.X ?? vec[0];
    const yRaw = vec.y ?? vec.Y ?? vec[1];
    const zRaw = vec.z ?? vec.Z ?? vec[2];
    const coords = [xRaw, yRaw, zRaw].map((component) => {
      if (typeof component === 'number' && Number.isFinite(component)) return component;
      if (typeof component === 'string') {
        const parsed = Number(component);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    });
    if (coords.every((c) => typeof c === 'number')) {
      return [coords[0] as number, coords[1] as number, coords[2] as number];
    }
  }
  return fallback;
}

function normalizeGeometry(value: unknown, fallback: ThreeGeometryType): ThreeGeometryType {
  if (typeof value !== 'string') return fallback;
  const key = value.trim().toLowerCase();
  switch (key) {
    case 'cube':
    case 'box':
    case 'rect':
      return 'box';
    case 'sphere':
    case 'ball':
      return 'sphere';
    case 'cylinder':
    case 'pillar':
      return 'cylinder';
    case 'torus':
    case 'ring':
      return 'torus';
    case 'cone':
    case 'pyramid':
      return 'cone';
    case 'plane':
      return 'plane';
    case 'dodecahedron':
      return 'dodecahedron';
    case 'octahedron':
      return 'octahedron';
    default:
      return fallback;
  }
}

function normalizeMaterial(value: unknown): ThreeElement['material'] | undefined {
  if (typeof value !== 'string') return undefined;
  const key = value.trim().toLowerCase();
  switch (key) {
    case 'wireframe':
      return 'wireframe';
    case 'glass':
    case 'transparent':
      return 'glass';
    case 'toon':
      return 'toon';
    case 'physical':
      return 'physical';
    case 'standard':
      return 'standard';
    default:
      return undefined;
  }
}

function defaultPositionForIndex(index: number): [number, number, number] {
  const radius = 2.4;
  const angle = (index / Math.max(1, 6)) * Math.PI * 2;
  const y = index % 2 === 0 ? 0.6 : -0.6;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius] as [number, number, number];
}

function sanitizeKeyframes(value: unknown): ThreeElement['keyframes'] {
  if (!Array.isArray(value)) return undefined;
  const frames = value
    .map((frame) => {
      if (!frame || typeof frame !== 'object') return null;
      const obj = frame as Record<string, unknown>;
      const timeValue = obj.time ?? obj.t ?? obj.progress;
      const time = typeof timeValue === 'number' ? timeValue : Number(timeValue);
      if (!Number.isFinite(time)) return null;
      const normalized: Keyframe3D = {
        time: Math.max(0, Math.min(1, time)),
        position: obj.position ? normalizeVector3(obj.position, [0, 0, 0]) : undefined,
        rotation: obj.rotation ? normalizeVector3(obj.rotation, [0, 0, 0]) : undefined,
        scale: Array.isArray(obj.scale)
          ? (obj.scale as number[]).length === 3
            ? (obj.scale as [number, number, number])
            : undefined
          : typeof obj.scale === 'number'
          ? obj.scale
          : undefined,
        opacity: isFiniteNumber(obj.opacity) ? (obj.opacity as number) : undefined,
        easing: typeof obj.easing === 'string' ? obj.easing : undefined,
      };
      return normalized;
    })
    .filter(Boolean) as Keyframe3D[];

  if (frames.length === 0) return undefined;

  const sorted = [...frames].sort((a, b) => a.time - b.time);
  if (sorted[0].time > 0) {
    sorted.unshift({ ...sorted[0], time: 0 });
  }
  if (sorted[sorted.length - 1].time < 1) {
    sorted.push({ ...sorted[sorted.length - 1], time: 1 });
  }
  return sorted;
}

function sanitizeThreeElements(
  rawElements: unknown,
  contentType: string,
  sectionIndex: number
): ThreeElement[] {
  if (!Array.isArray(rawElements)) return [];
  const geometries = GEOMETRY_GROUPS[contentType] || GEOMETRY_GROUPS.default;

  return rawElements
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') return null;
      const obj = raw as Record<string, unknown>;
      const geometry = normalizeGeometry(obj.geometry, geometries[index % geometries.length]);
      const color = typeof obj.color === 'string' && obj.color.trim().length > 0
        ? obj.color
        : COLOR_PALETTE[(sectionIndex + index) % COLOR_PALETTE.length];
      const position = normalizeVector3(obj.position, defaultPositionForIndex(index));
      const rotation = obj.rotation ? normalizeVector3(obj.rotation, [0, 0, 0]) : undefined;
      const material = normalizeMaterial(obj.material);
      const label = typeof obj.label === 'string' ? obj.label : undefined;
      const scaleRaw = obj.scale;
      let scale: ThreeElement['scale'];
      if (Array.isArray(scaleRaw) && scaleRaw.length === 3 && scaleRaw.every(isFiniteNumber)) {
        scale = scaleRaw as [number, number, number];
      } else if (isFiniteNumber(scaleRaw)) {
        scale = scaleRaw as number;
      }

      return {
        geometry,
        position,
        rotation,
        color,
        label,
        material,
        scale,
        keyframes: sanitizeKeyframes(obj.keyframes),
      } satisfies ThreeElement;
    })
    .filter(Boolean) as ThreeElement[];
}

function keywordsFromStep(step: AnimationStep): string[] {
  const terms: string[] = [];
  const elements = step.elements || [];
  elements.forEach((element) => {
    const content = element.props?.content;
    if (typeof content === 'string') {
      const words = content.split(/[,;/\-\s]+/).filter((w) => w.length > 3);
      terms.push(...words.slice(0, 2));
    }
  });
  return Array.from(new Set(terms)).slice(0, 3);
}

function deriveLabels(section: PaperSection): string[] {
  const labels: string[] = [];
  const steps = section.animationData?.steps || [];
  steps.forEach((step) => {
    const stepKeywords = keywordsFromStep(step);
    if (stepKeywords.length > 0) {
      labels.push(stepKeywords.join(' '));
    } else if (step.description) {
      labels.push(step.description);
    }
  });
  if (labels.length === 0 && section.script?.segments) {
    labels.push(
      ...section.script.segments
        .map((segment) => segment.text)
        .filter(Boolean)
        .slice(0, 6)
    );
  }
  if (labels.length === 0 && section.concept) {
    labels.push(section.concept);
  }
  if (labels.length === 0 && section.title) {
    labels.push(section.title);
  }
  return labels;
}

function generateFallbackThreeElements(section: PaperSection, sectionIndex: number): ThreeElement[] {
  const labels = deriveLabels(section);
  const total = Math.min(Math.max(labels.length || 4, 3), 6);
  const geometries = GEOMETRY_GROUPS[section.contentType] || GEOMETRY_GROUPS.default;
  const elements: ThreeElement[] = [];

  for (let i = 0; i < total; i++) {
    const angle = (i / total) * Math.PI * 2 + sectionIndex * 0.35;
    const radius = 2.4;
    const height = i % 2 === 0 ? 0.6 : -0.5;
    const basePosition: [number, number, number] = [
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius,
    ];

    const color = COLOR_PALETTE[(sectionIndex * 3 + i) % COLOR_PALETTE.length];
    const label = labels[i] || `Concept ${i + 1}`;

    elements.push({
      geometry: geometries[i % geometries.length],
      position: basePosition,
      color,
      label,
      material: i % 3 === 0 ? 'physical' : i % 3 === 1 ? 'glass' : 'standard',
      keyframes: [
        {
          time: 0,
          position: [basePosition[0] * 1.4, basePosition[1] + 1, basePosition[2] * 1.4],
          easing: 'backOut',
          opacity: 0,
          scale: 0.4,
        },
        {
          time: 0.35,
          position: basePosition,
          easing: 'easeOut',
          opacity: 0.9,
          scale: 1,
        },
        {
          time: 1,
          position: [basePosition[0] * 1.05, basePosition[1] + 0.15, basePosition[2] * 1.05],
          easing: 'easeInOut',
          opacity: 0.95,
          scale: 1.05,
        },
      ],
    });
  }

  // Add a core element to anchor the scene
  elements.push({
    geometry: 'sphere',
    position: [0, 0, 0],
    color: COLOR_PALETTE[(sectionIndex + 5) % COLOR_PALETTE.length],
    label: section.concept || section.title || 'Core Idea',
    material: 'toon',
    scale: 1.2,
    keyframes: [
      { time: 0, scale: 0.5, opacity: 0.6, easing: 'backOut' },
      { time: 0.25, scale: 1.1, opacity: 0.95, easing: 'elasticOut' },
      { time: 1, scale: 1.05, opacity: 0.95, easing: 'easeInOut' },
    ],
  });

  return elements.slice(0, 6);
}

function sanitizeCameraTrack(rawTrack: unknown): CameraKeyframe[] {
  if (!Array.isArray(rawTrack)) return [];
  const track = rawTrack
    .map((frame) => {
      if (!frame || typeof frame !== 'object') return null;
      const obj = frame as Record<string, unknown>;
      const position = normalizeVector3(obj.position, [0, 0, 8] as [number, number, number]);
      const lookAt = obj.lookAt
        ? normalizeVector3(obj.lookAt, [0, 0, 0] as [number, number, number])
        : ([0, 0, 0] as [number, number, number]);
      const timeValue = obj.time ?? obj.t ?? obj.progress;
      const time = typeof timeValue === 'number' ? timeValue : Number(timeValue);
      if (!Number.isFinite(time)) return null;
      const fov = isFiniteNumber(obj.fov) ? (obj.fov as number) : undefined;
      const easing = typeof obj.easing === 'string' ? obj.easing : undefined;
      return { time, position, lookAt, fov: fov ?? 50, easing } satisfies CameraKeyframe;
    })
    .filter(Boolean) as CameraKeyframe[];

  const sorted = track.sort((a, b) => a.time - b.time);
  const uniqueTimes: Set<number> = new Set();
  const deduped = sorted.filter((frame) => {
    if (uniqueTimes.has(frame.time)) return false;
    uniqueTimes.add(frame.time);
    return true;
  });

  if (deduped.length === 0) return [];

  if (deduped[0].time > 0) {
    deduped.unshift({ ...deduped[0], time: 0 });
  }
  if (deduped[deduped.length - 1].time < 1) {
    deduped.push({ ...deduped[deduped.length - 1], time: 1 });
  }

  return deduped;
}

function defaultCameraTrack(sectionIndex: number): CameraKeyframe[] {
  const offset = (sectionIndex % 5) * 0.4;
  return [
    {
      time: 0,
  position: [Math.sin(offset) * 6.5, 2.2, Math.cos(offset) * 8] as [number, number, number],
  lookAt: [0, 0, 0] as [number, number, number],
      fov: 52,
      easing: 'easeOut',
    },
    {
      time: 0.5,
  position: [0.2, 1.1, 6] as [number, number, number],
  lookAt: [0, 0, 0] as [number, number, number],
      fov: 48,
      easing: 'cubicInOut',
    },
    {
      time: 1,
  position: [-Math.sin(offset + 0.6) * 6, 1.5, Math.cos(offset + 0.6) * 7] as [number, number, number],
  lookAt: [0, 0.3, 0] as [number, number, number],
      fov: 50,
      easing: 'easeInOut',
    },
  ];
}

function isThreeVisualization(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return VISUALIZATION_SYNONYMS[normalized] === 'threejs';
}

function chooseVisualizationType(value: string | undefined, fallback?: string): VisualizationType {
  if (value) {
    const key = value.trim().toLowerCase();
    if (VISUALIZATION_SYNONYMS[key]) {
      return VISUALIZATION_SYNONYMS[key];
    }
  }
  if (fallback) {
    const key = fallback.trim().toLowerCase();
    if (VISUALIZATION_SYNONYMS[key]) {
      return VISUALIZATION_SYNONYMS[key];
    }
  }
  return 'css';
}

function shouldPromoteToThree(section: PaperSection): boolean {
  const contentHint = section.contentType;
  if (isThreeVisualization(section.visualization)) return true;
  if (section.animationData?.type && isThreeVisualization(section.animationData.type)) return true;
  if (section.animationData?.config?.threeElements) return true;
  if (['biological_process', 'graph'].includes(contentHint)) return true;
  const text = `${section.title} ${section.concept} ${section.narration}`.toLowerCase();
  const keywords = ['3d', 'spatial', 'geometry', 'structure', 'molecule', 'vector', 'volume', 'surface', 'trajectory'];
  return keywords.some((kw) => text.includes(kw));
}

function ensureAnimationData(section: PaperSection): AnimationData {
  if (section.animationData) return section.animationData;
  const steps: AnimationStep[] = section.script?.segments
    ? section.script.segments.map((segment, index) => ({
        id: segment.stepId || `${section.id}-step-${index + 1}`,
        description: segment.text,
        duration: Math.max(3, Math.round(segment.estimatedDuration || 4)),
        elements: [],
      }))
    : [
        {
          id: `${section.id}-step-1`,
          description: section.concept || section.title || 'Concept overview',
          duration: 6,
          elements: [],
        },
      ];
  return {
    type: 'threejs',
    config: {},
    steps,
  } satisfies AnimationData;
}

export function normalizeVisualization(section: PaperSection): VisualizationType {
  const normalized = chooseVisualizationType(section.visualization, section.animationData?.type);
  section.visualization = normalized;
  if (section.animationData) {
    section.animationData.type = normalized;
  }
  return normalized;
}

export function enhanceThreeScene(section: PaperSection, sectionIndex: number): void {
  const visualization = normalizeVisualization(section);
  const shouldUseThree = visualization === 'threejs' || shouldPromoteToThree(section);
  if (!shouldUseThree) return;

  const animationData = ensureAnimationData(section);
  section.animationData = animationData;
  section.visualization = 'threejs';
  animationData.type = 'threejs';

  const sanitized = sanitizeThreeElements(animationData.config?.threeElements, section.contentType, sectionIndex);
  const elements = sanitized.length > 0 ? sanitized : generateFallbackThreeElements(section, sectionIndex);

  const track = sanitizeCameraTrack(animationData.config?.cameraTrack);
  const cameraTrack = track.length > 0 ? track : defaultCameraTrack(sectionIndex);

  animationData.config = {
    ...animationData.config,
    threeElements: elements,
    cameraTrack,
  };
}

export function ensureThreeVisuals(sections: PaperSection[]): void {
  sections.forEach((section, index) => enhanceThreeScene(section, index));
}
