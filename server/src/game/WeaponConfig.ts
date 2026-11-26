import type { AbilityType, WeaponType } from "@shared/types";

export interface WeaponStats {
  type: WeaponType;
  label: string;
  damage: number;
  cooldownMs: number;
  speedPxPerSec: number;
  projectiles: number;
  spreadDeg: number;
  fanSpread?: boolean;
  maxRangePx: number;
  baseRadius: number;
  naturalBounces?: number;
  isHoming?: boolean;
  isBoomerang?: boolean;
  knockbackTarget?: number;
  selfRecoil?: number;
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponStats> = {
  pistol: {
    type: "pistol",
    label: "Pistola",
    damage: 15,
    cooldownMs: 270,
    speedPxPerSec: 660,
    projectiles: 1,
    spreadDeg: 2,
    maxRangePx: 760,
    baseRadius: 5,
  },
  shotgun: {
    type: "shotgun",
    label: "Escopeta",
    damage: 12,
    cooldownMs: 740,
    speedPxPerSec: 610,
    projectiles: 5,
    spreadDeg: 25,
    fanSpread: true,
    maxRangePx: 430,
    baseRadius: 4.5,
  },
  rifle: {
    type: "rifle",
    label: "Rifle de Asalto",
    damage: 14,
    cooldownMs: 130,
    speedPxPerSec: 750,
    projectiles: 1,
    spreadDeg: 4,
    maxRangePx: 840,
    baseRadius: 5,
  },
  sniper: {
    type: "sniper",
    label: "Francotirador",
    damage: 65,
    cooldownMs: 1050,
    speedPxPerSec: 1240,
    projectiles: 1,
    spreadDeg: 0,
    maxRangePx: 1450,
    baseRadius: 6,
  },
  impulse_gun: {
    type: "impulse_gun",
    label: "Cañón de Impulso",
    damage: 5,
    cooldownMs: 620,
    speedPxPerSec: 800,
    projectiles: 1,
    spreadDeg: 0,
    maxRangePx: 700,
    baseRadius: 9,
    knockbackTarget: 1020,
    selfRecoil: 500,
  },
  flamethrower: {
    type: "flamethrower",
    label: "Lanzallamas",
    damage: 6,
    cooldownMs: 80,
    speedPxPerSec: 430,
    projectiles: 2,
    spreadDeg: 20,
    maxRangePx: 255,
    baseRadius: 8,
  },
  saw_disc: {
    type: "saw_disc",
    label: "Lanzadiscos Sierra",
    damage: 28,
    cooldownMs: 680,
    speedPxPerSec: 630,
    projectiles: 1,
    spreadDeg: 0,
    maxRangePx: 1450,
    baseRadius: 11,
    naturalBounces: 3,
    isBoomerang: true,
  },
  bee_cannon: {
    type: "bee_cannon",
    label: "Cañón de Abejas",
    damage: 16,
    cooldownMs: 520,
    speedPxPerSec: 340,
    projectiles: 2,
    spreadDeg: 22,
    maxRangePx: 980,
    baseRadius: 6,
    isHoming: true,
  },
  grappling_hook: {
    type: "grappling_hook",
    label: "Gancho Arpeo",
    damage: 20,
    cooldownMs: 880,
    speedPxPerSec: 1080,
    projectiles: 1,
    spreadDeg: 0,
    maxRangePx: 680,
    baseRadius: 7,
  },
};

export const NORMAL_CRATE_WEAPONS: WeaponType[] = [
  "shotgun",
  "rifle",
  "sniper",
];

export const SPECIAL_WEAPONS: WeaponType[] = [
  "impulse_gun",
  "flamethrower",
  "saw_disc",
  "bee_cannon",
  "grappling_hook",
];

export const ABILITY_COOLDOWNS_MS: Record<AbilityType, number> = {
  dash: 4000,
  energy_shield: 8000,
  proximity_mine: 10000,
  smoke_grenade: 9000,
};
