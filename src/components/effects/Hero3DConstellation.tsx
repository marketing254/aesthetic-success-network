"use client";
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A slow-rotating 3D constellation of connected nodes — visually evokes
 * "network of practice owners" without being literal.
 *
 *   • 64 points arranged on a Fibonacci sphere (even distribution, no
 *     visual clumping, looks intentional rather than random).
 *   • Each node = a tiny soft-gold sphere with gentle emissive glow.
 *   • Lines connect each node to its three nearest neighbours, drawn once
 *     at mount so we're not regenerating geometry per frame.
 *   • The whole group rotates slowly around Y; the nodes pulse on an
 *     ambient sine so the constellation feels alive.
 *
 * Calm, premium, network-themed. The kind of background you see on a
 * Stripe or Linear hero — not the kind that competes with the headline.
 *
 * SSR-safe — dynamic-import this from the page with `ssr: false`.
 */
export default function Hero3DConstellation() {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 5.5], fov: 55 }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <color attach="background" args={["#00000000"]} />
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}

const NODE_COUNT = 64;
const NEIGHBOURS_PER_NODE = 3;
const SPHERE_RADIUS = 2.6;

// Brand palette — keep this in lockstep with the hero gradient so the
// constellation reads as "part of the page" not "an overlay".
const NODE_COLOR = "#C9A876"; // soft gold
const NODE_EMISSIVE = "#9B7B3A"; // deeper bronze glow
const LINE_COLOR = new THREE.Color("#C9A876");

function SceneContent() {
  const groupRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.Group>(null);

  // Pre-compute node positions via Fibonacci sphere — uniform spread, no
  // clumps. golden-angle = π * (3 − √5).
  const positions = useMemo(() => {
    const out: THREE.Vector3[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      out.push(
        new THREE.Vector3(
          Math.cos(theta) * r * SPHERE_RADIUS,
          y * SPHERE_RADIUS,
          Math.sin(theta) * r * SPHERE_RADIUS,
        ),
      );
    }
    return out;
  }, []);

  // Pre-compute neighbour edges: for each node, connect it to its N nearest
  // neighbours. Dedup by sorting the (a,b) pair so we don't draw the same
  // line twice. The result is a static line-segment list that we render once.
  const linePositions = useMemo(() => {
    const edges = new Set<string>();
    for (let i = 0; i < positions.length; i++) {
      // Score every other node by distance, pick the closest N.
      const sorted = positions
        .map((p, j) => ({ j, d: i === j ? Infinity : positions[i]!.distanceTo(p) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, NEIGHBOURS_PER_NODE);
      for (const { j } of sorted) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        edges.add(key);
      }
    }
    const buf = new Float32Array(edges.size * 6);
    let offset = 0;
    for (const key of edges) {
      const [a, b] = key.split("-").map(Number) as [number, number];
      const p0 = positions[a]!;
      const p1 = positions[b]!;
      buf[offset++] = p0.x;
      buf[offset++] = p0.y;
      buf[offset++] = p0.z;
      buf[offset++] = p1.x;
      buf[offset++] = p1.y;
      buf[offset++] = p1.z;
    }
    return buf;
  }, [positions]);

  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    return g;
  }, [linePositions]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      // Slow continuous rotation — keep the spin gentle so it never reads
      // as "spinning", just "alive".
      groupRef.current.rotation.y = t * 0.06;
      groupRef.current.rotation.x = Math.sin(t * 0.08) * 0.08;
    }
    // Soft global pulse on the nodes (scale only). One uniform multiplier
    // keeps the constellation reading as a single object instead of 64
    // independent specks.
    if (nodesRef.current) {
      const pulse = 1 + Math.sin(t * 1.2) * 0.06;
      nodesRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <>
      {/* Soft warm key + cool fill — keeps the gold from going flat without
          introducing a specular highlight that would compete with the text. */}
      <ambientLight intensity={0.9} color="#FBF5E5" />
      <directionalLight position={[3, 4, 5]} intensity={1.2} color="#E8D5A8" />
      <directionalLight position={[-4, -2, 3]} intensity={0.5} color="#A3B5C8" />

      <group ref={groupRef}>
        {/* Connection lines — drawn first so the nodes sit on top */}
        <lineSegments geometry={lineGeom}>
          <lineBasicMaterial
            color={LINE_COLOR}
            transparent
            opacity={0.22}
            depthWrite={false}
          />
        </lineSegments>

        {/* Nodes */}
        <group ref={nodesRef}>
          {positions.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.05, 14, 14]} />
              <meshStandardMaterial
                color={NODE_COLOR}
                emissive={NODE_EMISSIVE}
                emissiveIntensity={0.45}
                metalness={0.4}
                roughness={0.45}
              />
            </mesh>
          ))}
        </group>
      </group>
    </>
  );
}
