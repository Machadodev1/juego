import type { WeaponType } from "@shared/types";

export interface WeaponStats {
  type: WeaponType;
  damage: number;
  cooldownMs: number;
  projectiles: number;
  spreadDeg: number;
  speedPxPerSec: number;
  maxRangePx: number;
  fanSpread: boolean; // true = abanico uniforme (shotgun), false = dispersión aleatoria dentro del cono
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponStats> = {
  pistol: {
    type: "pistol",
    damage: 15,
    cooldownMs: 300,
    projectiles: 1,
    spreadDeg: 0,
    speedPxPerSec: 750,
    maxRangePx: 700,
    fanSpread: false,
  },
  shotgun: {
    type: "shotgun",
    damage: 12,
    cooldownMs: 850,
    projectiles: 5,
    spreadDeg: 25,
    speedPxPerSec: 680,
    maxRangePx: 380,
    fanSpread: true,
  },
  rifle: {
    type: "rifle",
    damage: 14,
    cooldownMs: 130,
    projectiles: 1,
    spreadDeg: 4,
    speedPxPerSec: 900,
    maxRangePx: 950,
    fanSpread: false,
  },
  sniper: {
    type: "sniper",
    damage: 65,
    cooldownMs: 1200,
    projectiles: 1,
    spreadDeg: 0,
    speedPxPerSec: 1350,
    maxRangePx: 1400,
    fanSpread: false,
  },
};
