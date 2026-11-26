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
  hex: string;
  glow: string;
}

export const NEON_COLORS: PlayerColorOption[] = [
  { name: "Cian Eléctrico", hex: "#22D3EE", glow: "rgba(34, 211, 238, 0.55)" },
  { name: "Rosa Caos", hex: "#EC4899", glow: "rgba(236, 72, 153, 0.55)" },
  { name: "Lima Tóxico", hex: "#A3E635", glow: "rgba(163, 230, 53, 0.55)" },
  { name: "Ámbar Nitro", hex: "#F59E0B", glow: "rgba(245, 158, 11, 0.55)" },
  { name: "Violeta Nova", hex: "#A855F7", glow: "rgba(168, 85, 247, 0.55)" },
  { name: "Coral Carmesí", hex: "#EF4444", glow: "rgba(239, 68, 68, 0.55)" },
];

export interface AbilityMeta {
  id: AbilityType;
  label: string;
  emoji: string;
  cooldownSec: number;
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
    label: "Dash Relámpago",
    emoji: "💨",
    cooldownSec: 4,
    desc: "Impulso veloz + 150 ms invulnerable",
    accentHex: "#38BDF8",
  },
  energy_shield: {
    id: "energy_shield",
    label: "Escudo de Energía",
    emoji: "🛡️",
    cooldownSec: 8,
    desc: "Refleja balas frontales durante 2.5s",
    accentHex: "#60A5FA",
  },
  proximity_mine: {
    id: "proximity_mine",
    label: "Mina de Proximidad",
    emoji: "💣",
    cooldownSec: 10,
    desc: "Trampa oculta que detona (45 DMG)",
    accentHex: "#F87171",
  },
  smoke_grenade: {
    id: "smoke_grenade",
    label: "Granada de Humo",
    emoji: "🌫️",
    cooldownSec: 9,
    desc: "Nube densa que te vuelve invisible",
    accentHex: "#94A3B8",
  },
};

export interface WeaponMeta {
  label: string;
  shortStats: string;
  badgeHex: string;
  isSpecial?: boolean;
}

export const WEAPON_META: Record<WeaponType, WeaponMeta> = {
  pistol: {
    label: "Pistola",
    shortStats: "15 DMG · Equilibrada",
    badgeHex: "#94A3B8",
  },
  shotgun: {
    label: "Escopeta",
    shortStats: "5×12 DMG · Corto alcance",
    badgeHex: "#F97316",
  },
  rifle: {
    label: "Rifle de Asalto",
    shortStats: "14 DMG · Ráfaga automática",
    badgeHex: "#38BDF8",
  },
  sniper: {
    label: "Francotirador",
    shortStats: "65 DMG · Bala supersónica",
    badgeHex: "#F43F5E",
  },
  impulse_gun: {
    label: "Cañón de Impulso",
    shortStats: "5 DMG · Empuje brutal",
    badgeHex: "#22D3EE",
    isSpecial: true,
  },
  flamethrower: {
    label: "Lanzallamas",
    shortStats: "Fuego continuo · Quema el suelo",
    badgeHex: "#FB923C",
    isSpecial: true,
  },
  saw_disc: {
    label: "Disco Sierra",
    shortStats: "28 DMG · 3 rebotes + boomerang",
    badgeHex: "#FACC15",
    isSpecial: true,
  },
  bee_cannon: {
    label: "Cañón de Abejas",
    shortStats: "2×16 DMG · Enjambre teledirigido",
    badgeHex: "#EAB308",
    isSpecial: true,
  },
  grappling_hook: {
    label: "Gancho Arpeo",
    shortStats: "20 DMG · Te lanza al impacto",
    badgeHex: "#A855F7",
    isSpecial: true,
  },
};

export interface ModifierMeta {
  label: string;
  emoji: string;
  desc: string;
  pillClass: string;
  bannerGradient: string;
}

export const MODIFIER_META: Record<RoundModifier, ModifierMeta> = {
  normal: {
    label: "Estándar",
    emoji: "⚔️",
    desc: "Reglas clásicas de la arena caótica",
    pillClass: "border-slate-600/70 bg-slate-800/85 text-slate-200",
    bannerGradient: "from-slate-800/95 via-slate-900/95 to-slate-800/95",
  },
  speed_boost: {
    label: "Turbo 1.4x",
    emoji: "⚡",
    desc: "Todos corren un 40% más rápido",
    pillClass: "border-cyan-400/60 bg-cyan-500/20 text-cyan-200",
    bannerGradient: "from-cyan-600/90 via-sky-900/95 to-cyan-600/90",
  },
  ricochet: {
    label: "Balas Rebotadoras",
    emoji: "🪃",
    desc: "Todos los disparos rebotan 2 veces en muros y rocas",
    pillClass: "border-emerald-400/60 bg-emerald-500/20 text-emerald-200",
    bannerGradient: "from-emerald-600/90 via-teal-900/95 to-emerald-600/90",
  },
  vampire: {
    label: "Vampirismo",
    emoji: "🧛",
    desc: "+25 HP al eliminar a un rival",
    pillClass: "border-rose-400/60 bg-rose-500/20 text-rose-200",
    bannerGradient: "from-rose-600/90 via-red-950/95 to-rose-600/90",
  },
  double_damage: {
    label: "Doble Daño 2x",
    emoji: "💥",
    desc: "Todas las armas infligen el doble de daño",
    pillClass: "border-amber-400/60 bg-amber-500/20 text-amber-200",
    bannerGradient: "from-amber-600/90 via-orange-950/95 to-amber-600/90",
  },
  hot_potato: {
    label: "Papa Caliente",
    emoji: "💣",
    desc: "¡12s para disparar a otro y pasarle la bomba antes de explotar!",
    pillClass: "border-orange-400/70 bg-orange-500/25 text-orange-200",
    bannerGradient: "from-orange-600/95 via-red-900/95 to-amber-600/95",
  },
  sniper_zero_g: {
    label: "Sniper Gravedad Cero",
    emoji: "🚀",
    desc: "Todos con Francotirador + retroceso masivo que te lanza volando",
    pillClass: "border-indigo-400/70 bg-indigo-500/25 text-indigo-200",
    bannerGradient: "from-indigo-600/95 via-purple-950/95 to-indigo-600/95",
  },
  tiny_shotgun: {
    label: "Mini Arena Escopetas",
    emoji: "🔥",
    desc: "Mapa reducido 900×700 + todos con escopeta rápida",
    pillClass: "border-red-400/70 bg-red-500/25 text-red-200",
    bannerGradient: "from-red-600/95 via-rose-950/95 to-orange-600/95",
  },
  all_invisible: {
    label: "Fantasmas Invisibles",
    emoji: "👻",
    desc: "Todos invisibles salvo al disparar o pisar aceite/fuego",
    pillClass: "border-purple-400/70 bg-purple-500/25 text-purple-200",
    bannerGradient: "from-purple-600/95 via-slate-950/95 to-fuchsia-600/95",
  },
  giant_bullets: {
    label: "Balas Gigantes 4x",
    emoji: "🟣",
    desc: "Proyectiles 4x más grandes y lentos estilo Bullet Hell",
    pillClass: "border-pink-400/70 bg-pink-500/25 text-pink-200",
    bannerGradient: "from-pink-600/95 via-fuchsia-950/95 to-purple-600/95",
  },
};

export interface EmoteMeta {
  id: EmoteType;
  key: string;
  icon: string;
  label: string;
}

export const EMOTE_LIST: EmoteMeta[] = [
  { id: "laugh", key: "1", icon: "😂", label: "Risa" },
  { id: "skull", key: "2", icon: "💀", label: "Calavera" },
  { id: "gg", key: "3", icon: "GG", label: "GG" },
  { id: "chicken", key: "4", icon: "🐔", label: "Gallina" },
];

export const EMOTE_BY_ID: Record<EmoteType, EmoteMeta> = {
  laugh: EMOTE_LIST[0],
  skull: EMOTE_LIST[1],
  gg: EMOTE_LIST[2],
  chicken: EMOTE_LIST[3],
};
