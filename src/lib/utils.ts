import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(n: number, digits = 1) {
  return n.toFixed(digits);
}

export function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}
