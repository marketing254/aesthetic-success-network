"use client";
import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import * as THREE from "three";

/**
 * Premium hero 3D — a soft, slowly-rotating glass-like orb with subtle
 * distortion + sparkle particles surrounding it.
 *
 * Built on `@react-three/fiber` + `@react-three/drei` (both already
 * installed). Tuned for a calm, agency-grade hero element:
 *   • MeshDistortMaterial gives the surface a "liquid mercury / brass"
 *     feel that breathes instead of looking like a static sphere.
 *   • Float component sways the orb up and down gently.
 *   • Sparkles drop ~40 glowing motes around it for depth.
 *   • Environment preset adds soft IBL lighting so the metal reads
 *     as premium even with no other light sources in the scene.
 *
 * Renders inside a contained container — no full-bleed background, so
 * it cannot ever overlap the headline. The page layout (hero column on
 * left, this scene on right) keeps separation crisp.
 */
export default function HeroOrb() {
  return (
    <Canvas
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 4], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#00000000"]} />
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}

function SceneContent() {
  return (
    <>
      {/* Manual three-point lighting — drei's <Environment preset="studio">
          tries to fetch a 1MB HDR from a CDN at runtime and dies if that
          fetch fails (offline, CSP, CDN blip). Hand-placed lights give us
          the same premium feel deterministically, with zero network cost. */}

      {/* Warm key from the upper-right — picks up brass tones on the
          highlight side */}
      <directionalLight position={[5, 4, 3]} intensity={2.4} color="#F0DCA8" />
      {/* Cool fill from the lower-left so shadows don't go muddy */}
      <directionalLight position={[-4, -2, 4]} intensity={1.1} color="#B0C4D8" />
      {/* Rim light from behind to define the silhouette edge */}
      <directionalLight position={[0, 2, -4]} intensity={1.6} color="#D9A84B" />
      {/* Ambient base so nothing falls fully into black */}
      <ambientLight intensity={0.55} color="#FBF5E5" />

      {/* The orb itself — Float adds gentle vertical breathing */}
      <Float
        speed={1.1}
        rotationIntensity={0.4}
        floatIntensity={0.45}
        floatingRange={[-0.08, 0.08]}
      >
        <SpinningOrb />
      </Float>

      {/* Sparkle motes orbiting the orb */}
      <Sparkles
        count={48}
        scale={3.6}
        size={3.2}
        speed={0.32}
        opacity={0.85}
        color="#F0C16E"
      />
    </>
  );
}

function SpinningOrb() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    // Two-axis rotation at different speeds so the surface never looks
    // like it's "spinning on a turntable" — it tumbles slowly instead.
    meshRef.current.rotation.x = t * 0.08;
    meshRef.current.rotation.y = t * 0.12;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.25, 96, 96]} />
      <MeshDistortMaterial
        // Tuned for direct-light shading (no env map). Lower metalness
        // lets the champagne base color come through; moderate roughness
        // gives the surface a soft brass feel rather than a mirror finish.
        color="#D4B07A"
        emissive="#9B7B3A"
        emissiveIntensity={0.18}
        metalness={0.55}
        roughness={0.3}
        distort={0.32}
        speed={1.6}
      />
    </mesh>
  );
}
