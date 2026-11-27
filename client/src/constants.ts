import type {
  AbilityType,
  EmoteType,
  RoundModifier,
  WeaponType,
} from "@shared/types";

const envServerUrl = (
  import.meta.env.VITE_SERVER_URL as string | undefined
)?.trim();

function resolveDefaultServerUrl(): string {
  if (envServerUrl) return envServerUrl;
  if (typeof window !== "undefined") {
    const { hostname, protocol, host } = window.location;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      const wsProto = protocol === "https:" ? "wss:" : "ws:";
      return `${wsProto}//${host}/api`;
    }
  }
  return "ws://localhost:2567";
}

export const SERVER_URL = resolveDefaultServerUrl();

export const NICKNAME_STORAGE_KEY = "bala_perdida_nickname";
export const COLOR_STORAGE_KEY = "bala_perdida_color";
export const ABILITY_STORAGE_KEY = "bala_perdida_ability";

export const MAX_SCORE_TO_WIN = 5;

export interface PlayerColorOption {
  name: string;
  code: string;
  hex: string;
}

export const TACTICAL_COLORS: PlayerColorOption[] = [
  { name: "Ámbar Dorado", code: "AMBER", hex: "#F59E0B" },
  { name: "Esmeralda", code: "EMERALD", hex: "#10B981" },
  { name: "Azul Cielo", code: "SKY", hex: "#0EA5E9" },
  { name: "Carmesí", code: "CRIMSON", hex: "#EF4444" },
  { name: "Violeta Pizarra", code: "VIOLET", hex: "#8B5CF6" },
  { name: "Blanco Táctico", code: "GHOST", hex: "#F8FAFC" },
];

// Alias mantenido por compatibilidad
export const NEON_COLORS = TACTICAL_COLORS;

export interface AbilityMeta {
  id: AbilityType;
  code: string;
  label: string;
  cooldownSec: number;
  cooldownLabel: string;
  desc: string;
  accentHex: string;
}

export const ABILITY_ORDER: AbilityType[] = [
  "dash",
  "energy_shield",
  "proximity_mine",
  "smoke_grenade",
];

export const ABILITY_META: Record<AbilityType, AbilityMeta> = {
  dash: {
    id: "dash",
    code: "DASH",
    label: "Dash Táctico",
    cooldownSec: 4,
    cooldownLabel: "4.0s CD",
    desc: "Impulso evasivo + 150ms inmune",
    accentHex: "#F59E0B",
  },
  energy_shield: {
    id: "energy_shield",
    code: "SHIELD",
    label: "Escudo Frontal",
    cooldownSec: 8,
    cooldownLabel: "8.0s CD",
    desc: "Refleja fuego frontal por 2.5s",
    accentHex: "#0EA5E9",
  },
  proximity_mine: {
    id: "proximity_mine",
    code: "MINE",
    label: "Mina Proximidad",
    cooldownSec: 10,
    cooldownLabel: "10.0s CD",
    desc: "Carga explosiva oculta (45 DMG)",
    accentHex: "#EF4444",
  },
  smoke_grenade: {
    id: "smoke_grenade",
    code: "SMOKE",
    label: "Cortina de Humo",
    cooldownSec: 9,
    cooldownLabel: "9.0s CD",
    desc: "Despliega cobertura de sigilo",
    accentHex: "#94A3B8",
  },
};

export interface WeaponMeta {
  code: string;
  label: string;
  shortStats: string;
  badgeHex: string;
  isSpecial?: boolean;
}

export const WEAPON_META: Record<WeaponType, WeaponMeta> = {
  pistol: {
    code: "PISTOL",
    label: "Pistola",
    shortStats: "15 DMG · SEMI",
    badgeHex: "#94A3B8",
  },
  shotgun: {
    code: "SHOTGUN",
    label: "Escopeta",
    shortStats: "5×12 DMG · SPREAD",
    badgeHex: "#F59E0B",
  },
  rifle: {
    code: "RIFLE",
    label: "Rifle",
    shortStats: "14 DMG · AUTO",
    badgeHex: "#0EA5E9",
  },
  sniper: {
    code: "SNIPER",
    label: "Francotirador",
    shortStats: "65 DMG · RAIL",
    badgeHex: "#EF4444",
  },
  impulse_gun: {
    code: "IMPULSE",
    label: "Cañón Impulso",
    shortStats: "KNOCKBACK",
    badgeHex: "#0EA5E9",
    isSpecial: true,
  },
  flamethrower: {
    code: "FLAMER",
    label: "Lanzallamas",
    shortStats: "NAPALM ZONE",
    badgeHex: "#F59E0B",
    isSpecial: true,
  },
  saw_disc: {
    code: "SAW DISC",
    label: "Disco Sierra",
    shortStats: "28 DMG · BOOMERANG",
    badgeHex: "#F59E0B",
    isSpecial: true,
  },
  bee_cannon: {
    code: "SWARM",
    label: "Cañón Abejas",
    shortStats: "HOMING",
    badgeHex: "#F59E0B",
    isSpecial: true,
  },
  grappling_hook: {
    code: "GRAPPLE",
    label: "Gancho Arpeo",
    shortStats: "RAPID PULL",
    badgeHex: "#8B5CF6",
    isSpecial: true,
  },
};

export interface ModifierMeta {
  code: string;
  label: string;
  desc: string;
  accentClass: string;
}

export const MODIFIER_META: Record<RoundModifier, ModifierMeta> = {
  normal: {
    code: "STANDARD",
    label: "Standard Ops",
    desc: "Parámetros tácticos estándar de combate",
    accentClass: "border-slate-600 text-slate-200",
  },
  speed_boost: {
    code: "OVERDRIVE",
    label: "Overdrive 1.4x",
    desc: "Velocidad de desplazamiento aumentada un 40%",
    accentClass: "border-amber-500/70 text-amber-400",
  },
  ricochet: {
    code: "RICOCHET",
    label: "Ricochet Rounds",
    desc: "Todos los proyectiles rebotan 2 veces en cobertura",
    accentClass: "border-emerald-500/70 text-emerald-400",
  },
  vampire: {
    code: "VAMPIRE",
    label: "Vampire Protocol",
    desc: "Recupera +25 HP por cada baja confirmada",
    accentClass: "border-rose-500/70 text-rose-400",
  },
  double_damage: {
    code: "DOUBLE DMG",
    label: "Double Damage 2x",
    desc: "Potencia de fuego duplicada en todo el arsenal",
    accentClass: "border-amber-500/80 text-amber-400",
  },
  hot_potato: {
    code: "HOT POTATO",
    label: "Hot Potato",
    desc: "Carga explosiva de 12s · Impacta a un rival para transferirla",
    accentClass: "border-red-500/80 text-red-400",
  },
  sniper_zero_g: {
    code: "SNIPER ZERO-G",
    label: "Sniper Zero-G",
    desc: "Francotiradores con retroceso cinético extremo",
    accentClass: "border-sky-500/80 text-sky-400",
  },
  tiny_shotgun: {
    code: "TINY SHOTGUN",
    label: "Close Quarters",
    desc: "Perímetro reducido 900×700 · Escopetas de recarga rápida",
    accentClass: "border-amber-500/80 text-amber-400",
  },
  all_invisible: {
    code: "STEALTH OPS",
    label: "All Invisible",
    desc: "Camuflaje óptico activo salvo al abrir fuego o pisar fluidos",
    accentClass: "border-violet-500/80 text-violet-300",
  },
  giant_bullets: {
    code: "GIANT BULLETS",
    label: "Giant Bullets 4x",
    desc: "Calibre pesado 4x de baja velocidad",
    accentClass: "border-amber-500/80 text-amber-300",
  },
};

export interface EmoteMeta {
  id: EmoteType;
  key: string;
  icon: string;
  label: string;
}

export const EMOTE_LIST: EmoteMeta[] = [
  { id: "laugh", key: "1", icon: "😂", label: "Laugh" },
  { id: "skull", key: "2", icon: "💀", label: "Skull" },
  { id: "gg", key: "3", icon: "GG", label: "GG" },
  { id: "chicken", key: "4", icon: "🐔", label: "Chicken" },
];

export const EMOTE_BY_ID: Record<EmoteType, EmoteMeta> = {
  laugh: EMOTE_LIST[0],
  skull: EMOTE_LIST[1],
  gg: EMOTE_LIST[2],
  chicken: EMOTE_LIST[3],
};
