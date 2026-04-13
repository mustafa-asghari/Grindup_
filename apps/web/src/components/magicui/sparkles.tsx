"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface SparklesProps {
  className?: string;
  size?: number;
  minSize?: number | null;
  density?: number;
  speed?: number;
  minSpeed?: number | null;
  opacity?: number;
  direction?:
    | "none"
    | "up"
    | "down"
    | "left"
    | "right"
    | "diagonal-up"
    | "diagonal-down";
  opacitySpeed?: number;
  minOpacity?: number | null;
  color?: string;
  mousemove?: boolean;
  hover?: boolean;
  background?: string;
  options?: Record<string, unknown>;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  opacitySpeed: number;
}

export function SparklesCore({
  className,
  size = 1,
  minSize = null,
  density = 800,
  speed = 1,
  minSpeed = null,
  opacity = 1,
  direction = "none",
  opacitySpeed = 3,
  minOpacity = null,
  color = "#FFF",
  hover = true,
  background = "transparent",
}: SparklesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const particleCount = Math.floor(
      (dimensions.width * dimensions.height) / (10000 / (density / 100))
    );

    const newParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const particleSize = minSize
        ? Math.random() * (size - minSize) + minSize
        : size;
      const particleSpeed = minSpeed
        ? Math.random() * (speed - minSpeed) + minSpeed
        : speed;
      const particleOpacity = minOpacity
        ? Math.random() * (opacity - minOpacity) + minOpacity
        : opacity;

      let speedX = 0;
      let speedY = 0;

      switch (direction) {
        case "up":
          speedY = -particleSpeed * 0.3;
          break;
        case "down":
          speedY = particleSpeed * 0.3;
          break;
        case "left":
          speedX = -particleSpeed * 0.3;
          break;
        case "right":
          speedX = particleSpeed * 0.3;
          break;
        case "diagonal-up":
          speedX = particleSpeed * 0.2;
          speedY = -particleSpeed * 0.2;
          break;
        case "diagonal-down":
          speedX = particleSpeed * 0.2;
          speedY = particleSpeed * 0.2;
          break;
        default:
          speedX = (Math.random() - 0.5) * particleSpeed * 0.3;
          speedY = (Math.random() - 0.5) * particleSpeed * 0.3;
      }

      newParticles.push({
        id: i,
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        size: particleSize,
        speedX,
        speedY,
        opacity: particleOpacity,
        opacitySpeed: (Math.random() * opacitySpeed + 1) * 0.001,
      });
    }

    setParticles(newParticles);
  }, [
    dimensions,
    density,
    size,
    minSize,
    speed,
    minSpeed,
    opacity,
    minOpacity,
    direction,
    opacitySpeed,
  ]);

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden",
        className
      )}
      style={{ background }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full animate-pulse"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: color,
            opacity: particle.opacity,
            animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes twinkle {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
