export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function shortestAngleLerp(current: number, target: number, t: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

export function hexToNumber(hex: string, fallback = 0x22d3ee): number {
  const cleaned = hex.replace("#", "").trim();
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}
