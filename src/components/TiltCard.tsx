"use client";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode, type CSSProperties } from "react";

type Props = {
  children: ReactNode;
  intensity?: number;
  style?: CSSProperties;
  className?: string;
};

const SPRING = { stiffness: 200, damping: 22, mass: 0.5 };

export default function TiltCard({ children, intensity = 8, style, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [intensity, -intensity]), SPRING);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-intensity, intensity]), SPRING);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        transformPerspective: 1200,
        ...style,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
