import type { RoundModifier, WeaponType } from "@shared/types";

export interface TankColorOption {
  name: string;
  hex: string;
  glow: string;
}

export const NEON_COLORS: TankColorOption[] = [
  { name: "Cian Táctico", hex: "#22D3EE", glow: "rgba(34, 211, 238, 0.55)" },
  { name: "Fucsia", hex: "#EC4899", glow: "rgba(236, 72, 153, 0.55)" },
  { name: "Verde Lima", hex: "#A3E635", glow: "rgba(163, 230, 53, 0.55)" },
  { name: "Oro Solar", hex: "#F59E0B", glow: "rgba(245, 158, 11, 0.55)" },
];

export const WEAPON_META: Record<
  WeaponType,
  { label: string; badgeColor: string; shortStats: string }
> = {
  pistol: {
    label: "Pistola",
    badgeColor: "#94A3B8",
    shortStats: "15 DMG · Equilibrada",
  },
  shotgun: {
    label: "Escopeta",
    badgeColor: "#F97316",
    shortStats: "5x12 DMG · Corto alcance",
  },
  rifle: {
    label: "Rifle de Asalto",
    badgeColor: "#38BDF8",
    shortStats: "14 DMG · Ráfaga rápida",
  },
  sniper: {
    label: "Francotirador",
    badgeColor: "#C084FC",
    shortStats: "65 DMG · Largo alcance",
  },
};

export const MODIFIER_META: Record<
  RoundModifier,
  { label: string; desc: string; pillClass: string }
> = {
  normal: {
    label: "Ronda Clásica",
    desc: "Reglas estándar de combate",
    pillClass: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  },
  speed_boost: {
    label: "⚡ Velocidad x1.4",
    desc: "Todos los jugadores corren un 40% más rápido",
    pillClass: "border-cyan-400/50 bg-cyan-500/20 text-cyan-200",
  },
  ricochet: {
    label: "🪃 Balas Rebotadoras",
    desc: "Los disparos rebotan hasta 2 veces en rocas y bordes",
    pillClass: "border-amber-400/50 bg-amber-500/20 text-amber-200",
  },
  vampire: {
    label: "🧛 Vampiro",
    desc: "Eliminar a un rival cura +25 HP",
    pillClass: "border-rose-400/50 bg-rose-500/20 text-rose-200",
  },
  double_damage: {
    label: "💥 Doble Daño",
    desc: "Todas las armas infligen x2 de daño",
    pillClass: "border-purple-400/50 bg-purple-500/20 text-purple-200",
  },
};

export const MAX_SCORE_TO_WIN = 5;
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "/api";
export const NICKNAME_STORAGE_KEY = "bala_perdida_nickname";
export const COLOR_STORAGE_KEY = "bala_perdida_color";
