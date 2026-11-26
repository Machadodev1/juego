import Matter from "matter-js";
import type {
  BulletHitEvent,
  BulletState,
  CrateDestroyedEvent,
  LootItemState,
  ObstacleState,
  PlayerEliminatedEvent,
  PlayerInput,
  RoundModifier,
  WeaponType,
} from "@shared/types";
import { ArenaGenerator } from "./ArenaGenerator";
import { WEAPON_CONFIGS } from "./WeaponConfig";

export interface PhysicsCallbacks {
  onBulletHit?: (event: BulletHitEvent) => void;
  onCrateDestroyed?: (event: CrateDestroyedEvent, spawnedLoot: LootItemState) => void;
  onObstacleDamaged?: (obstacleId: string, hp: number) => void;
  onPlayerDamaged?: (playerId: string, hp: number) => void;
  onPlayerHealed?: (playerId: string, hp: number) => void;
  onPlayerWeaponChanged?: (playerId: string, weapon: WeaponType) => void;
  onPlayerEliminated?: (event: PlayerEliminatedEvent) => void;
  onBulletRemoved?: (bulletId: string) => void;
  onLootPickedUp?: (lootId: string, playerId: string) => void;
}

interface InternalPlayer {
  id: string;
  body: Matter.Body;
  angle: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  weapon: WeaponType;
  lastShootTime: number;
  interactPressed: boolean;
}

interface InternalObstacle {
  state: ObstacleState;
  body: Matter.Body;
}

interface InternalBullet {
  id: string;
  ownerId: string;
  weaponType: WeaponType;
  body: Matter.Body;
  stepSpeed: number;
  speedPxPerSec: number;
  baseDamage: number;
  maxRangePx: number;
  distanceTraveled: number;
  bounces: number;
  prevX: number;
  prevY: number;
}

const CATEGORY_WALL = 0x0001;
const CATEGORY_OBSTACLE = 0x0002;
const CATEGORY_PLAYER = 0x0004;
const CATEGORY_BULLET = 0x0008;

export class PhysicsEngine {
  public static readonly TICKS_PER_SECOND = 60;
  public static readonly SUBSTEPS = 2;

  public static readonly PLAYER_RADIUS = 22;
  public static readonly PLAYER_MAX_HP = 100;
  public static readonly PLAYER_BASE_SPEED_PX_S = 260;
  public static readonly SPEED_BOOST_MULTIPLIER = 1.4;

  public static readonly BULLET_RADIUS = 5;
  public static readonly MAX_RICOCHET_BOUNCES = 2;

  public static readonly LOOT_AUTO_PICKUP_RADIUS = 42;
  public static readonly LOOT_INTERACT_RADIUS = 52;
  public static readonly MEDKIT_HEAL_AMOUNT = 35;
  public static readonly VAMPIRE_HEAL_AMOUNT = 25;

  private engine: Matter.Engine;
  private world: Matter.World;
  private callbacks: PhysicsCallbacks;

  private mapWidth: number = ArenaGenerator.MAP_WIDTH;
  private mapHeight: number = ArenaGenerator.MAP_HEIGHT;
  private modifier: RoundModifier = "normal";

  private borderWalls: Matter.Body[] = [];
  private players: Map<string, InternalPlayer> = new Map();
  private obstacles: Map<string, InternalObstacle> = new Map();
  private lootItems: Map<string, LootItemState> = new Map();
  private bullets: Map<string, InternalBullet> = new Map();

  private bulletsToDestroy: Set<string> = new Set();
  private pendingWallHits: BulletHitEvent[] = [];
  private pendingCrateHits: Array<{
    obstacleId: string;
    damage: number;
    hitX: number;
    hitY: number;
  }> = [];

  private bulletSeq: number = 0;

  constructor(callbacks: PhysicsCallbacks = {}) {
    this.callbacks = callbacks;
    // Asegurar rebotes elásticos exactos incluso en ángulos rasantes para el modificador "ricochet"
    (Matter.Resolver as unknown as { _restingThresh: number })._restingThresh = 0.001;
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });
    this.world = this.engine.world;
    this.registerCollisionEvents();
  }

  public setModifier(modifier: RoundModifier): void {
    this.modifier = modifier;
  }

  public getModifier(): RoundModifier {
    return this.modifier;
  }

  /**
   * Construye los 4 muros estáticos invisibles de los bordes del mapa y los
   * cuerpos circulares estáticos de todos los obstáculos de la arena.
   */
  public loadArena(
    mapWidth: number,
    mapHeight: number,
    obstacles: ObstacleState[]
  ): void {
    this.resetArena();
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    const wallThickness = 80;
    const halfT = wallThickness / 2;

    const borderWallOptions: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      restitution: 1,
      friction: 0,
      frictionStatic: 0,
      frictionAir: 0,
      inertia: Infinity,
      slop: 0,
      label: "border_wall",
      collisionFilter: {
        category: CATEGORY_WALL,
        mask: CATEGORY_PLAYER | CATEGORY_BULLET,
      },
    };

    this.borderWalls = [
      // Arriba
      Matter.Bodies.rectangle(
        mapWidth / 2,
        -halfT,
        mapWidth + wallThickness * 2,
        wallThickness,
        borderWallOptions
      ),
      // Abajo
      Matter.Bodies.rectangle(
        mapWidth / 2,
        mapHeight + halfT,
        mapWidth + wallThickness * 2,
        wallThickness,
        borderWallOptions
      ),
      // Izquierda
      Matter.Bodies.rectangle(
        -halfT,
        mapHeight / 2,
        wallThickness,
        mapHeight + wallThickness * 2,
        borderWallOptions
      ),
      // Derecha
      Matter.Bodies.rectangle(
        mapWidth + halfT,
        mapHeight / 2,
        wallThickness,
        mapHeight + wallThickness * 2,
        borderWallOptions
      ),
    ];

    Matter.Composite.add(this.world, this.borderWalls);

    for (const obs of obstacles) {
      const stateCopy: ObstacleState = { ...obs };
      const body = Matter.Bodies.circle(obs.x, obs.y, obs.radius, {
        isStatic: true,
        restitution: 1,
        friction: 0,
        frictionStatic: 0,
        frictionAir: 0,
        inertia: Infinity,
        slop: 0,
        label: `obstacle:${obs.id}`,
        collisionFilter: {
          category: CATEGORY_OBSTACLE,
          mask: CATEGORY_PLAYER | CATEGORY_BULLET,
        },
      });

      this.obstacles.set(obs.id, { state: stateCopy, body });
      Matter.Composite.add(this.world, body);
    }
  }

  /**
   * Crea o reposiciona el cuerpo circular de un jugador con 100 HP y pistola inicial.
   */
  public spawnPlayer(
    id: string,
    x: number,
    y: number,
    angle: number,
    weapon: WeaponType = "pistol"
  ): void {
    this.removePlayer(id);

    const body = Matter.Bodies.circle(x, y, PhysicsEngine.PLAYER_RADIUS, {
      label: `player:${id}`,
      restitution: 0,
      friction: 0,
      frictionStatic: 0,
      frictionAir: 0,
      inertia: Infinity,
      collisionFilter: {
        category: CATEGORY_PLAYER,
        mask: CATEGORY_WALL | CATEGORY_OBSTACLE | CATEGORY_PLAYER,
      },
    });

    Matter.Composite.add(this.world, body);

    this.players.set(id, {
      id,
      body,
      angle,
      hp: PhysicsEngine.PLAYER_MAX_HP,
      maxHp: PhysicsEngine.PLAYER_MAX_HP,
      alive: true,
      weapon,
      lastShootTime: -Infinity,
      interactPressed: false,
    });
  }

  public removePlayer(id: string): void {
    const existing = this.players.get(id);
    if (existing) {
      Matter.Composite.remove(this.world, existing.body);
      this.players.delete(id);
    }
  }

  /**
   * Aplica el PlayerInput de un jugador:
   * - Movimiento lineal normalizado en 8 direcciones (+1.4x en "speed_boost")
   * - Rotación de apuntado directa (`angle`)
   * - Disparo respetando cooldown, cantidad de perdigones y dispersión del arma actual
   */
  public applyPlayerInput(
    playerId: string,
    input: PlayerInput,
    now: number = Date.now()
  ): BulletState[] {
    const player = this.players.get(playerId);
    if (!player || !player.alive) {
      return [];
    }

    // 1. Actualizar ángulo de apuntado
    if (typeof input.angle === "number" && Number.isFinite(input.angle)) {
      player.angle = Math.atan2(Math.sin(input.angle), Math.cos(input.angle));
    }

    // 2. Velocidad lineal normalizada en 8 direcciones
    let moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);

    const length = Math.hypot(moveX, moveY);
    if (length > 0) {
      moveX /= length;
      moveY /= length;
    }

    const speedMultiplier =
      this.modifier === "speed_boost" ? PhysicsEngine.SPEED_BOOST_MULTIPLIER : 1;
    const speedPxPerSec =
      PhysicsEngine.PLAYER_BASE_SPEED_PX_S * speedMultiplier;
    const stepSpeed = speedPxPerSec / PhysicsEngine.TICKS_PER_SECOND;

    Matter.Body.setVelocity(player.body, {
      x: moveX * stepSpeed,
      y: moveY * stepSpeed,
    });
    Matter.Body.setAngularVelocity(player.body, 0);

    player.interactPressed = Boolean(input.interact);

    // 3. Disparo según configuración del arma equipada
    const spawnedBullets: BulletState[] = [];
    const weaponStats = WEAPON_CONFIGS[player.weapon];

    if (input.shoot && now - player.lastShootTime >= weaponStats.cooldownMs) {
      player.lastShootTime = now;
      const created = this.spawnWeaponProjectiles(player, now);
      spawnedBullets.push(...created);
    }

    return spawnedBullets;
  }

  private spawnWeaponProjectiles(
    player: InternalPlayer,
    now: number
  ): BulletState[] {
    const stats = WEAPON_CONFIGS[player.weapon];
    const results: BulletState[] = [];
    const spreadRad = (stats.spreadDeg * Math.PI) / 180;
    const stepSpeed = stats.speedPxPerSec / PhysicsEngine.TICKS_PER_SECOND;
    const muzzleDist =
      PhysicsEngine.PLAYER_RADIUS + PhysicsEngine.BULLET_RADIUS + 4;

    for (let i = 0; i < stats.projectiles; i++) {
      let shotAngle = player.angle;

      if (stats.projectiles > 1 && stats.fanSpread) {
        const t = i / (stats.projectiles - 1) - 0.5; // [-0.5, +0.5]
        shotAngle += t * spreadRad;
      } else if (spreadRad > 0) {
        shotAngle += (Math.random() - 0.5) * spreadRad;
      }

      const cos = Math.cos(shotAngle);
      const sin = Math.sin(shotAngle);

      // Evitar que el cañón atraviese muros/obstáculos si el jugador dispara pegado a ellos
      const desiredX = player.body.position.x + cos * muzzleDist;
      const desiredY = player.body.position.y + sin * muzzleDist;

      const staticBodies = [
        ...this.borderWalls,
        ...Array.from(this.obstacles.values()).map((o) => o.body),
      ];
      const rayHits = Matter.Query.ray(
        staticBodies,
        player.body.position,
        { x: desiredX, y: desiredY },
        PhysicsEngine.BULLET_RADIUS * 2
      );

      const actualOffset = rayHits.length > 0 ? 6 : muzzleDist;
      const spawnX = Math.max(
        PhysicsEngine.BULLET_RADIUS + 1,
        Math.min(
          this.mapWidth - PhysicsEngine.BULLET_RADIUS - 1,
          player.body.position.x + cos * actualOffset
        )
      );
      const spawnY = Math.max(
        PhysicsEngine.BULLET_RADIUS + 1,
        Math.min(
          this.mapHeight - PhysicsEngine.BULLET_RADIUS - 1,
          player.body.position.y + sin * actualOffset
        )
      );

      const vxStep = cos * stepSpeed;
      const vyStep = sin * stepSpeed;
      const vxPxSec = cos * stats.speedPxPerSec;
      const vyPxSec = sin * stats.speedPxPerSec;

      const bulletId = `b_${++this.bulletSeq}_${now}`;
      const body = Matter.Bodies.circle(
        spawnX,
        spawnY,
        PhysicsEngine.BULLET_RADIUS,
        {
          label: `bullet:${bulletId}`,
          restitution: 1,
          friction: 0,
          frictionStatic: 0,
          frictionAir: 0,
          inertia: Infinity,
          slop: 0,
          collisionFilter: {
            category: CATEGORY_BULLET,
            mask: CATEGORY_WALL | CATEGORY_OBSTACLE,
          },
        }
      );

      Matter.Body.setVelocity(body, { x: vxStep, y: vyStep });
      Matter.Composite.add(this.world, body);

      this.bullets.set(bulletId, {
        id: bulletId,
        ownerId: player.id,
        weaponType: stats.type,
        body,
        stepSpeed,
        speedPxPerSec: stats.speedPxPerSec,
        baseDamage: stats.damage,
        maxRangePx: stats.maxRangePx,
        distanceTraveled: 0,
        bounces: 0,
        prevX: spawnX,
        prevY: spawnY,
      });

      results.push({
        id: bulletId,
        ownerId: player.id,
        x: spawnX,
        y: spawnY,
        vx: vxPxSec,
        vy: vyPxSec,
        weaponType: stats.type,
      });
    }

    return results;
  }

  /**
   * Ejecuta un paso de simulación a 60 Hz con sub-stepping para precisión continua
   * en proyectiles rápidos (p. ej. sniper a 1350 px/s).
   */
  public update(deltaMs: number = 1000 / 60): void {
    const clampedDelta = Math.min(deltaMs, 1000 / PhysicsEngine.TICKS_PER_SECOND);
    const subDelta = clampedDelta / PhysicsEngine.SUBSTEPS;

    for (let step = 0; step < PhysicsEngine.SUBSTEPS; step++) {
      for (const bullet of this.bullets.values()) {
        bullet.prevX = bullet.body.position.x;
        bullet.prevY = bullet.body.position.y;
      }

      Matter.Engine.update(this.engine, subDelta);

      // 1. Procesar impactos contra muros/troncos/rocas y cajas registrados en Matter.js
      this.flushEnvironmentHits();

      // 2. Detección continua (segmento-círculo) de balas contra jugadores enemigos vivos
      this.checkBulletPlayerHits();

      // 3. Actualizar distancia recorrida, alcance máximo y normalización de velocidad tras rebote
      for (const [bulletId, bullet] of this.bullets.entries()) {
        if (this.bulletsToDestroy.has(bulletId)) continue;

        const dx = bullet.body.position.x - bullet.prevX;
        const dy = bullet.body.position.y - bullet.prevY;
        bullet.distanceTraveled += Math.hypot(dx, dy);

        if (bullet.distanceTraveled >= bullet.maxRangePx) {
          this.bulletsToDestroy.add(bulletId);
          continue;
        }

        this.normalizeBulletVelocity(bullet);
      }

      // 4. Limpiar balas destruidas en este sub-step
      if (this.bulletsToDestroy.size > 0) {
        for (const bulletId of this.bulletsToDestroy) {
          this.removeBullet(bulletId);
        }
        this.bulletsToDestroy.clear();
      }
    }

    // 5. Recolección de botín (< 42 px automático o <= 52 px con interact)
    this.checkLootPickups();

    // 6. Mantener velocidad angular 0 en los jugadores vivos
    for (const player of this.players.values()) {
      if (player.alive) {
        Matter.Body.setAngularVelocity(player.body, 0);
      }
    }
  }

  private flushEnvironmentHits(): void {
    if (this.pendingWallHits.length > 0) {
      const hits = [...this.pendingWallHits];
      this.pendingWallHits = [];
      for (const hit of hits) {
        this.callbacks.onBulletHit?.(hit);
      }
    }

    if (this.pendingCrateHits.length > 0) {
      const crateHits = [...this.pendingCrateHits];
      this.pendingCrateHits = [];

      for (const hit of crateHits) {
        this.callbacks.onBulletHit?.({
          x: hit.hitX,
          y: hit.hitY,
          targetType: "crate",
        });

        const obs = this.obstacles.get(hit.obstacleId);
        if (!obs) continue;

        obs.state.hp = Math.max(0, obs.state.hp - hit.damage);

        if (obs.state.hp <= 0) {
          const { id, x, y } = obs.state;
          Matter.Composite.remove(this.world, obs.body);
          this.obstacles.delete(id);

          const loot = ArenaGenerator.generateLootFromCrate(x, y);
          this.lootItems.set(loot.id, loot);

          this.callbacks.onCrateDestroyed?.({ id, x, y }, loot);
        } else {
          this.callbacks.onObstacleDamaged?.(obs.state.id, obs.state.hp);
        }
      }
    }
  }

  private checkBulletPlayerHits(): void {
    const hitRadius = PhysicsEngine.PLAYER_RADIUS + PhysicsEngine.BULLET_RADIUS;
    const hitRadiusSq = hitRadius * hitRadius;
    const damageMultiplier = this.modifier === "double_damage" ? 2 : 1;

    for (const [bulletId, bullet] of this.bullets.entries()) {
      if (this.bulletsToDestroy.has(bulletId)) continue;

      const x1 = bullet.prevX;
      const y1 = bullet.prevY;
      const x2 = bullet.body.position.x;
      const y2 = bullet.body.position.y;

      for (const victim of this.players.values()) {
        if (!victim.alive || victim.id === bullet.ownerId) continue;

        const px = victim.body.position.x;
        const py = victim.body.position.y;

        const closest = this.closestPointOnSegment(x1, y1, x2, y2, px, py);
        const dx = px - closest.x;
        const dy = py - closest.y;

        if (dx * dx + dy * dy <= hitRadiusSq) {
          this.bulletsToDestroy.add(bulletId);

          const totalDamage = bullet.baseDamage * damageMultiplier;
          victim.hp = Math.max(0, victim.hp - totalDamage);

          this.callbacks.onBulletHit?.({
            x: closest.x,
            y: closest.y,
            targetType: "player",
          });
          this.callbacks.onPlayerDamaged?.(victim.id, victim.hp);

          if (victim.hp <= 0) {
            victim.alive = false;
            const elimX = victim.body.position.x;
            const elimY = victim.body.position.y;
            Matter.Composite.remove(this.world, victim.body);

            // Modificador "vampire": cura +25 HP al atacante sin superar maxHp (100)
            if (this.modifier === "vampire") {
              const killer = this.players.get(bullet.ownerId);
              if (killer && killer.alive) {
                killer.hp = Math.min(
                  killer.maxHp,
                  killer.hp + PhysicsEngine.VAMPIRE_HEAL_AMOUNT
                );
                this.callbacks.onPlayerHealed?.(killer.id, killer.hp);
              }
            }

            this.callbacks.onPlayerEliminated?.({
              victimId: victim.id,
              killerId: bullet.ownerId,
              x: elimX,
              y: elimY,
            });
          }

          break;
        }
      }
    }
  }

  private checkLootPickups(): void {
    if (this.lootItems.size === 0) return;

    const autoRadiusSq =
      PhysicsEngine.LOOT_AUTO_PICKUP_RADIUS *
      PhysicsEngine.LOOT_AUTO_PICKUP_RADIUS;
    const interactRadiusSq =
      PhysicsEngine.LOOT_INTERACT_RADIUS *
      PhysicsEngine.LOOT_INTERACT_RADIUS;

    for (const [lootId, loot] of Array.from(this.lootItems.entries())) {
      for (const player of this.players.values()) {
        if (!player.alive) continue;

        const dx = player.body.position.x - loot.x;
        const dy = player.body.position.y - loot.y;
        const distSq = dx * dx + dy * dy;

        const thresholdSq = player.interactPressed
          ? interactRadiusSq
          : autoRadiusSq;

        if (distSq < thresholdSq) {
          if (loot.kind === "medkit") {
            player.hp = Math.min(
              player.maxHp,
              player.hp + PhysicsEngine.MEDKIT_HEAL_AMOUNT
            );
            this.callbacks.onPlayerHealed?.(player.id, player.hp);
          } else if (loot.kind === "weapon" && loot.weaponType) {
            player.weapon = loot.weaponType;
            this.callbacks.onPlayerWeaponChanged?.(player.id, loot.weaponType);
          }

          this.lootItems.delete(lootId);
          this.callbacks.onLootPickedUp?.(lootId, player.id);
          break;
        }
      }
    }
  }

  private normalizeBulletVelocity(bullet: InternalBullet): void {
    const vel = bullet.body.velocity;
    const currentSpeed = Math.hypot(vel.x, vel.y);

    if (currentSpeed < 0.0001) {
      const randomAngle = Math.random() * Math.PI * 2;
      Matter.Body.setVelocity(bullet.body, {
        x: Math.cos(randomAngle) * bullet.stepSpeed,
        y: Math.sin(randomAngle) * bullet.stepSpeed,
      });
      return;
    }

    if (Math.abs(currentSpeed - bullet.stepSpeed) > 0.0005) {
      const scale = bullet.stepSpeed / currentSpeed;
      Matter.Body.setVelocity(bullet.body, {
        x: vel.x * scale,
        y: vel.y * scale,
      });
    }
  }

  private registerCollisionEvents(): void {
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      const damageMultiplier = this.modifier === "double_damage" ? 2 : 1;

      for (const pair of event.pairs) {
        const bulletBody = this.extractBodyByPrefix(
          pair.bodyA,
          pair.bodyB,
          "bullet:"
        );
        if (!bulletBody) continue;

        const otherBody = bulletBody === pair.bodyA ? pair.bodyB : pair.bodyA;
        const bulletId = bulletBody.label.slice("bullet:".length);
        const bullet = this.bullets.get(bulletId);
        if (!bullet || this.bulletsToDestroy.has(bulletId)) continue;

        const hitX = bulletBody.position.x;
        const hitY = bulletBody.position.y;

        if (otherBody.label === "border_wall") {
          if (
            this.modifier === "ricochet" &&
            bullet.bounces < PhysicsEngine.MAX_RICOCHET_BOUNCES
          ) {
            bullet.bounces += 1;
          } else {
            this.bulletsToDestroy.add(bulletId);
            this.pendingWallHits.push({ x: hitX, y: hitY, targetType: "wall" });
          }
          continue;
        }

        if (otherBody.label.startsWith("obstacle:")) {
          const obstacleId = otherBody.label.slice("obstacle:".length);
          const obs = this.obstacles.get(obstacleId);
          if (!obs) continue;

          if (obs.state.type === "rock") {
            if (
              this.modifier === "ricochet" &&
              bullet.bounces < PhysicsEngine.MAX_RICOCHET_BOUNCES
            ) {
              bullet.bounces += 1;
            } else {
              this.bulletsToDestroy.add(bulletId);
              this.pendingWallHits.push({ x: hitX, y: hitY, targetType: "wall" });
            }
          } else if (obs.state.type === "tree") {
            this.bulletsToDestroy.add(bulletId);
            this.pendingWallHits.push({ x: hitX, y: hitY, targetType: "wall" });
          } else if (obs.state.type === "crate") {
            this.bulletsToDestroy.add(bulletId);
            this.pendingCrateHits.push({
              obstacleId,
              damage: bullet.baseDamage * damageMultiplier,
              hitX,
              hitY,
            });
          }
        }
      }
    });

    Matter.Events.on(this.engine, "collisionEnd", (event) => {
      for (const pair of event.pairs) {
        const bulletBody = this.extractBodyByPrefix(
          pair.bodyA,
          pair.bodyB,
          "bullet:"
        );
        if (!bulletBody) continue;
        const bulletId = bulletBody.label.slice("bullet:".length);
        const bullet = this.bullets.get(bulletId);
        if (bullet && !this.bulletsToDestroy.has(bulletId)) {
          this.normalizeBulletVelocity(bullet);
        }
      }
    });
  }

  public removeBullet(bulletId: string): void {
    const bullet = this.bullets.get(bulletId);
    if (!bullet) return;
    Matter.Composite.remove(this.world, bullet.body);
    this.bullets.delete(bulletId);
    this.callbacks.onBulletRemoved?.(bulletId);
  }

  public getPlayerSnapshot(id: string): {
    x: number;
    y: number;
    angle: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    weapon: WeaponType;
  } | null {
    const p = this.players.get(id);
    if (!p) return null;
    return {
      x: p.body.position.x,
      y: p.body.position.y,
      angle: p.angle,
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      weapon: p.weapon,
    };
  }

  public getActiveBullets(): BulletState[] {
    const list: BulletState[] = [];
    for (const b of this.bullets.values()) {
      list.push({
        id: b.id,
        ownerId: b.ownerId,
        x: b.body.position.x,
        y: b.body.position.y,
        vx: b.body.velocity.x * PhysicsEngine.TICKS_PER_SECOND,
        vy: b.body.velocity.y * PhysicsEngine.TICKS_PER_SECOND,
        weaponType: b.weaponType,
      });
    }
    return list;
  }

  public resetArena(): void {
    for (const bId of Array.from(this.bullets.keys())) {
      this.removeBullet(bId);
    }
    this.bulletsToDestroy.clear();
    this.pendingWallHits = [];
    this.pendingCrateHits = [];

    for (const p of this.players.values()) {
      Matter.Composite.remove(this.world, p.body);
    }
    this.players.clear();

    for (const obs of this.obstacles.values()) {
      Matter.Composite.remove(this.world, obs.body);
    }
    this.obstacles.clear();

    if (this.borderWalls.length > 0) {
      Matter.Composite.remove(this.world, this.borderWalls);
      this.borderWalls = [];
    }

    this.lootItems.clear();
  }

  private closestPointOnSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    px: number,
    py: number
  ): { x: number; y: number } {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.000001) {
      return { x: x1, y: y1 };
    }
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return {
      x: x1 + t * dx,
      y: y1 + t * dy,
    };
  }

  private extractBodyByPrefix(
    bodyA: Matter.Body,
    bodyB: Matter.Body,
    prefix: string
  ): Matter.Body | null {
    if (bodyA.label.startsWith(prefix)) return bodyA;
    if (bodyB.label.startsWith(prefix)) return bodyB;
    return null;
  }
}
