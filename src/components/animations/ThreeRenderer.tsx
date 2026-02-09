'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { AnimationData, ThreeElement, CameraKeyframe } from '@/types';
import { interpolate3DKeyframes, interpolateCameraTrack, easeProgress } from '@/lib/keyframes';

interface ThreeRendererProps {
  animationData: AnimationData;
  narration: string;
  animationProgress: number;
  title: string;
  contentType: string;
  transitionState?: 'entering' | 'active' | 'exiting';
}

// ============================================
// Animated Camera (follows CameraKeyframe[] track)
// ============================================

function AnimatedCamera({ cameraTrack, progress }: { cameraTrack: CameraKeyframe[]; progress: number }) {
  const lookAtTarget = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(({ camera }) => {
    const state = interpolateCameraTrack(cameraTrack, progress);
    camera.position.set(state.position[0], state.position[1], state.position[2]);
    lookAtTarget.current.set(state.lookAt[0], state.lookAt[1], state.lookAt[2]);
    camera.lookAt(lookAtTarget.current);
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    if (perspectiveCamera.fov !== state.fov) {
      perspectiveCamera.fov = state.fov;
      perspectiveCamera.updateProjectionMatrix();
    }
  });

  return null;
}

// ============================================
// ThreeShape — renders any geometry with keyframe animation
// ============================================

function ThreeShape({
  element,
  progress,
  index,
  total,
}: {
  element: ThreeElement;
  progress: number;
  index: number;
  total: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  // Progressive reveal: element appears based on progress
  const revealThreshold = total > 1 ? index / total : 0;
  const isVisible = progress > revealThreshold;
  const hasKeyframes = element.keyframes && element.keyframes.length > 0;

  const baseScale = useMemo(() => {
    if (Array.isArray(element.scale) && element.scale.length === 3) {
      return element.scale as [number, number, number];
    }
    if (typeof element.scale === 'number') {
      return element.scale;
    }
    return 1;
  }, [element.scale]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !isVisible) return;

    const localProgress = total > 1
      ? Math.max(0, Math.min(1, (progress - revealThreshold) / (1 / total)))
      : progress;

    if (hasKeyframes && element.keyframes) {
      const state = interpolate3DKeyframes(element.keyframes, localProgress);
      group.position.set(state.position[0], state.position[1], state.position[2]);
      group.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
      group.scale.set(state.scale[0], state.scale[1], state.scale[2]);
      if (materialRef.current) {
        materialRef.current.opacity = state.opacity;
      }
    } else {
      // Smooth enter animation: scale up from 0
      const enterScale = Math.min(1, localProgress * 3);
      const eased = easeProgress(enterScale, 'backOut');
      group.position.set(element.position[0], element.position[1], element.position[2]);
      if (element.rotation) {
        group.rotation.set(element.rotation[0], element.rotation[1], element.rotation[2]);
      }

      if (Array.isArray(baseScale)) {
        group.scale.set(
          baseScale[0] * eased,
          baseScale[1] * eased,
          baseScale[2] * eased
        );
      } else {
        group.scale.setScalar(baseScale * eased);
      }

      if (materialRef.current) {
        materialRef.current.opacity = Math.min(0.95, eased + 0.05);
      }
    }
  });

  // Geometry selection
  const geometry = useMemo(() => {
    switch (element.geometry) {
      case 'box': return <boxGeometry args={[0.8, 0.8, 0.8]} />;
      case 'cylinder': return <cylinderGeometry args={[0.4, 0.4, 1, 32]} />;
      case 'torus': return <torusGeometry args={[0.4, 0.15, 16, 32]} />;
      case 'cone': return <coneGeometry args={[0.5, 1, 32]} />;
      case 'plane': return <planeGeometry args={[1.5, 1.5]} />;
      case 'ring': return <ringGeometry args={[0.3, 0.5, 32]} />;
      case 'dodecahedron': return <dodecahedronGeometry args={[0.5]} />;
      case 'octahedron': return <octahedronGeometry args={[0.5]} />;
      case 'sphere':
      default: return <sphereGeometry args={[0.5, 32, 32]} />;
    }
  }, [element.geometry]);

  // Material selection
  const materialProps = useMemo(() => {
    const base = {
      color: element.color,
      transparent: true,
      opacity: 0.9,
    };
    switch (element.material) {
      case 'wireframe':
        return { ...base, wireframe: true, opacity: 0.7 };
      case 'glass':
        return {
          ...base,
          roughness: 0.05,
          metalness: 0.1,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
          opacity: 0.4,
          envMapIntensity: 2.0,
        };
      case 'toon':
        return { ...base, roughness: 1, metalness: 0 };
      case 'physical':
        return {
          ...base,
          roughness: 0.15,
          metalness: 0.3,
          clearcoat: 0.8,
          clearcoatRoughness: 0.2,
          envMapIntensity: 1.2,
        };
      case 'standard':
      default:
        return {
          ...base,
          roughness: 0.3,
          metalness: 0.2,
          clearcoat: 0.5,
        };
    }
  }, [element.color, element.material]);

  if (!isVisible) return null;

  return (
    <group ref={groupRef}>
      <mesh>
        {geometry}
        <meshPhysicalMaterial ref={materialRef} {...materialProps} />
      </mesh>
      {/* Inner glow sphere */}
      <mesh>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial color={element.color} transparent opacity={isVisible ? 0.06 : 0} />
      </mesh>
      {/* Wireframe overlay */}
      <mesh>
        {geometry}
        <meshBasicMaterial color={element.color} wireframe transparent opacity={0.12} />
      </mesh>
      {/* Label */}
      {element.label && (
        <Text
          position={[
            0,
            0.8,
            0,
          ]}
          fontSize={0.2}
          color="#E2E8F0"
          anchorX="center"
          font={undefined}
        >
          {element.label}
        </Text>
      )}
    </group>
  );
}

// ============================================
// DataDrivenScene — renders ThreeElement[] from AI
// ============================================

function DataDrivenScene({ elements, progress }: { elements: ThreeElement[]; progress: number }) {
  const groupRef = useRef<THREE.Group>(null);

  // Slow auto-rotation when no camera track
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {elements.map((el, i) => (
        <ThreeShape
          key={i}
          element={el}
          progress={progress}
          index={i}
          total={elements.length}
        />
      ))}
    </group>
  );
}

// ============================================
// Legacy Presets (fallback when no threeElements)
// ============================================

function MoleculeVisualization({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  const atoms = useMemo(() => [
    { position: [0, 0, 0] as [number, number, number], color: '#EF4444', size: 0.5, label: 'O' },
    { position: [1.2, 0.8, 0] as [number, number, number], color: '#60A5FA', size: 0.35, label: 'H' },
    { position: [-1.2, 0.8, 0] as [number, number, number], color: '#60A5FA', size: 0.35, label: 'H' },
    { position: [0, -1.2, 0.8] as [number, number, number], color: '#34D399', size: 0.4, label: 'N' },
    { position: [0.8, -1.2, -0.8] as [number, number, number], color: '#FBBF24', size: 0.45, label: 'C' },
  ], []);

  const visibleCount = Math.ceil(progress * atoms.length);

  return (
    <group ref={groupRef}>
      {atoms.slice(0, visibleCount).map((atom, i) => (
        <group key={i}>
          <Float speed={2} floatIntensity={0.3}>
            <mesh position={atom.position}>
              <sphereGeometry args={[atom.size, 32, 32]} />
              <meshPhysicalMaterial
                color={atom.color}
                roughness={0.15}
                metalness={0.3}
                clearcoat={0.8}
                clearcoatRoughness={0.2}
                envMapIntensity={1.2}
              />
            </mesh>
            <mesh position={atom.position}>
              <sphereGeometry args={[atom.size * 1.15, 16, 16]} />
              <meshBasicMaterial color={atom.color} transparent opacity={0.08} />
            </mesh>
          </Float>
          <Text
            position={[atom.position[0], atom.position[1] + atom.size + 0.3, atom.position[2]]}
            fontSize={0.2}
            color="#E2E8F0"
            anchorX="center"
            font={undefined}
          >
            {atom.label}
          </Text>
          {i > 0 && (
            <mesh>
              <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
              <meshStandardMaterial color="rgba(148, 163, 184, 0.6)" metalness={0.4} roughness={0.3} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function GeometricVisualization({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.2;
      groupRef.current.rotation.x += delta * 0.1;
    }
  });

  const shapes = useMemo(() => [
    { position: [0, 0, 0] as [number, number, number], type: 'box', color: '#818CF8' },
    { position: [2, 0, 0] as [number, number, number], type: 'sphere', color: '#34D399' },
    { position: [-2, 0, 0] as [number, number, number], type: 'cone', color: '#A78BFA' },
    { position: [0, 2, 0] as [number, number, number], type: 'torus', color: '#FBBF24' },
  ], []);

  const visibleCount = Math.ceil(progress * shapes.length);

  return (
    <group ref={groupRef}>
      {shapes.slice(0, visibleCount).map((shape, i) => (
        <Float key={i} speed={1.5} floatIntensity={0.2}>
          <mesh position={shape.position}>
            {shape.type === 'box' && <boxGeometry args={[0.8, 0.8, 0.8]} />}
            {shape.type === 'sphere' && <sphereGeometry args={[0.5, 32, 32]} />}
            {shape.type === 'cone' && <coneGeometry args={[0.5, 1, 32]} />}
            {shape.type === 'torus' && <torusGeometry args={[0.4, 0.15, 16, 32]} />}
            <meshPhysicalMaterial
              color={shape.color}
              roughness={0.2}
              metalness={0.3}
              clearcoat={0.6}
              clearcoatRoughness={0.3}
              transparent
              opacity={0.9}
              envMapIntensity={1.0}
            />
          </mesh>
          <mesh position={shape.position}>
            {shape.type === 'box' && <boxGeometry args={[0.82, 0.82, 0.82]} />}
            {shape.type === 'sphere' && <sphereGeometry args={[0.52, 16, 16]} />}
            {shape.type === 'cone' && <coneGeometry args={[0.52, 1.02, 16]} />}
            {shape.type === 'torus' && <torusGeometry args={[0.42, 0.16, 8, 16]} />}
            <meshBasicMaterial color={shape.color} wireframe transparent opacity={0.15} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function DataStructureVisualization({ progress }: { progress: number }) {
  const nodes = useMemo(() => [
    { position: [0, 1.5, 0] as [number, number, number], label: 'Root', color: '#818CF8' },
    { position: [-1.5, 0, 0] as [number, number, number], label: 'L', color: '#34D399' },
    { position: [1.5, 0, 0] as [number, number, number], label: 'R', color: '#34D399' },
    { position: [-2.2, -1.5, 0] as [number, number, number], label: 'LL', color: '#60A5FA' },
    { position: [-0.8, -1.5, 0] as [number, number, number], label: 'LR', color: '#60A5FA' },
    { position: [0.8, -1.5, 0] as [number, number, number], label: 'RL', color: '#60A5FA' },
    { position: [2.2, -1.5, 0] as [number, number, number], label: 'RR', color: '#60A5FA' },
  ], []);

  const edges = useMemo(() => [
    [0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6],
  ], []);

  const visibleNodes = Math.ceil(progress * nodes.length);
  const visibleEdges = Math.ceil(progress * edges.length);

  return (
    <group>
      {edges.slice(0, visibleEdges).map(([from, to], i) => {
        const start = new THREE.Vector3(...nodes[from].position);
        const end = new THREE.Vector3(...nodes[to].position);
        const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
        const length = start.distanceTo(end);
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction
        );

        return (
          <mesh key={`edge-${i}`} position={mid} quaternion={quaternion}>
            <cylinderGeometry args={[0.025, 0.025, length, 8]} />
            <meshStandardMaterial color="#94A3B8" transparent opacity={0.5} metalness={0.3} />
          </mesh>
        );
      })}

      {nodes.slice(0, visibleNodes).map((node, i) => (
        <group key={i} position={node.position}>
          <mesh>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshBasicMaterial color={node.color} transparent opacity={0.08} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.3, 32, 32]} />
            <meshPhysicalMaterial
              color={node.color}
              roughness={0.2}
              metalness={0.3}
              clearcoat={0.6}
              envMapIntensity={1.0}
            />
          </mesh>
          <Text
            position={[0, 0.55, 0]}
            fontSize={0.2}
            color="#E2E8F0"
            anchorX="center"
            font={undefined}
          >
            {node.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ============================================
// Main ThreeRenderer
// ============================================

export default function ThreeRenderer({
  animationData,
  narration,
  animationProgress,
  title,
  contentType,
  transitionState = 'active',
}: ThreeRendererProps) {
  // Check for data-driven scene config
  const threeElements = animationData?.config?.threeElements as ThreeElement[] | undefined;
  const cameraTrack = animationData?.config?.cameraTrack as CameraKeyframe[] | undefined;
  const hasDataDrivenScene = threeElements && threeElements.length > 0;
  const hasCameraTrack = cameraTrack && cameraTrack.length > 0;
  const containerOpacity = transitionState === 'active' ? 1 : 0.85;
  const containerScale = transitionState === 'entering' ? 0.96 : transitionState === 'exiting' ? 1.04 : 1;

  // Apply easing to animation progress for smoother feel
  const easedProgress = easeProgress(animationProgress, 'easeInOut');

  const getVisualization = () => {
    // Data-driven scene takes priority
    if (hasDataDrivenScene) {
      return <DataDrivenScene elements={threeElements!} progress={easedProgress} />;
    }

    // Legacy presets as fallback
    switch (contentType) {
      case 'biological_process':
        return <MoleculeVisualization progress={easedProgress} />;
      case 'algorithm':
        return <DataStructureVisualization progress={easedProgress} />;
      default:
        return <GeometricVisualization progress={easedProgress} />;
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 40%, #1A1A2E 100%)',
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
        transition: 'opacity 0.45s ease, transform 0.6s ease',
      }}
    >
      {/* Subtle star-field overlay */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 0.5px, transparent 0)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow accents */}
      <div
        className="absolute top-[-5%] left-1/3 w-80 h-60 rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #A78BFA, transparent)' }}
      />
      <div
        className="absolute bottom-[-5%] right-1/4 w-60 h-60 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #34D399, transparent)' }}
      />

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-8 py-6">
        <motion.h3
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-2xl font-bold text-white mb-4 tracking-tight"
        >
          {title}
        </motion.h3>

        <div
          className="w-full max-w-2xl aspect-video rounded-xl border border-white/10 overflow-hidden"
          style={{
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
        >
          <Canvas
            camera={{ position: [0, 0, 6], fov: 50 }}
            style={{ background: 'transparent' }}
          >
            <color attach="background" args={['#0F172A']} />
            <fog attach="fog" args={['#0F172A', 8, 18]} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={1.0} color="#E2E8F0" />
            <pointLight position={[-5, -3, -5]} intensity={0.4} color="#818CF8" />
            <pointLight position={[3, -2, 4]} intensity={0.3} color="#34D399" />

            {/* Animated camera when track exists, otherwise manual controls */}
            {hasCameraTrack ? (
              <AnimatedCamera cameraTrack={cameraTrack!} progress={easedProgress} />
            ) : (
              <OrbitControls
                enablePan={false}
                enableZoom={true}
                maxDistance={10}
                minDistance={3}
              />
            )}

            {animationData && getVisualization()}

            {/* Postprocessing effects — cinematic quality */}
            <EffectComposer>
              <Bloom
                intensity={1.5}
                luminanceThreshold={0.8}
                luminanceSmoothing={0.9}
                mipmapBlur
              />
              <DepthOfField
                focusDistance={0}
                focalLength={0.02}
                bokehScale={2}
              />
              <Vignette
                eskil={false}
                offset={0.1}
                darkness={0.6}
              />
            </EffectComposer>
          </Canvas>
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
    </div>
  );
}
