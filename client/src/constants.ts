import type { ArenaTheme, RoundModifier, WeaponType } from "@shared/types";

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
  { name: "Violeta", hex: "#8B5CF6", glow: "rgba(139, 92, 246, 0.55)" },
  { name: "Carmesí", hex: "#EF4444", glow: "rgba(239, 68, 68, 0.55)" },
];

export const WEAPON_META: Record<
  WeaponType,
  { label: string; short: string; badgeColor: number; badgeHex: string; shortStats: string }
> = {
  pistol: {
    label: "Pistola",
    short: "PIS",
    badgeColor: 0x94a3b8,
    badgeHex: "#94A3B8",
    shortStats: "15 DMG · Equilibrada",
  },
  smg: {
    label: "Subfusil",
    short: "SMG",
    badgeColor: 0xfacc15,
    badgeHex: "#FACC15",
    shortStats: "9 DMG · Cadencia altísima",
  },
  shotgun: {
    label: "Escopeta",
    short: "ESC",
    badgeColor: 0xf97316,
    badgeHex: "#F97316",
    shortStats: "5x12 DMG · Corto alcance",
  },
  rifle: {
    label: "Rifle de Asalto",
    short: "RIF",
    badgeColor: 0x38bdf8,
    badgeHex: "#38BDF8",
    shortStats: "14 DMG · Ráfaga rápida",
  },
  burst: {
    label: "Ráfaga Triple",
    short: "RAF",
    badgeColor: 0x2dd4bf,
    badgeHex: "#2DD4BF",
    shortStats: "3x13 DMG · Precisa",
  },
  plasma: {
    label: "Cañón de Plasma",
    short: "PLA",
    badgeColor: 0xf472b6,
    badgeHex: "#F472B6",
    shortStats: "42 DMG · Rebota 1 vez",
  },
  sniper: {
    label: "Francotirador",
    short: "SNI",
    badgeColor: 0xc084fc,
    badgeHex: "#C084FC",
    shortStats: "65 DMG · Largo alcance",
  },
};

export const THEME_META: Record<
  ArenaTheme,
  { label: string; desc: string; emoji: string; swatch: string }
> = {
  cyber_outpost: {
    label: "Puesto Cibernético",
    desc: "Plataforma metálica con luces de neón",
    emoji: "🛰️",
    swatch: "#1e3a5f",
  },
  midnight: {
    label: "Bosque Nocturno",
    desc: "Oscuridad, luciérnagas y visión reducida",
    emoji: "🌙",
    swatch: "#0f1b33",
  },
  arctic: {
    label: "Tundra Ártica",
    desc: "Nieve, hielo y rocas congeladas",
    emoji: "❄️",
    swatch: "#cfe8f5",
  },
  desert: {
    label: "Desierto Ardiente",
    desc: "Dunas, cactus y mesas de arenisca",
    emoji: "🏜️",
    swatch: "#d9a35a",
  },
};

export const THEME_ORDER: ArenaTheme[] = [
  "cyber_outpost",
  "midnight",
  "arctic",
  "desert",
];

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
export const MAX_INVENTORY_SLOTS = 3;
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "/api";
export const NICKNAME_STORAGE_KEY = "bala_perdida_nickname";
export const COLOR_STORAGE_KEY = "bala_perdida_color";
export const THEME_STORAGE_KEY = "bala_perdida_theme";
