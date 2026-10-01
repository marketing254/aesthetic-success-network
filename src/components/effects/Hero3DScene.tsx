"use client";
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

/**
 * Minimalist 3D constellation — a small arrangement of geometric primitives
 * (rounded cubes, spheres, hexagons, plates) orbiting in a soft champagne
 * palette. No HDR environment, no fetch-from-CDN, fully offline-safe.
 *
 * Reads as a "network of objects" rather than one big sculpture. Suitable
 * background depth element for the hero — calm, modern, never distracting.
 */
export default function Hero3DScene() {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 9], fov: 50 }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
    >
      <color attach="background" args={["#00000000"]} />
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}

// 7 floating primitives — each gets its own orbit, scale, and material tint.
type Primitive = {
  kind: "sphere" | "box" | "octahedron" | "tetrahedron";
  position: [number, number, number];
  scale: number;
  color: string;
  emissive: string;
  metalness: number;
  roughness: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitOffset: number;
};

// Larger constellation now — 9 primitives spread across a wider arena so the
// scene is visible across the entire hero (not hidden behind the launch card).
const PRIMITIVES: Primitive[] = [
  // Central gold sphere — the "you" anchor (only slightly off-center)
  {
    kind: "sphere",
    position: [0, 0, 0],
    scale: 0.6,
    color: "#D4B07A",
    emissive: "#9B7B3A",
    metalness: 0.7,
    roughness: 0.25,
    orbitRadius: 0,
    orbitSpeed: 0,
    orbitOffset: 0,
  },
  // FAR LEFT — cream octahedron
  {
    kind: "octahedron",
    position: [-3.4, 1.2, -0.6],
    scale: 0.4,
    color: "#FBF5E5",
    emissive: "#D4B07A",
    metalness: 0.5,
    roughness: 0.4,
    orbitRadius: 3.6,
    orbitSpeed: 0.18,
    orbitOffset: Math.PI,
  },
  // Mid-left — bronze tetrahedron
  {
    kind: "tetrahedron",
    position: [-2.4, -1.1, 0.3],
    scale: 0.42,
    color: "#9B7B3A",
    emissive: "#7A5F2A",
    metalness: 0.75,
    roughness: 0.28,
    orbitRadius: 2.7,
    orbitSpeed: 0.22,
    orbitOffset: Math.PI * 1.2,
  },
  // Lower-left — small cream sphere
  {
    kind: "sphere",
    position: [-1.6, -1.4, -0.5],
    scale: 0.22,
    color: "#FBF5E5",
    emissive: "#FBF5E5",
    metalness: 0.3,
    roughness: 0.5,
    orbitRadius: 2.1,
    orbitSpeed: 0.28,
    orbitOffset: -Math.PI * 0.55,
  },
  // Upper-mid — champagne cube
  {
    kind: "box",
    position: [-0.8, 1.6, -0.8],
    scale: 0.32,
    color: "#E8D5A8",
    emissive: "#C9A876",
    metalness: 0.5,
    roughness: 0.3,
    orbitRadius: 1.8,
    orbitSpeed: 0.25,
    orbitOffset: Math.PI * 0.6,
  },
  // Lower-right — soft cream octahedron
  {
    kind: "octahedron",
    position: [1.7, -1.0, 0.4],
    scale: 0.38,
    color: "#FBF5E5",
    emissive: "#D4B07A",
    metalness: 0.4,
    roughness: 0.4,
    orbitRadius: 1.9,
    orbitSpeed: 0.2,
    orbitOffset: Math.PI / 2,
  },
  // FAR RIGHT — bronze cube
  {
    kind: "box",
    position: [3.2, 0.3, -0.4],
    scale: 0.28,
    color: "#C9A876",
    emissive: "#9B7B3A",
    metalness: 0.6,
    roughness: 0.35,
    orbitRadius: 3.4,
    orbitSpeed: 0.15,
    orbitOffset: 0,
  },
  // Upper-right — distant champagne tetrahedron
  {
    kind: "tetrahedron",
    position: [2.6, 1.7, -0.7],
    scale: 0.24,
    color: "#F5E5C8",
    emissive: "#D4B07A",
    metalness: 0.5,
    roughness: 0.4,
    orbitRadius: 3.0,
    orbitSpeed: 0.16,
    orbitOffset: -Math.PI / 4,
  },
  // Distant top — small bronze octahedron
  {
    kind: "octahedron",
    position: [0.2, 2.2, -1.0],
    scale: 0.2,
    color: "#9B7B3A",
    emissive: "#7A5F2A",
    metalness: 0.65,
    roughness: 0.3,
    orbitRadius: 2.4,
    orbitSpeed: 0.3,
    orbitOffset: -Math.PI * 0.85,
  },
];

function SceneContent() {
  const groupRef = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.y = t * 0.08 + mouse.x * 0.18;
    groupRef.current.rotation.x = mouse.y * -0.1 + Math.sin(t * 0.2) * 0.03;
  });

  return (
    <group ref={groupRef}>
      {/* Lighting — warm champagne key + cool fill + rim from behind */}
      <ambientLight intensity={0.6} color="#F5F0E5" />
      <directionalLight position={[5, 4, 4]} intensity={2.4} color="#E8D5A8" />
      <directionalLight position={[-4, -3, 3]} intensity={1.1} color="#A3B5C8" />
      <directionalLight position={[0, -2, -5]} intensity={1.4} color="#D4B07A" />

      {/* Primitives */}
      {PRIMITIVES.map((p, i) => (
        <FloatingPrimitive key={i} {...p} />
      ))}

      {/* Connecting lines from the center sphere to each orbiter */}
      <ConnectingLines />
    </group>
  );
}

function FloatingPrimitive({
  kind,
  position,
  scale,
  color,
  emissive,
  metalness,
  roughness,
  orbitRadius,
  orbitSpeed,
  orbitOffset,
}: Primitive) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current || orbitRadius === 0) return;
    const t = state.clock.elapsedTime;
    const a = t * orbitSpeed + orbitOffset;
    // Wide horizontal orbit + gentle vertical sway so primitives sweep across
    // the full hero rather than clustering near center.
    meshRef.current.position.x = Math.cos(a) * orbitRadius * 1.15;
    meshRef.current.position.y = Math.sin(a) * orbitRadius * 0.55;
    meshRef.current.position.z = Math.sin(a * 0.5) * 0.7;
    meshRef.current.rotation.x = t * 0.3 + orbitOffset;
    meshRef.current.rotation.y = t * 0.2 + orbitOffset;
  });

  const geometry = useMemo(() => {
    switch (kind) {
      case "sphere":
        return <sphereGeometry args={[scale, 32, 32]} />;
      case "box":
        return <boxGeometry args={[scale, scale, scale]} />;
      case "octahedron":
        return <octahedronGeometry args={[scale, 0]} />;
      case "tetrahedron":
        return <tetrahedronGeometry args={[scale, 0]} />;
    }
  }, [kind, scale]);

  return (
    <Float speed={1} rotationIntensity={0.4} floatIntensity={0.4}>
      <mesh ref={meshRef} position={position} castShadow>
        {geometry}
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.18}
          metalness={metalness}
          roughness={roughness}
        />
      </mesh>
    </Float>
  );
}

function ConnectingLines() {
  const lineGeometry = useMemo(() => {
    // Connect center to each orbital primitive (skip the center itself at index 0)
    const points: number[] = [];
    PRIMITIVES.slice(1).forEach((p) => {
      points.push(0, 0, 0, p.position[0], p.position[1], p.position[2]);
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(points), 3),
    );
    return geom;
  }, []);

  return (
    <lineSegments geometry={lineGeometry}>
      <lineBasicMaterial
        color="#C9A876"
        transparent
        opacity={0.18}
        depthWrite={false}
      />
    </lineSegments>
  );
}
