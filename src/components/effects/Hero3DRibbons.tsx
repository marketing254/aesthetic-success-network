"use client";
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Flowing 3D ribbon curves — a calmer alternative to the floating-primitives
 * scene. Each ribbon is a `TubeGeometry` built from an animated cubic-bezier
 * curve in 3D space. The control points drift on independent sine waves so
 * the ribbons appear to "draw themselves" continuously, like ink trails on
 * a page that never settle.
 *
 * Palette: champagne / cream / soft-gold to match the hero's warm background.
 * Lighting is intentionally soft so the ribbons read as flat-ish gradient
 * surfaces (not metal) — no harsh specular highlights to compete with the
 * headline.
 *
 * SSR-safe: dynamic-import this from the page with `ssr: false`.
 */
export default function Hero3DRibbons() {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 6], fov: 55 }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <color attach="background" args={["#00000000"]} />
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}

type RibbonSpec = {
  // Base anchor points for the cubic curve.
  p0: [number, number, number];
  p1: [number, number, number];
  p2: [number, number, number];
  p3: [number, number, number];
  // Per-control-point drift amplitudes + frequencies. Independent values per
  // ribbon make the ensemble feel alive instead of synchronised.
  drift: number;
  freq: number;
  phase: number;
  // Visual.
  color: string;
  radius: number;
  segments: number;
};

const RIBBONS: RibbonSpec[] = [
  // Wide gold ribbon arcing through the centre — the hero curve.
  {
    p0: [-3.2, -1.2, -0.4],
    p1: [-1.4, 1.4, 0.6],
    p2: [1.3, -0.9, -0.2],
    p3: [3.3, 1.0, 0.4],
    drift: 0.55,
    freq: 0.35,
    phase: 0,
    color: "#C9A876",
    radius: 0.06,
    segments: 96,
  },
  // Cream secondary ribbon swooping below, slightly thinner.
  {
    p0: [-3.4, 0.9, 0.3],
    p1: [-1.0, -1.4, -0.5],
    p2: [1.2, 1.0, 0.4],
    p3: [3.2, -1.0, -0.3],
    drift: 0.45,
    freq: 0.42,
    phase: Math.PI * 0.6,
    color: "#E8D5A8",
    radius: 0.045,
    segments: 96,
  },
  // Deep-bronze accent ribbon, smaller and tighter — adds depth contrast.
  {
    p0: [-2.6, 0.2, -0.6],
    p1: [-0.6, 1.1, 0.2],
    p2: [0.9, -0.4, -0.4],
    p3: [2.6, 0.6, 0.5],
    drift: 0.4,
    freq: 0.5,
    phase: Math.PI,
    color: "#9B7B3A",
    radius: 0.035,
    segments: 80,
  },
  // Whisper-thin pale ribbon weaving through the top — sparkle layer.
  {
    p0: [-3.0, 1.6, 0.5],
    p1: [-0.4, 0.4, -0.3],
    p2: [1.6, 1.6, 0.4],
    p3: [3.4, 0.4, -0.4],
    drift: 0.35,
    freq: 0.6,
    phase: Math.PI * 1.3,
    color: "#F5E5C8",
    radius: 0.025,
    segments: 80,
  },
];

function SceneContent() {
  return (
    <group>
      {/* Warm key light from the upper-left, cool fill from below-right.
          Keeps the ribbons from going flat without overpowering the cream. */}
      <ambientLight intensity={0.85} color="#FBF5E5" />
      <directionalLight position={[-4, 3, 3]} intensity={1.6} color="#E8D5A8" />
      <directionalLight position={[3, -2, 2]} intensity={0.9} color="#A3B5C8" />

      {RIBBONS.map((r, i) => (
        <Ribbon key={i} spec={r} />
      ))}

      {/* A few drifting motes to give a sense of scale + air. */}
      <Motes />
    </group>
  );
}

function Ribbon({ spec }: { spec: RibbonSpec }) {
  const meshRef = useRef<THREE.Mesh>(null);
  // Pre-allocate the four point Vector3s — useFrame will mutate them in place
  // so we don't allocate per-frame.
  const points = useMemo(
    () => [
      new THREE.Vector3(...spec.p0),
      new THREE.Vector3(...spec.p1),
      new THREE.Vector3(...spec.p2),
      new THREE.Vector3(...spec.p3),
    ],
    [spec.p0, spec.p1, spec.p2, spec.p3],
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime * spec.freq + spec.phase;
    const d = spec.drift;

    // Anchor the endpoints — only the two middle control points sway, so the
    // overall path stays anchored at the edges of the visible volume.
    points[1]!.x = spec.p1[0] + Math.sin(t * 1.1) * d;
    points[1]!.y = spec.p1[1] + Math.cos(t * 0.9) * d;
    points[1]!.z = spec.p1[2] + Math.sin(t * 0.7) * d * 0.4;
    points[2]!.x = spec.p2[0] + Math.cos(t * 1.0) * d;
    points[2]!.y = spec.p2[1] + Math.sin(t * 1.2) * d;
    points[2]!.z = spec.p2[2] + Math.cos(t * 0.6) * d * 0.4;

    const curve = new THREE.CubicBezierCurve3(
      points[0]!,
      points[1]!,
      points[2]!,
      points[3]!,
    );
    const next = new THREE.TubeGeometry(
      curve,
      spec.segments,
      spec.radius,
      10,
      false,
    );
    // Swap the geometry — three.js disposes the previous one safely when we
    // assign a new buffer geometry to the mesh.
    meshRef.current.geometry.dispose();
    meshRef.current.geometry = next;
  });

  // Initial geometry — replaced on first frame, but needed so the mesh has
  // something to mount with.
  const initialGeom = useMemo(() => {
    const curve = new THREE.CubicBezierCurve3(
      points[0]!,
      points[1]!,
      points[2]!,
      points[3]!,
    );
    return new THREE.TubeGeometry(curve, spec.segments, spec.radius, 10, false);
  }, [points, spec.segments, spec.radius]);

  return (
    <mesh ref={meshRef} geometry={initialGeom}>
      <meshStandardMaterial
        color={spec.color}
        emissive={spec.color}
        emissiveIntensity={0.18}
        metalness={0.35}
        roughness={0.55}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

function Motes() {
  const groupRef = useRef<THREE.Group>(null);

  // Six drifting motes at varied depths.
  const motes = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        base: [
          -2.5 + (i / 6) * 5,
          Math.sin(i * 1.7) * 1.4,
          -0.8 + (i % 3) * 0.6,
        ] as [number, number, number],
        speed: 0.2 + (i % 3) * 0.07,
        phase: i * 0.9,
        scale: 0.035 + ((i * 7) % 4) * 0.012,
      })),
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const m = motes[i]!;
      child.position.x = m.base[0] + Math.sin(t * m.speed + m.phase) * 0.35;
      child.position.y = m.base[1] + Math.cos(t * m.speed * 0.8 + m.phase) * 0.3;
      child.position.z = m.base[2] + Math.sin(t * m.speed * 0.5 + m.phase) * 0.2;
    });
  });

  return (
    <group ref={groupRef}>
      {motes.map((m, i) => (
        <mesh key={i} position={m.base} scale={m.scale}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial
            color="#F5E5C8"
            emissive="#D4B07A"
            emissiveIntensity={0.5}
            transparent
            opacity={0.75}
          />
        </mesh>
      ))}
    </group>
  );
}
