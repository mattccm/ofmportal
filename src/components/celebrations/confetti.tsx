"use client";

import * as React from "react";
import { useEffect, useRef, useCallback } from "react";

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  opacity: number;
  decay: number;
}

interface ConfettiProps {
  /** Whether confetti is active */
  active?: boolean;
  /** Number of confetti pieces (intensity) */
  count?: number;
  /** Duration in milliseconds before auto-cleanup */
  duration?: number;
  /** Custom colors array */
  colors?: string[];
  /** Gravity strength */
  gravity?: number;
  /** Initial velocity range */
  velocity?: { min: number; max: number };
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Z-index for the canvas */
  zIndex?: number;
}

const DEFAULT_COLORS = [
  "#FF6B6B", // coral red
  "#4ECDC4", // teal
  "#FFE66D", // yellow
  "#95E1D3", // mint
  "#F38181", // salmon
  "#AA96DA", // lavender
  "#FCBAD3", // pink
  "#A8D8EA", // sky blue
];

export function Confetti({
  active = true,
  count = 150,
  duration = 4000,
  colors = DEFAULT_COLORS,
  gravity = 0.3,
  velocity = { min: 8, max: 15 },
  onComplete,
  zIndex = 9999,
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const piecesRef = useRef<ConfettiPiece[]>([]);
  const startTimeRef = useRef<number>(0);

  const createPiece = useCallback(
    (canvasWidth: number, canvasHeight: number): ConfettiPiece => {
      const angle = Math.random() * Math.PI * 2;
      const speed = velocity.min + Math.random() * (velocity.max - velocity.min);

      return {
        x: canvasWidth / 2 + (Math.random() - 0.5) * canvasWidth * 0.3,
        y: canvasHeight * 0.4,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: -Math.abs(Math.sin(angle) * speed) - Math.random() * 5,
        width: 8 + Math.random() * 6,
        height: 6 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        gravity,
        opacity: 1,
        decay: 0.0005 + Math.random() * 0.001,
      };
    },
    [colors, gravity, velocity]
  );

  const initConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    piecesRef.current = Array.from({ length: count }, () =>
      createPiece(canvas.width, canvas.height)
    );
    startTimeRef.current = Date.now();
  }, [count, createPiece]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const elapsed = Date.now() - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);

    let activePieces = 0;

    piecesRef.current.forEach((piece) => {
      // Update physics
      piece.vy += piece.gravity;
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.rotation += piece.rotationSpeed;
      piece.vx *= 0.99; // Air resistance

      // Fade out near the end
      if (progress > 0.6) {
        piece.opacity -= piece.decay * 10;
      }

      // Skip if off-screen or fully transparent
      if (
        piece.y > canvas.height + 50 ||
        piece.x < -50 ||
        piece.x > canvas.width + 50 ||
        piece.opacity <= 0
      ) {
        return;
      }

      activePieces++;

      // Draw confetti piece
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rotation);
      ctx.globalAlpha = Math.max(0, piece.opacity);
      ctx.fillStyle = piece.color;

      // Draw rectangle confetti
      ctx.fillRect(
        -piece.width / 2,
        -piece.height / 2,
        piece.width,
        piece.height
      );

      ctx.restore();
    });

    // Continue animation if there are active pieces and within duration
    if (activePieces > 0 && elapsed < duration + 2000) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Animation complete
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onComplete?.();
    }
  }, [duration, onComplete]);

  useEffect(() => {
    if (!active) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    initConfetti();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active, initConfetti, animate]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex }}
      aria-hidden="true"
    />
  );
}

// Export preset configurations for different celebration intensities
export const CONFETTI_PRESETS = {
  subtle: {
    count: 50,
    duration: 2500,
    gravity: 0.2,
    velocity: { min: 5, max: 10 },
  },
  normal: {
    count: 150,
    duration: 4000,
    gravity: 0.3,
    velocity: { min: 8, max: 15 },
  },
  intense: {
    count: 300,
    duration: 5000,
    gravity: 0.35,
    velocity: { min: 10, max: 20 },
  },
  epic: {
    count: 500,
    duration: 6000,
    gravity: 0.4,
    velocity: { min: 12, max: 25 },
  },
} as const;

export type ConfettiPreset = keyof typeof CONFETTI_PRESETS;
