/**
 * Keyframe Interpolation Engine
 *
 * Pure-function library for interpolating animation keyframes.
 * Uses GSAP easing for professional, organic motion curves.
 * Zero React dependencies — consumed by renderers and Three.js components.
 */

import gsap from 'gsap';
import type { Keyframe, Keyframe3D, CameraKeyframe } from '@/types';

// ============================================
// GSAP Easing — 40+ built-in curves
// ============================================

/**
 * Map our legacy easing names to GSAP easing strings.
 * GSAP also accepts its own names directly (e.g., 'power3.inOut', 'elastic.out(1, 0.3)')
 */
const easingAliases: Record<string, string> = {
  linear: 'none',
  easeIn: 'power1.in',
  easeOut: 'power1.out',
  easeInOut: 'power2.inOut',
  backOut: 'back.out(1.7)',
  cubicOut: 'power3.out',
  cubicInOut: 'power3.inOut',
  bounceOut: 'bounce.out',
  elasticOut: 'elastic.out(1, 0.3)',
  quadOut: 'power1.out',
  spring: 'back.out(2.5)',
};

/**
 * Apply an easing function to a linear progress value.
 * Accepts both legacy names (easeInOut, backOut) and GSAP names (power2.inOut, elastic.out(1, 0.3)).
 */
export function easeProgress(progress: number, easing: string = 'easeInOut'): number {
  const clamped = Math.max(0, Math.min(1, progress));
  // Resolve alias, then parse GSAP ease
  const gsapName = easingAliases[easing] || easing;
  const easeFn = gsap.parseEase(gsapName);
  return easeFn ? easeFn(clamped) : clamped;
}

// ============================================
// Interpolated State Types
// ============================================

export interface InterpolatedState {
  x: number;
  y: number;
  z: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  opacity: number;
  color?: string;
}

export interface InterpolatedCameraState {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

// ============================================
// Color Interpolation (via GSAP utility)
// ============================================

function lerpColor(c1: string, c2: string, t: number): string {
  try {
    return gsap.utils.interpolate(c1, c2, t) as string;
  } catch {
    return t < 0.5 ? c1 : c2;
  }
}

// ============================================
// Numeric Interpolation
// ============================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpTuple3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// ============================================
// Scale Normalization
// ============================================

function normalizeScale(s: number | [number, number, number] | undefined, fallback: number = 1): [number, number, number] {
  if (s === undefined) return [fallback, fallback, fallback];
  if (typeof s === 'number') return [s, s, s];
  return s;
}

// ============================================
// Core: 2D Keyframe Interpolation
// ============================================

/**
 * Find the two keyframes surrounding `progress` and compute interpolated state.
 * Keyframes must be sorted by `time` ascending (0 → 1).
 */
export function interpolateKeyframes(
  keyframes: Keyframe[],
  progress: number
): InterpolatedState {
  if (!keyframes || keyframes.length === 0) {
    return {
      x: 0, y: 0, z: 0,
      rotateX: 0, rotateY: 0, rotateZ: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
      opacity: 1,
    };
  }

  // Clamp progress
  const p = Math.max(0, Math.min(1, progress));

  // Single keyframe — return it as-is
  if (keyframes.length === 1) {
    const kf = keyframes[0];
    const [sx, sy, sz] = normalizeScale(kf.scale);
    return {
      x: kf.x ?? 0,
      y: kf.y ?? 0,
      z: kf.z ?? 0,
      rotateX: kf.rotateX ?? 0,
      rotateY: kf.rotateY ?? 0,
      rotateZ: kf.rotateZ ?? 0,
      scaleX: sx,
      scaleY: sy,
      scaleZ: sz,
      opacity: kf.opacity ?? 1,
      color: kf.color,
    };
  }

  // Before first keyframe
  if (p <= keyframes[0].time) {
    const kf = keyframes[0];
    const [sx, sy, sz] = normalizeScale(kf.scale);
    return {
      x: kf.x ?? 0,
      y: kf.y ?? 0,
      z: kf.z ?? 0,
      rotateX: kf.rotateX ?? 0,
      rotateY: kf.rotateY ?? 0,
      rotateZ: kf.rotateZ ?? 0,
      scaleX: sx,
      scaleY: sy,
      scaleZ: sz,
      opacity: kf.opacity ?? 1,
      color: kf.color,
    };
  }

  // After last keyframe
  if (p >= keyframes[keyframes.length - 1].time) {
    const kf = keyframes[keyframes.length - 1];
    const [sx, sy, sz] = normalizeScale(kf.scale);
    return {
      x: kf.x ?? 0,
      y: kf.y ?? 0,
      z: kf.z ?? 0,
      rotateX: kf.rotateX ?? 0,
      rotateY: kf.rotateY ?? 0,
      rotateZ: kf.rotateZ ?? 0,
      scaleX: sx,
      scaleY: sy,
      scaleZ: sz,
      opacity: kf.opacity ?? 1,
      color: kf.color,
    };
  }

  // Find surrounding keyframes
  let fromIdx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (p >= keyframes[i].time && p < keyframes[i + 1].time) {
      fromIdx = i;
      break;
    }
  }

  const from = keyframes[fromIdx];
  const to = keyframes[fromIdx + 1];

  // Local progress within this keyframe segment
  const segmentLength = to.time - from.time;
  const localProgress = segmentLength > 0 ? (p - from.time) / segmentLength : 0;

  // Apply easing (the "from" keyframe's easing controls how we approach "to")
  const eased = easeProgress(localProgress, from.easing || 'easeInOut');

  // Interpolate all properties
  const fromScale = normalizeScale(from.scale);
  const toScale = normalizeScale(to.scale);

  const result: InterpolatedState = {
    x: lerp(from.x ?? 0, to.x ?? from.x ?? 0, eased),
    y: lerp(from.y ?? 0, to.y ?? from.y ?? 0, eased),
    z: lerp(from.z ?? 0, to.z ?? from.z ?? 0, eased),
    rotateX: lerp(from.rotateX ?? 0, to.rotateX ?? from.rotateX ?? 0, eased),
    rotateY: lerp(from.rotateY ?? 0, to.rotateY ?? from.rotateY ?? 0, eased),
    rotateZ: lerp(from.rotateZ ?? 0, to.rotateZ ?? from.rotateZ ?? 0, eased),
    scaleX: lerp(fromScale[0], toScale[0], eased),
    scaleY: lerp(fromScale[1], toScale[1], eased),
    scaleZ: lerp(fromScale[2], toScale[2], eased),
    opacity: lerp(from.opacity ?? 1, to.opacity ?? from.opacity ?? 1, eased),
  };

  // Color interpolation
  if (from.color && to.color) {
    result.color = lerpColor(from.color, to.color, eased);
  } else {
    result.color = to.color || from.color;
  }

  return result;
}

// ============================================
// Core: 3D Keyframe Interpolation
// ============================================

export interface Interpolated3DState {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  opacity: number;
}

/**
 * Interpolate 3D keyframes for Three.js objects.
 */
export function interpolate3DKeyframes(
  keyframes: Keyframe3D[],
  progress: number
): Interpolated3DState {
  const defaultState: Interpolated3DState = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    opacity: 1,
  };

  if (!keyframes || keyframes.length === 0) return defaultState;

  const p = Math.max(0, Math.min(1, progress));

  if (keyframes.length === 1) {
    const kf = keyframes[0];
    return {
      position: kf.position || [0, 0, 0],
      rotation: kf.rotation || [0, 0, 0],
      scale: normalizeScale(kf.scale),
      opacity: kf.opacity ?? 1,
    };
  }

  // Before first / after last
  if (p <= keyframes[0].time) {
    const kf = keyframes[0];
    return {
      position: kf.position || [0, 0, 0],
      rotation: kf.rotation || [0, 0, 0],
      scale: normalizeScale(kf.scale),
      opacity: kf.opacity ?? 1,
    };
  }
  if (p >= keyframes[keyframes.length - 1].time) {
    const kf = keyframes[keyframes.length - 1];
    return {
      position: kf.position || [0, 0, 0],
      rotation: kf.rotation || [0, 0, 0],
      scale: normalizeScale(kf.scale),
      opacity: kf.opacity ?? 1,
    };
  }

  // Find surrounding keyframes
  let fromIdx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (p >= keyframes[i].time && p < keyframes[i + 1].time) {
      fromIdx = i;
      break;
    }
  }

  const from = keyframes[fromIdx];
  const to = keyframes[fromIdx + 1];

  const segLen = to.time - from.time;
  const local = segLen > 0 ? (p - from.time) / segLen : 0;
  const eased = easeProgress(local, from.easing || 'easeInOut');

  return {
    position: lerpTuple3(from.position || [0, 0, 0], to.position || from.position || [0, 0, 0], eased),
    rotation: lerpTuple3(from.rotation || [0, 0, 0], to.rotation || from.rotation || [0, 0, 0], eased),
    scale: lerpTuple3(normalizeScale(from.scale), normalizeScale(to.scale), eased),
    opacity: lerp(from.opacity ?? 1, to.opacity ?? from.opacity ?? 1, eased),
  };
}

// ============================================
// Core: Camera Track Interpolation
// ============================================

/**
 * Interpolate camera position, lookAt target, and FOV along a keyframe track.
 */
export function interpolateCameraTrack(
  keyframes: CameraKeyframe[],
  progress: number
): InterpolatedCameraState {
  const defaults: InterpolatedCameraState = {
    position: [0, 0, 6],
    lookAt: [0, 0, 0],
    fov: 50,
  };

  if (!keyframes || keyframes.length === 0) return defaults;

  const p = Math.max(0, Math.min(1, progress));

  if (keyframes.length === 1) {
    const kf = keyframes[0];
    return {
      position: kf.position,
      lookAt: kf.lookAt || [0, 0, 0],
      fov: kf.fov ?? 50,
    };
  }

  // Before first / after last
  if (p <= keyframes[0].time) {
    const kf = keyframes[0];
    return {
      position: kf.position,
      lookAt: kf.lookAt || [0, 0, 0],
      fov: kf.fov ?? 50,
    };
  }
  if (p >= keyframes[keyframes.length - 1].time) {
    const kf = keyframes[keyframes.length - 1];
    return {
      position: kf.position,
      lookAt: kf.lookAt || [0, 0, 0],
      fov: kf.fov ?? 50,
    };
  }

  // Find surrounding keyframes
  let fromIdx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (p >= keyframes[i].time && p < keyframes[i + 1].time) {
      fromIdx = i;
      break;
    }
  }

  const from = keyframes[fromIdx];
  const to = keyframes[fromIdx + 1];

  const segLen = to.time - from.time;
  const local = segLen > 0 ? (p - from.time) / segLen : 0;
  const eased = easeProgress(local, from.easing || 'easeInOut');

  return {
    position: lerpTuple3(from.position, to.position, eased),
    lookAt: lerpTuple3(from.lookAt || [0, 0, 0], to.lookAt || [0, 0, 0], eased),
    fov: lerp(from.fov ?? 50, to.fov ?? 50, eased),
  };
}

// ============================================
// Legacy Compatibility: Convert enter/exit to Keyframes
// ============================================

/**
 * Synthesizes a Keyframe[] array from legacy animation properties
 * (enter, continuous, exit) so old data still animates with the new engine.
 *
 * @param animation - The animation block from AnimationElement
 * @param index - Element index within the step (for stagger)
 * @param totalElements - Total elements in the step
 * @returns Keyframe[] that approximates the legacy behavior
 */
export function keyframesFromLegacyAnimation(
  animation: {
    enter: string;
    exit?: string;
    continuous?: string;
    duration: number;
    delay: number;
  },
  elementProps: { x?: number; y?: number },
  index: number = 0
): Keyframe[] {
  const keyframes: Keyframe[] = [];
  const baseX = (elementProps.x as number) || 0;
  const baseY = (elementProps.y as number) || 0;

  // ---- ENTER phase (0 → 0.2) ----
  const enterEnd = 0.15 + index * 0.05; // stagger
  const clampedEnterEnd = Math.min(enterEnd, 0.4);

  switch (animation.enter) {
    case 'slideUp':
      keyframes.push(
        { time: 0, x: baseX, y: baseY + 40, opacity: 0, easing: 'cubicOut' },
        { time: clampedEnterEnd, x: baseX, y: baseY, opacity: 1 },
      );
      break;
    case 'slideRight':
      keyframes.push(
        { time: 0, x: baseX - 40, y: baseY, opacity: 0, easing: 'cubicOut' },
        { time: clampedEnterEnd, x: baseX, y: baseY, opacity: 1 },
      );
      break;
    case 'scale':
      keyframes.push(
        { time: 0, x: baseX, y: baseY, opacity: 0, scale: 0, easing: 'backOut' },
        { time: clampedEnterEnd, x: baseX, y: baseY, opacity: 1, scale: 1 },
      );
      break;
    case 'fadeIn':
    default:
      keyframes.push(
        { time: 0, x: baseX, y: baseY, opacity: 0, easing: 'easeOut' },
        { time: clampedEnterEnd, x: baseX, y: baseY, opacity: 1 },
      );
      break;
  }

  // ---- HOLD phase (middle) ----
  keyframes.push(
    { time: 0.75, x: baseX, y: baseY, opacity: 1, easing: 'easeInOut' },
  );

  // ---- EXIT phase (0.8 → 1.0) ----
  switch (animation.exit || 'fadeOut') {
    case 'slideDown':
      keyframes.push(
        { time: 1.0, x: baseX, y: baseY + 40, opacity: 0 },
      );
      break;
    case 'scaleDown':
      keyframes.push(
        { time: 1.0, x: baseX, y: baseY, opacity: 0, scale: 0.5 },
      );
      break;
    case 'slideLeft':
      keyframes.push(
        { time: 1.0, x: baseX - 40, y: baseY, opacity: 0 },
      );
      break;
    case 'fadeOut':
    case 'none':
    default:
      keyframes.push(
        { time: 1.0, x: baseX, y: baseY, opacity: 0 },
      );
      break;
  }

  return keyframes;
}
