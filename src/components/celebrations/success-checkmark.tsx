"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SuccessCheckmarkProps {
  /** Size of the checkmark in pixels */
  size?: number;
  /** Primary color for the checkmark */
  color?: string;
  /** Background circle color */
  backgroundColor?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Animation duration in milliseconds */
  duration?: number;
  /** Whether to loop the animation */
  loop?: boolean;
  /** Delay before animation starts (ms) */
  delay?: number;
  /** Whether animation is active */
  active?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when animation completes */
  onComplete?: () => void;
}

export function SuccessCheckmark({
  size = 80,
  color = "#10B981",
  backgroundColor = "#ECFDF5",
  strokeWidth = 3,
  duration = 800,
  loop = false,
  delay = 0,
  active = true,
  className,
  onComplete,
}: SuccessCheckmarkProps) {
  const [animationKey, setAnimationKey] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!active) return;

    const delayTimer = setTimeout(() => {
      setIsAnimating(true);
      setAnimationKey((prev) => prev + 1);
    }, delay);

    return () => clearTimeout(delayTimer);
  }, [active, delay]);

  useEffect(() => {
    if (!isAnimating) return;

    const timer = setTimeout(() => {
      if (loop) {
        setAnimationKey((prev) => prev + 1);
      } else {
        onComplete?.();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [isAnimating, duration, loop, animationKey, onComplete]);

  if (!active) return null;

  const circleRadius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * circleRadius;
  const checkmarkPath = `M${size * 0.25} ${size * 0.5} L${size * 0.42} ${size * 0.65} L${size * 0.75} ${size * 0.35}`;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Success checkmark"
    >
      <svg
        key={animationKey}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        <style>
          {`
            @keyframes circle-draw-${animationKey} {
              0% {
                stroke-dashoffset: ${circumference};
              }
              100% {
                stroke-dashoffset: 0;
              }
            }

            @keyframes circle-fill-${animationKey} {
              0% {
                opacity: 0;
                transform: scale(0.8);
              }
              50% {
                opacity: 1;
              }
              100% {
                opacity: 1;
                transform: scale(1);
              }
            }

            @keyframes checkmark-draw-${animationKey} {
              0% {
                stroke-dashoffset: ${size};
              }
              100% {
                stroke-dashoffset: 0;
              }
            }

            @keyframes scale-bounce-${animationKey} {
              0%, 100% {
                transform: rotate(90deg) scale(1);
              }
              50% {
                transform: rotate(90deg) scale(1.1);
              }
            }
          `}
        </style>

        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={circleRadius - strokeWidth}
          fill={backgroundColor}
          style={{
            transformOrigin: "center",
            animation: isAnimating
              ? `circle-fill-${animationKey} ${duration * 0.4}ms ease-out forwards`
              : "none",
            opacity: 0,
          }}
        />

        {/* Circle outline */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={circleRadius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{
            animation: isAnimating
              ? `circle-draw-${animationKey} ${duration * 0.5}ms ease-out forwards`
              : "none",
          }}
        />

        {/* Checkmark */}
        <path
          d={checkmarkPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={size}
          strokeDashoffset={size}
          style={{
            transform: "rotate(90deg)",
            transformOrigin: "center",
            animation: isAnimating
              ? `checkmark-draw-${animationKey} ${duration * 0.4}ms ease-out ${duration * 0.4}ms forwards, scale-bounce-${animationKey} ${duration * 0.3}ms ease-out ${duration * 0.8}ms forwards`
              : "none",
          }}
        />
      </svg>
    </div>
  );
}

// Preset configurations
export const CHECKMARK_PRESETS = {
  small: {
    size: 40,
    strokeWidth: 2,
    duration: 600,
  },
  medium: {
    size: 80,
    strokeWidth: 3,
    duration: 800,
  },
  large: {
    size: 120,
    strokeWidth: 4,
    duration: 1000,
  },
} as const;

export type CheckmarkPreset = keyof typeof CHECKMARK_PRESETS;

// Color variants
export const CHECKMARK_COLORS = {
  success: {
    color: "#10B981",
    backgroundColor: "#ECFDF5",
  },
  primary: {
    color: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  warning: {
    color: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  purple: {
    color: "#8B5CF6",
    backgroundColor: "#F5F3FF",
  },
} as const;

export type CheckmarkColorVariant = keyof typeof CHECKMARK_COLORS;
