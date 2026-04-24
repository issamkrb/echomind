"use client";

import { cn } from "@/lib/utils";

/**
 * The signature element of the "warm" side. Breathes at roughly
 * 6 breaths per minute — the clinical pace recommended for anxiety
 * reduction. This is not a coincidence: Calm, Headspace, and every
 * wellness product uses exactly this pace to induce trust.
 */
export function BreathingOrb({
  size = 280,
  intensity = 1,
  className,
}: {
  size?: number;
  intensity?: number; // 0..1, pulses slightly faster when Echo is "speaking"
  className?: string;
}) {
  const duration = 8 - intensity * 2; // 8s rest → 6s speaking
  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size * 1.8, height: size * 1.8 }}
    >
      <div
        className="absolute inset-0 rounded-full orb-glow animate-breathe"
        style={{ animationDuration: `${duration}s` }}
        aria-hidden
      />
      <div
        className="rounded-full orb-core animate-breathe"
        style={{
          width: size,
          height: size,
          animationDuration: `${duration}s`,
        }}
        aria-hidden
      />
    </div>
  );
}
