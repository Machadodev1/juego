import type { WeaponType } from "@shared/types";

export interface WeaponStats {
  type: WeaponType;
  damage: number;
  cooldownMs: number;
  projectiles: number;
  spreadDeg: number;
  speedPxPerSec: number;
  maxRangePx: number;
  fanSpread: boolean;
  naturalBounces?: number;
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponStats> = {
  pistol: {
    type: "pistol",
    damage: 15,
    cooldownMs: 290,
    projectiles: 1,
    spreadDeg: 0,
    speedPxPerSec: 760,
    maxRangePx: 700,
    fanSpread: false,
  },
  smg: {
    type: "smg",
    damage: 9,
    cooldownMs: 80,
    projectiles: 1,
    spreadDeg: 8,
    speedPxPerSec: 820,
    maxRangePx: 560,
    fanSpread: false,
  },
  shotgun: {
    type: "shotgun",
    damage: 12,
    cooldownMs: 850,
    projectiles: 5,
    spreadDeg: 25,
    speedPxPerSec: 680,
    maxRangePx: 390,
    fanSpread: true,
  },
  rifle: {
    type: "rifle",
    damage: 14,
    cooldownMs: 130,
    projectiles: 1,
    spreadDeg: 3.5,
    speedPxPerSec: 920,
    maxRangePx: 950,
    fanSpread: false,
  },
  burst: {
    type: "burst",
    damage: 13,
    cooldownMs: 460,
    projectiles: 3,
    spreadDeg: 6,
    speedPxPerSec: 980,
    maxRangePx: 900,
    fanSpread: true,
  },
  plasma: {
    type: "plasma",
    damage: 42,
    cooldownMs: 720,
    projectiles: 1,
    spreadDeg: 0,
    speedPxPerSec: 640,
    maxRangePx: 860,
    fanSpread: false,
    naturalBounces: 1,
  },
  sniper: {
    type: "sniper",
    damage: 65,
    cooldownMs: 1200,
    projectiles: 1,
    spreadDeg: 0,
    speedPxPerSec: 1380,
    maxRangePx: 1420,
    fanSpread: false,
  },
};
