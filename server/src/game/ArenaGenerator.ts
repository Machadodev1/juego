import type {
  LootItemState,
  ObstacleState,
  ObstacleType,
  RoundModifier,
  WeaponType,
} from "@shared/types";
import { NORMAL_CRATE_WEAPONS, SPECIAL_WEAPONS } from "./WeaponConfig";

export interface SpawnPoint {
  x: number;
  y: number;
  angle: number;
}

export interface ArenaLayout {
  mapWidth: number;
  mapHeight: number;
  spawnPoints: SpawnPoint[];
  obstacles: ObstacleState[];
}

interface ObstacleSpec {
  type: ObstacleType;
  count: number;
  radius: number;
  hp: number;
  maxHp: number;
  awake?: boolean;
}

export const ALL_ROUND_MODIFIERS: RoundModifier[] = [
  "normal",
  "speed_boost",
  "ricochet",
  "vampire",
  "double_damage",
  "hot_potato",
  "sniper_zero_g",
  "tiny_shotgun",
  "all_invisible",
  "giant_bullets",
];

export class ArenaGenerator {
  public static readonly MAP_WIDTH = 1600;
  public static readonly MAP_HEIGHT = 1200;
  public static readonly TINY_MAP_WIDTH = 900;
  public static readonly TINY_MAP_HEIGHT = 700;

  public static readonly SPAWN_CLEAR_RADIUS = 135;
  public static readonly OBSTACLE_PADDING = 18;
  public static readonly EDGE_MARGIN = 56;

  private static lootSeq = 0;

  public static getDimensionsForModifier(modifier: RoundModifier): {
    mapWidth: number;
    mapHeight: number;
  } {
    if (modifier === "tiny_shotgun") {
      return {
        mapWidth: ArenaGenerator.TINY_MAP_WIDTH,
        mapHeight: ArenaGenerator.TINY_MAP_HEIGHT,
      };
    }
    return {
      mapWidth: ArenaGenerator.MAP_WIDTH,
      mapHeight: ArenaGenerator.MAP_HEIGHT,
    };
  }

  public static getSpawnPoints(
    mapWidth: number = ArenaGenerator.MAP_WIDTH,
    mapHeight: number = ArenaGenerator.MAP_HEIGHT
  ): SpawnPoint[] {
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const marginX = Math.min(170, Math.round(mapWidth * 0.16));
    const marginY = Math.min(170, Math.round(mapHeight * 0.16));

    const rawSpawns = [
      { x: marginX, y: marginY },
      { x: mapWidth - marginX, y: marginY },
      { x: marginX, y: mapHeight - marginY },
      { x: mapWidth - marginX, y: mapHeight - marginY },
    ];

    return rawSpawns.map((pt) => ({
      x: pt.x,
      y: pt.y,
      angle: Math.atan2(centerY - pt.y, centerX - pt.x),
    }));
  }

  public static generate(
    modifier: RoundModifier = "normal",
    customWidth?: number,
    customHeight?: number
  ): ArenaLayout {
    const dims = ArenaGenerator.getDimensionsForModifier(modifier);
    const mapWidth = customWidth ?? dims.mapWidth;
    const mapHeight = customHeight ?? dims.mapHeight;
    const isCompact = mapWidth <= 1000;

    const spawnPoints = ArenaGenerator.getSpawnPoints(mapWidth, mapHeight);
    const obstacles: ObstacleState[] = [];
    let obstacleCounter = 0;

    // 1. Caja Dorada (80 HP) siempre en el centro exacto del mapa
    obstacles.push({
      id: `obs_golden_crate_${++obstacleCounter}`,
      type: "golden_crate",
      x: Math.round(mapWidth / 2),
      y: Math.round(mapHeight / 2),
      radius: 34,
      hp: 80,
      maxHp: 80,
      awake: false,
    });

    // 2. Primero ubicamos todos los elementos interactivos obligatorios y luego la cobertura estática
    const specs: ObstacleSpec[] = [
      { type: "explosive_barrel", count: 5, radius: 23, hp: 25, maxHp: 25 },
      { type: "oil_barrel", count: 4, radius: 23, hp: 20, maxHp: 20 },
      {
        type: "mimic_crate",
        count: 2,
        radius: 27,
        hp: 35,
        maxHp: 35,
        awake: false,
      },
      { type: "jump_pad", count: 2, radius: 30, hp: 9999, maxHp: 9999 },
      { type: "bush", count: 6, radius: 40, hp: 9999, maxHp: 9999 },
      {
        type: "crate",
        count: isCompact ? 6 : 12,
        radius: 27,
        hp: 40,
        maxHp: 40,
      },
      {
        type: "rock",
        count: isCompact ? 4 : 9,
        radius: 36,
        hp: 9999,
        maxHp: 9999,
      },
      {
        type: "tree",
        count: isCompact ? 4 : 9,
        radius: 22,
        hp: 9999,
        maxHp: 9999,
      },
    ];

    const spawnClear = isCompact ? 105 : ArenaGenerator.SPAWN_CLEAR_RADIUS;
    const padding = isCompact ? 12 : ArenaGenerator.OBSTACLE_PADDING;

    for (const spec of specs) {
      let placed = 0;
      let attempts = 0;
      const maxAttempts = spec.count * 220;

      while (placed < spec.count && attempts < maxAttempts) {
        attempts++;

        const minX = ArenaGenerator.EDGE_MARGIN + spec.radius;
        const maxX = mapWidth - ArenaGenerator.EDGE_MARGIN - spec.radius;
        const minY = ArenaGenerator.EDGE_MARGIN + spec.radius;
        const maxY = mapHeight - ArenaGenerator.EDGE_MARGIN - spec.radius;

        const x = Math.round(minX + Math.random() * (maxX - minX));
        const y = Math.round(minY + Math.random() * (maxY - minY));

        let nearSpawn = false;
        for (const sp of spawnPoints) {
          const minSpawnDist = spawnClear + spec.radius;
          const dx = x - sp.x;
          const dy = y - sp.y;
          if (dx * dx + dy * dy < minSpawnDist * minSpawnDist) {
            nearSpawn = true;
            break;
          }
        }
        if (nearSpawn) continue;

        let overlapsObstacle = false;
        for (const other of obstacles) {
          const minDist = spec.radius + other.radius + padding;
          const dx = x - other.x;
          const dy = y - other.y;
          if (dx * dx + dy * dy < minDist * minDist) {
            overlapsObstacle = true;
            break;
          }
        }
        if (overlapsObstacle) continue;

        obstacles.push({
          id: `obs_${spec.type}_${++obstacleCounter}`,
          type: spec.type,
          x,
          y,
          radius: spec.radius,
          hp: spec.hp,
          maxHp: spec.maxHp,
          awake: spec.awake ?? false,
        });
        placed++;
      }
    }

    return {
      mapWidth,
      mapHeight,
      spawnPoints,
      obstacles,
    };
  }

  /** Botín de caja normal (40 HP): shotgun, rifle, sniper, medkit (+35 HP) o shield (+25). */
  public static generateLootFromCrate(x: number, y: number): LootItemState {
    const id = `loot_${++ArenaGenerator.lootSeq}_${Date.now()}`;
    const roll = Math.random();

    if (roll < 0.56) {
      const weaponType =
        NORMAL_CRATE_WEAPONS[
          Math.floor(Math.random() * NORMAL_CRATE_WEAPONS.length)
        ];
      return {
        id,
        kind: "weapon",
        weaponType,
        x,
        y,
      };
    }

    if (roll < 0.8) {
      return {
        id,
        kind: "medkit",
        x,
        y,
        amount: 35,
      };
    }

    return {
      id,
      kind: "shield",
      x,
      y,
      amount: 25,
    };
  }

  /** Botín de Caja Dorada (80 HP): Arma especial aleatoria + Poción +50 Shield. */
  public static generateLootFromGoldenCrate(
    x: number,
    y: number
  ): LootItemState[] {
    const specialWeapon = ArenaGenerator.pickRandomSpecialWeapon();
    const now = Date.now();
    return [
      {
        id: `loot_${++ArenaGenerator.lootSeq}_${now}`,
        kind: "weapon",
        weaponType: specialWeapon,
        x: x - 20,
        y,
      },
      {
        id: `loot_${++ArenaGenerator.lootSeq}_${now}`,
        kind: "shield",
        x: x + 20,
        y,
        amount: 50,
      },
    ];
  }

  public static generateWeaponDrop(
    weaponType: WeaponType,
    x: number,
    y: number
  ): LootItemState {
    return {
      id: `loot_${++ArenaGenerator.lootSeq}_${Date.now()}`,
      kind: "weapon",
      weaponType,
      x,
      y,
    };
  }

  public static pickRandomSpecialWeapon(): WeaponType {
    return SPECIAL_WEAPONS[Math.floor(Math.random() * SPECIAL_WEAPONS.length)];
  }

  public static pickRandomModifier(prev?: RoundModifier): RoundModifier {
    const pool = prev
      ? ALL_ROUND_MODIFIERS.filter((m) => m !== prev)
      : ALL_ROUND_MODIFIERS;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
