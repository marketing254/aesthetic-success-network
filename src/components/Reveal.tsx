"use client";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  once?: boolean;
  style?: CSSProperties;
  className?: string;
};

export default function Reveal({
  children,
  delay = 0,
  y = 24,
  once = true,
  style,
  className,
}: RevealProps) {
  const reduced = useReducedMotion();

  const variants: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : y },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
      variants={variants}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}
