export interface TankColorOption {
  name: string;
  hex: string;
  glow: string;
}

export const NEON_COLORS: TankColorOption[] = [
  { name: "Cian Neón", hex: "#22D3EE", glow: "rgba(34, 211, 238, 0.55)" },
  { name: "Magenta", hex: "#EC4899", glow: "rgba(236, 72, 153, 0.55)" },
  { name: "Lima Ácido", hex: "#A3E635", glow: "rgba(163, 230, 53, 0.55)" },
  { name: "Ámbar Solar", hex: "#F59E0B", glow: "rgba(245, 158, 11, 0.55)" },
];

export const MAX_SCORE_TO_WIN = 5;
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "ws://localhost:2567";
export const NICKNAME_STORAGE_KEY = "bala_perdida_nickname";
export const COLOR_STORAGE_KEY = "bala_perdida_color";
