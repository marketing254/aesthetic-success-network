"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Animates words (or arbitrary spans) up from below with a stagger.
 * Pass children as a string for word-by-word, or as React nodes for granular control.
 */
export default function KineticText({
  text,
  delay = 0,
  stagger = 0.05,
  duration = 0.8,
  as: Tag = "span",
  highlightWords = [],
  highlightStyle,
  children,
}: {
  text?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  as?: keyof React.JSX.IntrinsicElements;
  highlightWords?: string[];
  highlightStyle?: React.CSSProperties;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const content = text ?? "";
  const words = content.split(" ");

  if (reduced) {
    const El = Tag as "span";
    return <El>{children ?? content}</El>;
  }

  if (children) {
    return (
      <motion.span
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    );
  }

  const Wrapper = Tag as "span";
  return (
    <Wrapper style={{ display: "inline" }}>
      {words.map((word, i) => {
        const isHighlight = highlightWords.includes(word);
        return (
          <span
            key={`${word}-${i}`}
            style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}
          >
            <motion.span
              style={{
                display: "inline-block",
                ...(isHighlight ? highlightStyle : undefined),
              }}
              initial={{ y: "120%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              transition={{
                duration,
                delay: delay + i * stagger,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        );
      })}
    </Wrapper>
  );
}
