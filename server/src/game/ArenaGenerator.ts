import type {
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

const OBSTACLE_SPECS: ObstacleSpec[] = [
  { type: "rock", count: 10, radius: 38, hp: 9999, maxHp: 9999 },
  { type: "tree", count: 12, radius: 22, hp: 9999, maxHp: 9999 },
  { type: "crate", count: 14, radius: 28, hp: 40, maxHp: 40 },
];

const LOOT_WEAPONS: WeaponType[] = ["shotgun", "rifle", "sniper"];

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
  public static readonly OBSTACLE_PADDING = 20;
  public static readonly EDGE_MARGIN = 60;

  private static lootSeq = 0;

  /**
   * Devuelve los 4 puntos de aparición seguros en las esquinas de la arena (1600x1200),
   * orientados inicialmente hacia el centro del mapa.
   */
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

  /**
   * Genera una arena abierta estilo ZombsRoyale de 1600x1200 con rocas, árboles y cajas
   * de botín sin superposición y respetando un radio libre de 160 px en cada spawn.
   */
  public static generate(
    mapWidth: number = ArenaGenerator.MAP_WIDTH,
    mapHeight: number = ArenaGenerator.MAP_HEIGHT
  ): ArenaLayout {
    const spawnPoints = ArenaGenerator.getSpawnPoints(mapWidth, mapHeight);
    const obstacles: ObstacleState[] = [];
    let obstacleCounter = 0;

    for (const spec of OBSTACLE_SPECS) {
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

        // 1. Respetar radio libre de 160 px alrededor de cada punto de aparición
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

        // 2. Evitar superposición con otros obstáculos ya colocados
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
      spawnPoints,
      obstacles,
    };
  }

  /**
   * Genera un objeto de botín al destruir una caja:
   * - 70% probabilidad de arma aleatoria ("shotgun" | "rifle" | "sniper")
   * - 30% probabilidad de botiquín ("medkit")
   */
  public static generateLootFromCrate(
    x: number,
    y: number,
    customId?: string
  ): LootItemState {
    const id = customId ?? `loot_${++ArenaGenerator.lootSeq}_${Date.now()}`;
    const roll = Math.random();

    if (roll < 0.7) {
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

  /**
   * Selecciona un modificador aleatorio para la siguiente ronda.
   */
  public static pickRandomModifier(): RoundModifier {
    return ROUND_MODIFIERS[Math.floor(Math.random() * ROUND_MODIFIERS.length)];
  }
}
