import type {
  ArenaTheme,
  LootItemState,
  ObstacleState,
  ObstacleType,
  RoundModifier,
  WeaponType,
} from "@shared/types";

export interface SpawnPoint {
  x: number;
  y: number;
  angle: number;
}

export interface ArenaLayout {
  mapWidth: number;
  mapHeight: number;
  theme: ArenaTheme;
  spawnPoints: SpawnPoint[];
  obstacles: ObstacleState[];
}

interface ObstacleSpec {
  type: ObstacleType;
  count: number;
  radius: number;
  hp: number;
  maxHp: number;
}

// Cada mapa temático tiene proporciones de cobertura distintas para variar también la táctica
const THEME_OBSTACLE_SPECS: Record<ArenaTheme, ObstacleSpec[]> = {
  cyber_outpost: [
    { type: "rock", count: 10, radius: 38, hp: 9999, maxHp: 9999 },
    { type: "tree", count: 10, radius: 22, hp: 9999, maxHp: 9999 },
    { type: "crate", count: 15, radius: 28, hp: 40, maxHp: 40 },
  ],
  midnight: [
    { type: "rock", count: 9, radius: 38, hp: 9999, maxHp: 9999 },
    { type: "tree", count: 15, radius: 22, hp: 9999, maxHp: 9999 },
    { type: "crate", count: 14, radius: 28, hp: 40, maxHp: 40 },
  ],
  arctic: [
    { type: "rock", count: 13, radius: 38, hp: 9999, maxHp: 9999 },
    { type: "tree", count: 9, radius: 22, hp: 9999, maxHp: 9999 },
    { type: "crate", count: 15, radius: 28, hp: 40, maxHp: 40 },
  ],
  desert: [
    { type: "rock", count: 12, radius: 40, hp: 9999, maxHp: 9999 },
    { type: "tree", count: 7, radius: 22, hp: 9999, maxHp: 9999 },
    { type: "crate", count: 16, radius: 28, hp: 40, maxHp: 40 },
  ],
};

const LOOT_WEAPONS: WeaponType[] = [
  "smg",
  "shotgun",
  "rifle",
  "burst",
  "plasma",
  "sniper",
];

export const ARENA_THEMES: ArenaTheme[] = [
  "cyber_outpost",
  "midnight",
  "arctic",
  "desert",
];

const ROUND_MODIFIERS: RoundModifier[] = [
  "normal",
  "speed_boost",
  "ricochet",
  "vampire",
  "double_damage",
];

export class ArenaGenerator {
  public static readonly MAP_WIDTH = 1600;
  public static readonly MAP_HEIGHT = 1200;
  public static readonly SPAWN_CLEAR_RADIUS = 160;
  public static readonly OBSTACLE_PADDING = 22;
  public static readonly EDGE_MARGIN = 64;

  private static lootSeq = 0;

  public static getSpawnPoints(
    mapWidth: number = ArenaGenerator.MAP_WIDTH,
    mapHeight: number = ArenaGenerator.MAP_HEIGHT
  ): SpawnPoint[] {
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const rawSpawns = [
      { x: 180, y: 180 },
      { x: 1420, y: 180 },
      { x: 180, y: 1020 },
      { x: 1420, y: 1020 },
    ];

    return rawSpawns.map((pt) => ({
      x: pt.x,
      y: pt.y,
      angle: Math.atan2(centerY - pt.y, centerX - pt.x),
    }));
  }

  public static pickTheme(preferredTheme?: string, prevTheme?: ArenaTheme): ArenaTheme {
    if (
      preferredTheme &&
      ARENA_THEMES.includes(preferredTheme as ArenaTheme)
    ) {
      return preferredTheme as ArenaTheme;
    }

    const candidates = prevTheme
      ? ARENA_THEMES.filter((t) => t !== prevTheme)
      : ARENA_THEMES;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  public static generate(
    mapWidth: number = ArenaGenerator.MAP_WIDTH,
    mapHeight: number = ArenaGenerator.MAP_HEIGHT,
    theme: ArenaTheme = "cyber_outpost"
  ): ArenaLayout {
    const spawnPoints = ArenaGenerator.getSpawnPoints(mapWidth, mapHeight);
    const obstacles: ObstacleState[] = [];
    const specs = THEME_OBSTACLE_SPECS[theme] || THEME_OBSTACLE_SPECS.cyber_outpost;
    let obstacleCounter = 0;

    for (const spec of specs) {
      let placed = 0;
      let attempts = 0;
      const maxAttempts = spec.count * 120;

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
          const minSpawnDist = ArenaGenerator.SPAWN_CLEAR_RADIUS + spec.radius;
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
          const minDist =
            spec.radius + other.radius + ArenaGenerator.OBSTACLE_PADDING;
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
        });
        placed++;
      }
    }

    return {
      mapWidth,
      mapHeight,
      theme,
      spawnPoints,
      obstacles,
    };
  }

  public static generateLootFromCrate(
    x: number,
    y: number,
    customId?: string
  ): LootItemState {
    const id = customId ?? `loot_${++ArenaGenerator.lootSeq}_${Date.now()}`;
    const roll = Math.random();

    if (roll < 0.74) {
      const weaponType =
        LOOT_WEAPONS[Math.floor(Math.random() * LOOT_WEAPONS.length)];
      return {
        id,
        kind: "weapon",
        weaponType,
        x,
        y,
      };
    }

    return {
      id,
      kind: "medkit",
      x,
      y,
    };
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

  public static pickRandomModifier(): RoundModifier {
    return ROUND_MODIFIERS[Math.floor(Math.random() * ROUND_MODIFIERS.length)];
  }
}
