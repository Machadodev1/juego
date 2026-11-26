import Matter from "matter-js";
import type {
  AbilityType,
  BulletHitEvent,
  BulletState,
  CrateDestroyedEvent,
  ExplosionEvent,
  HazardZoneState,
  KillFeedEvent,
  LootItemState,
  ObstacleState,
  PlayerEliminatedEvent,
  PlayerInput,
  RoundModifier,
  WeaponType,
} from "@shared/types";
import { ArenaGenerator } from "./ArenaGenerator";
import { ABILITY_COOLDOWNS_MS, WEAPON_CONFIGS } from "./WeaponConfig";

export interface PhysicsPlayerSnapshot {
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  alive: boolean;
  isDowned: boolean;
  downedTimerMs: number;
  weapon: WeaponType;
  ability: AbilityType;
  abilityCooldownMs: number;
  shieldActive: boolean;
  hasHotPotato: boolean;
  hotPotatoTimerMs: number;
  isInvisible: boolean;
  isAirborne: boolean;
}

export interface PhysicsCallbacks {
  onBulletHit?: (event: BulletHitEvent) => void;
  onExplosion?: (event: ExplosionEvent) => void;
  onCrateDestroyed?: (
    event: CrateDestroyedEvent,
    spawnedLoot: LootItemState[]
  ) => void;
  onObstacleUpdated?: (obstacle: ObstacleState) => void;
  onObstacleRemoved?: (obstacleId: string) => void;
  onHazardSpawned?: (zone: HazardZoneState) => void;
  onHazardUpdated?: (zone: HazardZoneState) => void;
  onHazardRemoved?: (zoneId: string) => void;
  onLootSpawned?: (loot: LootItemState) => void;
  onLootPickedUp?: (lootId: string, playerId: string) => void;
  onBulletRemoved?: (bulletId: string) => void;
  onPlayerEliminated?: (
    event: PlayerEliminatedEvent,
    killFeed: KillFeedEvent,
    victimHadBounty: boolean
  ) => void;
}

interface InternalPlayer {
  id: string;
  name: string;
  body: Matter.Body;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  alive: boolean;
  isDowned: boolean;
  downedTimerMs: number;
  downedBodyHp: number;
  lastAttackerId: string;
  lastAttackerWeapon: string;
  hasBounty: boolean;
  weapon: WeaponType;
  ability: AbilityType;
  abilityCooldownMs: number;
  shieldActive: boolean;
  shieldTimerMs: number;
  hasHotPotato: boolean;
  hotPotatoTimerMs: number;
  potatoImmunityMs: number;
  isInvisible: boolean;
  isAirborne: boolean;
  airborneTimerMs: number;
  jumpPadCooldownMs: number;
  dashTimerMs: number;
  dashDirX: number;
  dashDirY: number;
  invulnTimerMs: number;
  grappleTimerMs: number;
  grappleTargetX: number;
  grappleTargetY: number;
  moveVx: number;
  moveVy: number;
  externalVx: number;
  externalVy: number;
  lastShootTime: number;
  lastFlameZoneTime: number;
  wasInteracting: boolean;
  interactTriggered: boolean;
  wasUsingAbility: boolean;
  abilityTriggered: boolean;
  fireDamageAccumMs: number;
  stormDamageAccumMs: number;
}

interface InternalObstacle {
  state: ObstacleState;
  body: Matter.Body | null;
  mimicFuseMs: number;
}

interface InternalHazardZone {
  state: HazardZoneState;
  armTimerMs: number;
}

interface InternalBullet {
  id: string;
  ownerId: string;
  firedWhileDowned: boolean;
  weaponType: WeaponType;
  body: Matter.Body;
  radius: number;
  scale: number;
  isHoming: boolean;
  isBoomerang: boolean;
  returningToOwner: boolean;
  spawnTimeMs: number;
  stepSpeed: number;
  speedPxPerSec: number;
  baseDamage: number;
  maxRangePx: number;
  distanceTraveled: number;
  bounces: number;
  maxBounces: number;
  prevX: number;
  prevY: number;
}

const CATEGORY_WALL = 0x0001;
const CATEGORY_OBSTACLE = 0x0002;
const CATEGORY_PLAYER = 0x0004;
const CATEGORY_BULLET = 0x0008;

const NON_SOLID_OBSTACLES = new Set<ObstacleState["type"]>([
  "bush",
  "jump_pad",
]);

export class PhysicsEngine {
  public static readonly TICKS_PER_SECOND = 60;
  public static readonly SUBSTEPS = 2;

  public static readonly PLAYER_RADIUS = 22;
  public static readonly PLAYER_MAX_HP = 100;
  public static readonly PLAYER_MAX_SHIELD = 50;
  public static readonly PLAYER_BASE_SPEED_PX_S = 265;
  public static readonly SPEED_BOOST_MULTIPLIER = 1.4;

  public static readonly RICOCHET_BOUNCES = 2;
  public static readonly MEDKIT_HEAL_AMOUNT = 35;
  public static readonly DEFAULT_SHIELD_AMOUNT = 25;
  public static readonly VAMPIRE_HEAL_AMOUNT = 25;

  public static readonly AUTO_LOOT_RADIUS = 38;
  public static readonly INTERACT_LOOT_RADIUS = 58;

  public static readonly STORM_START_MS = 35000;
  public static readonly STORM_SHRINK_PX_PER_SEC = 24;
  public static readonly STORM_MIN_RADIUS = 110;
  public static readonly STORM_DPS = 8;

  private engine: Matter.Engine;
  private world: Matter.World;
  private callbacks: PhysicsCallbacks;

  private mapWidth: number = ArenaGenerator.MAP_WIDTH;
  private mapHeight: number = ArenaGenerator.MAP_HEIGHT;
  private modifier: RoundModifier = "normal";

  private roundElapsedMs: number = 0;
  private stormX: number = 800;
  private stormY: number = 600;
  private stormRadius: number = 1100;

  private borderWalls: Matter.Body[] = [];
  private players: Map<string, InternalPlayer> = new Map();
  private obstacles: Map<string, InternalObstacle> = new Map();
  private hazardZones: Map<string, InternalHazardZone> = new Map();
  private lootItems: Map<string, LootItemState> = new Map();
  private bullets: Map<string, InternalBullet> = new Map();

  private bulletsToDestroy: Set<string> = new Set();
  private pendingWallHits: BulletHitEvent[] = [];
  private pendingObstacleHits: Array<{
    obstacleId: string;
    damage: number;
    hitX: number;
    hitY: number;
    ownerId: string;
    weaponType: WeaponType;
  }> = [];
  private pendingGrapplePulls: Array<{
    playerId: string;
    targetX: number;
    targetY: number;
  }> = [];
  private pendingFlameZones: Array<{
    ownerId: string;
    x: number;
    y: number;
  }> = [];

  private bulletSeq = 0;
  private hazardSeq = 0;
  private simNowMs = 0;

  constructor(callbacks: PhysicsCallbacks = {}) {
    this.callbacks = callbacks;
    (Matter.Resolver as unknown as { _restingThresh: number })._restingThresh =
      0.001;
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

  public getStormState(): {
    stormX: number;
    stormY: number;
    stormRadius: number;
  } {
    return {
      stormX: this.stormX,
      stormY: this.stormY,
      stormRadius: this.stormRadius,
    };
  }

  public loadArena(
    mapWidth: number,
    mapHeight: number,
    obstacles: ObstacleState[]
  ): void {
    this.resetArena();
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.roundElapsedMs = 0;
    this.stormX = mapWidth / 2;
    this.stormY = mapHeight / 2;
    this.stormRadius = Math.round(
      Math.hypot(mapWidth / 2, mapHeight / 2) + 80
    );

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
      Matter.Bodies.rectangle(
        mapWidth / 2,
        -halfT,
        mapWidth + wallThickness * 2,
        wallThickness,
        borderWallOptions
      ),
      Matter.Bodies.rectangle(
        mapWidth / 2,
        mapHeight + halfT,
        mapWidth + wallThickness * 2,
        wallThickness,
        borderWallOptions
      ),
      Matter.Bodies.rectangle(
        -halfT,
        mapHeight / 2,
        wallThickness,
        mapHeight + wallThickness * 2,
        borderWallOptions
      ),
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
      const stateCopy: ObstacleState = { ...obs, awake: Boolean(obs.awake) };
      let body: Matter.Body | null = null;

      if (!NON_SOLID_OBSTACLES.has(obs.type)) {
        body = Matter.Bodies.circle(obs.x, obs.y, obs.radius, {
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
        Matter.Composite.add(this.world, body);
      }

      this.obstacles.set(obs.id, {
        state: stateCopy,
        body,
        mimicFuseMs: 4000,
      });
    }
  }

  public spawnPlayer(
    id: string,
    name: string,
    x: number,
    y: number,
    angle: number,
    weapon: WeaponType = "pistol",
    ability: AbilityType = "dash",
    hasBounty = false
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
      name,
      body,
      angle,
      hp: PhysicsEngine.PLAYER_MAX_HP,
      maxHp: PhysicsEngine.PLAYER_MAX_HP,
      shield: 0,
      maxShield: PhysicsEngine.PLAYER_MAX_SHIELD,
      alive: true,
      isDowned: false,
      downedTimerMs: 0,
      downedBodyHp: 40,
      lastAttackerId: "",
      lastAttackerWeapon: "Tormenta",
      hasBounty,
      weapon,
      ability,
      abilityCooldownMs: 0,
      shieldActive: false,
      shieldTimerMs: 0,
      hasHotPotato: false,
      hotPotatoTimerMs: 0,
      potatoImmunityMs: 0,
      isInvisible: false,
      isAirborne: false,
      airborneTimerMs: 0,
      jumpPadCooldownMs: 0,
      dashTimerMs: 0,
      dashDirX: 0,
      dashDirY: 0,
      invulnTimerMs: 0,
      grappleTimerMs: 0,
      grappleTargetX: x,
      grappleTargetY: y,
      moveVx: 0,
      moveVy: 0,
      externalVx: 0,
      externalVy: 0,
      lastShootTime: -Infinity,
      lastFlameZoneTime: -Infinity,
      wasInteracting: false,
      interactTriggered: false,
      wasUsingAbility: false,
      abilityTriggered: false,
      fireDamageAccumMs: 0,
      stormDamageAccumMs: 0,
    });
  }

  public assignHotPotato(playerId?: string): string | null {
    const aliveList = Array.from(this.players.values()).filter(
      (p) => p.alive && !p.isDowned
    );
    if (aliveList.length === 0) return null;

    for (const p of this.players.values()) {
      p.hasHotPotato = false;
      p.hotPotatoTimerMs = 0;
    }

    const chosen =
      (playerId ? this.players.get(playerId) : undefined) ??
      aliveList[Math.floor(Math.random() * aliveList.length)];
    if (!chosen || !chosen.alive) return null;

    chosen.hasHotPotato = true;
    chosen.hotPotatoTimerMs = 12000;
    chosen.potatoImmunityMs = 300;
    return chosen.id;
  }

  public setPlayerAbility(id: string, ability: AbilityType): void {
    const p = this.players.get(id);
    if (p) {
      p.ability = ability;
    }
  }

  public setPlayerName(id: string, name: string): void {
    const p = this.players.get(id);
    if (p) {
      p.name = name;
    }
  }

  public removePlayer(id: string): void {
    const existing = this.players.get(id);
    if (existing) {
      Matter.Composite.remove(this.world, existing.body);
      this.players.delete(id);
    }
  }

  public spawnLoot(loot: LootItemState): void {
    this.lootItems.set(loot.id, loot);
    this.callbacks.onLootSpawned?.(loot);
  }

  public applyPlayerInput(
    playerId: string,
    input: PlayerInput,
    now: number = Date.now()
  ): BulletState[] {
    this.simNowMs = now;
    const player = this.players.get(playerId);
    if (!player || !player.alive) {
      return [];
    }

    if (typeof input.angle === "number" && Number.isFinite(input.angle)) {
      player.angle = Math.atan2(Math.sin(input.angle), Math.cos(input.angle));
    }

    // Dirección deseada de movimiento (8 direcciones)
    let dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(dirX, dirY);
    if (len > 0) {
      dirX /= len;
      dirY /= len;
    }

    let speedMult =
      this.modifier === "speed_boost"
        ? PhysicsEngine.SPEED_BOOST_MULTIPLIER
        : 1;
    if (player.isDowned) {
      speedMult *= 0.38;
    } else if (player.isAirborne) {
      speedMult *= 1.25;
    }

    const targetVx = dirX * PhysicsEngine.PLAYER_BASE_SPEED_PX_S * speedMult;
    const targetVy = dirY * PhysicsEngine.PLAYER_BASE_SPEED_PX_S * speedMult;

    const onOil = !player.isAirborne && this.isPlayerInZone(player, "oil");
    if (onOil) {
      // Patinaje resbaladizo sobre aceite
      if (len > 0) {
        player.moveVx += (targetVx * 1.22 - player.moveVx) * 0.065;
        player.moveVy += (targetVy * 1.22 - player.moveVy) * 0.065;
      } else {
        player.moveVx *= 0.985;
        player.moveVy *= 0.985;
      }
    } else if (this.modifier === "sniper_zero_g") {
      if (len > 0) {
        player.moveVx += (targetVx - player.moveVx) * 0.14;
        player.moveVy += (targetVy - player.moveVy) * 0.14;
      } else {
        player.moveVx *= 0.96;
        player.moveVy *= 0.96;
      }
    } else {
      player.moveVx = targetVx;
      player.moveVy = targetVy;
    }

    // Flanco de tecla E (interact)
    const curInteract = Boolean(input.interact);
    if (curInteract && !player.wasInteracting) {
      player.interactTriggered = true;
    }
    player.wasInteracting = curInteract;

    // Flanco de Habilidad Activa (useAbility)
    const curAbility = Boolean(input.useAbility);
    if (curAbility && !player.wasUsingAbility) {
      player.abilityTriggered = true;
    }
    player.wasUsingAbility = curAbility;

    if (
      player.abilityTriggered &&
      !player.isDowned &&
      player.abilityCooldownMs <= 0
    ) {
      this.activatePlayerAbility(player, dirX, dirY);
      player.abilityTriggered = false;
    }

    // Disparo (si está en Último Aliento usa pistolita de 8 DMG)
    const spawnedBullets: BulletState[] = [];
    if (player.isDowned) {
      const downedCooldown = 420;
      if (input.shoot && now - player.lastShootTime >= downedCooldown) {
        player.lastShootTime = now;
        spawnedBullets.push(...this.spawnDownedBullet(player, now));
      }
    } else {
      const stats = WEAPON_CONFIGS[player.weapon];
      const effectiveCooldown =
        this.modifier === "tiny_shotgun" && player.weapon === "shotgun"
          ? Math.round(stats.cooldownMs * 0.52)
          : stats.cooldownMs;

      if (input.shoot && now - player.lastShootTime >= effectiveCooldown) {
        player.lastShootTime = now;
        spawnedBullets.push(...this.spawnWeaponProjectiles(player, now));
      }
    }

    return spawnedBullets;
  }

  private activatePlayerAbility(
    player: InternalPlayer,
    moveDirX: number,
    moveDirY: number
  ): void {
    player.abilityCooldownMs = ABILITY_COOLDOWNS_MS[player.ability] ?? 5000;
    const px = player.body.position.x;
    const py = player.body.position.y;

    switch (player.ability) {
      case "dash": {
        const hasMove = Math.hypot(moveDirX, moveDirY) > 0.1;
        player.dashDirX = hasMove ? moveDirX : Math.cos(player.angle);
        player.dashDirY = hasMove ? moveDirY : Math.sin(player.angle);
        player.dashTimerMs = 175;
        player.invulnTimerMs = 150;
        break;
      }
      case "energy_shield": {
        player.shieldActive = true;
        player.shieldTimerMs = 2500;
        break;
      }
      case "proximity_mine": {
        this.createHazardZone({
          type: "mine",
          ownerId: player.id,
          x: px,
          y: py,
          radius: 34,
          ttlMs: 25000,
          armed: false,
          armDelayMs: 650,
        });
        break;
      }
      case "smoke_grenade": {
        const throwDist = 175;
        const tx = Math.max(
          80,
          Math.min(this.mapWidth - 80, px + Math.cos(player.angle) * throwDist)
        );
        const ty = Math.max(
          80,
          Math.min(this.mapHeight - 80, py + Math.sin(player.angle) * throwDist)
        );
        this.createHazardZone({
          type: "smoke",
          ownerId: player.id,
          x: tx,
          y: ty,
          radius: 108,
          ttlMs: 7500,
          armed: true,
          armDelayMs: 0,
        });
        break;
      }
    }
  }

  private createHazardZone(opts: {
    type: HazardZoneState["type"];
    ownerId: string;
    x: number;
    y: number;
    radius: number;
    ttlMs: number;
    armed: boolean;
    armDelayMs: number;
  }): HazardZoneState {
    const id = `haz_${opts.type}_${++this.hazardSeq}`;
    const state: HazardZoneState = {
      id,
      type: opts.type,
      ownerId: opts.ownerId,
      x: Math.round(opts.x),
      y: Math.round(opts.y),
      radius: opts.radius,
      ttlMs: opts.ttlMs,
      armed: opts.armed,
    };
    this.hazardZones.set(id, {
      state,
      armTimerMs: opts.armDelayMs,
    });
    this.callbacks.onHazardSpawned?.({ ...state });

    if (opts.type === "fire") {
      this.igniteOverlappingOil(state.x, state.y, state.radius, opts.ownerId);
    }
    return state;
  }

  private igniteOverlappingOil(
    x: number,
    y: number,
    radius: number,
    attackerId: string
  ): void {
    for (const hz of this.hazardZones.values()) {
      if (hz.state.type !== "oil") continue;
      const dist = Math.hypot(hz.state.x - x, hz.state.y - y);
      if (dist <= radius + hz.state.radius) {
        hz.state.type = "fire";
        hz.state.ttlMs = 6500;
        hz.state.ownerId = attackerId || hz.state.ownerId;
        this.callbacks.onHazardUpdated?.({ ...hz.state });
      }
    }
  }

  private spawnDownedBullet(
    player: InternalPlayer,
    now: number
  ): BulletState[] {
    const scale = this.modifier === "giant_bullets" ? 4 : 0.85;
    const bulletRadius =
      4 * (this.modifier === "giant_bullets" ? 3.2 : 1);
    const speedPxPerSec =
      560 * (this.modifier === "giant_bullets" ? 0.48 : 1);
    const stepSpeed = speedPxPerSec / PhysicsEngine.TICKS_PER_SECOND;
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    const muzzleDist = PhysicsEngine.PLAYER_RADIUS + bulletRadius + 4;
    const spawnX = Math.max(
      bulletRadius + 2,
      Math.min(
        this.mapWidth - bulletRadius - 2,
        player.body.position.x + cos * muzzleDist
      )
    );
    const spawnY = Math.max(
      bulletRadius + 2,
      Math.min(
        this.mapHeight - bulletRadius - 2,
        player.body.position.y + sin * muzzleDist
      )
    );

    const bulletId = `b_${++this.bulletSeq}_${now}`;
    const body = Matter.Bodies.circle(spawnX, spawnY, bulletRadius, {
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
    });
    Matter.Body.setVelocity(body, { x: cos * stepSpeed, y: sin * stepSpeed });
    Matter.Composite.add(this.world, body);

    this.bullets.set(bulletId, {
      id: bulletId,
      ownerId: player.id,
      firedWhileDowned: true,
      weaponType: "pistol",
      body,
      radius: bulletRadius,
      scale,
      isHoming: false,
      isBoomerang: false,
      returningToOwner: false,
      spawnTimeMs: now,
      stepSpeed,
      speedPxPerSec,
      baseDamage: 8,
      maxRangePx: 540,
      distanceTraveled: 0,
      bounces: 0,
      maxBounces:
        this.modifier === "ricochet" ? PhysicsEngine.RICOCHET_BOUNCES : 0,
      prevX: spawnX,
      prevY: spawnY,
    });

    return [
      {
        id: bulletId,
        ownerId: player.id,
        x: spawnX,
        y: spawnY,
        vx: cos * speedPxPerSec,
        vy: sin * speedPxPerSec,
        weaponType: "pistol",
        scale,
        isHoming: false,
        isBoomerang: false,
      },
    ];
  }

  private spawnWeaponProjectiles(
    player: InternalPlayer,
    now: number
  ): BulletState[] {
    const stats = WEAPON_CONFIGS[player.weapon];
    const results: BulletState[] = [];
    const spreadRad = (stats.spreadDeg * Math.PI) / 180;

    const isGiant = this.modifier === "giant_bullets";
    const scale = isGiant ? 4 : 1;
    const speedPxPerSec = stats.speedPxPerSec * (isGiant ? 0.48 : 1);
    const stepSpeed = speedPxPerSec / PhysicsEngine.TICKS_PER_SECOND;
    const bulletRadius = stats.baseRadius * (isGiant ? 3.1 : 1);
    const muzzleDist = PhysicsEngine.PLAYER_RADIUS + bulletRadius + 4;

    const extraRicochet =
      this.modifier === "ricochet" ? PhysicsEngine.RICOCHET_BOUNCES : 0;
    const maxBounces = (stats.naturalBounces ?? 0) + extraRicochet;

    // Retroceso propio al disparar (impulse_gun o mutador sniper_zero_g)
    const recoilStrength =
      this.modifier === "sniper_zero_g"
        ? 780
        : stats.selfRecoil ?? 0;
    if (recoilStrength > 0) {
      player.externalVx -= Math.cos(player.angle) * recoilStrength;
      player.externalVy -= Math.sin(player.angle) * recoilStrength;
    }

    const staticBodies = [
      ...this.borderWalls,
      ...Array.from(this.obstacles.values())
        .map((o) => o.body)
        .filter((b): b is Matter.Body => b !== null),
    ];

    for (let i = 0; i < stats.projectiles; i++) {
      let shotAngle = player.angle;
      if (stats.projectiles > 1 && stats.fanSpread) {
        const t = i / (stats.projectiles - 1) - 0.5;
        shotAngle += t * spreadRad;
      } else if (spreadRad > 0) {
        shotAngle += (Math.random() - 0.5) * spreadRad;
      }

      const cos = Math.cos(shotAngle);
      const sin = Math.sin(shotAngle);
      const desiredX = player.body.position.x + cos * muzzleDist;
      const desiredY = player.body.position.y + sin * muzzleDist;

      const rayHits = Matter.Query.ray(
        staticBodies,
        player.body.position,
        { x: desiredX, y: desiredY },
        bulletRadius * 1.6
      );

      const actualOffset = rayHits.length > 0 ? 6 : muzzleDist;
      const spawnX = Math.max(
        bulletRadius + 2,
        Math.min(
          this.mapWidth - bulletRadius - 2,
          player.body.position.x + cos * actualOffset
        )
      );
      const spawnY = Math.max(
        bulletRadius + 2,
        Math.min(
          this.mapHeight - bulletRadius - 2,
          player.body.position.y + sin * actualOffset
        )
      );

      const bulletId = `b_${++this.bulletSeq}_${now}`;
      const body = Matter.Bodies.circle(spawnX, spawnY, bulletRadius, {
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
      });

      Matter.Body.setVelocity(body, {
        x: cos * stepSpeed,
        y: sin * stepSpeed,
      });
      Matter.Composite.add(this.world, body);

      const isHoming = Boolean(stats.isHoming);
      const isBoomerang = Boolean(stats.isBoomerang);

      this.bullets.set(bulletId, {
        id: bulletId,
        ownerId: player.id,
        firedWhileDowned: false,
        weaponType: stats.type,
        body,
        radius: bulletRadius,
        scale,
        isHoming,
        isBoomerang,
        returningToOwner: false,
        spawnTimeMs: now,
        stepSpeed,
        speedPxPerSec,
        baseDamage: stats.damage,
        maxRangePx: stats.maxRangePx,
        distanceTraveled: 0,
        bounces: 0,
        maxBounces,
        prevX: spawnX,
        prevY: spawnY,
      });

      results.push({
        id: bulletId,
        ownerId: player.id,
        x: spawnX,
        y: spawnY,
        vx: cos * speedPxPerSec,
        vy: sin * speedPxPerSec,
        weaponType: stats.type,
        scale,
        isHoming,
        isBoomerang,
      });
    }

    return results;
  }

  public update(deltaMs: number = 1000 / 60, now: number = Date.now()): void {
    this.simNowMs = now;
    const clampedDelta = Math.min(
      deltaMs,
      1000 / PhysicsEngine.TICKS_PER_SECOND
    );
    this.roundElapsedMs += clampedDelta;

    // 1. Actualizar temporizadores de jugador y calcular velocidad efectiva para Matter.js
    this.updatePlayersPreStep(clampedDelta);

    // 2. Sub-pasos de simulación física y proyectiles
    const subDelta = clampedDelta / PhysicsEngine.SUBSTEPS;
    for (let step = 0; step < PhysicsEngine.SUBSTEPS; step++) {
      for (const bullet of this.bullets.values()) {
        bullet.prevX = bullet.body.position.x;
        bullet.prevY = bullet.body.position.y;
        this.steerSpecialBullet(bullet, subDelta / 1000);
      }

      Matter.Engine.update(this.engine, subDelta);

      this.flushEnvironmentHits();
      this.checkBulletOilIgnitions();
      this.checkBulletPlayerHits();

      for (const [bulletId, bullet] of this.bullets.entries()) {
        if (this.bulletsToDestroy.has(bulletId)) continue;

        const dx = bullet.body.position.x - bullet.prevX;
        const dy = bullet.body.position.y - bullet.prevY;
        bullet.distanceTraveled += Math.hypot(dx, dy);

        if (bullet.distanceTraveled >= bullet.maxRangePx) {
          if (bullet.weaponType === "flamethrower") {
            this.queueFlameZone(
              bullet.ownerId,
              bullet.body.position.x,
              bullet.body.position.y
            );
          }
          this.bulletsToDestroy.add(bulletId);
          continue;
        }

        if (
          bullet.isBoomerang &&
          !bullet.returningToOwner &&
          (bullet.distanceTraveled >= 380 || bullet.bounces >= 1)
        ) {
          bullet.returningToOwner = true;
        }

        this.normalizeBulletVelocity(bullet);
      }

      this.flushPendingFlameZones();
      this.flushPendingGrapples();

      if (this.bulletsToDestroy.size > 0) {
        for (const bulletId of this.bulletsToDestroy) {
          this.removeBullet(bulletId);
        }
        this.bulletsToDestroy.clear();
      }
    }

    // 3. Actualizar Mimics, Zonas de peligro, Trampolines, Sigilo, Papa Caliente, Tormenta y Botín
    this.updateMimics(clampedDelta);
    this.updateHazardZones(clampedDelta);
    this.updateJumpPads();
    this.updateStorm(clampedDelta);
    this.updateHotPotato(clampedDelta);
    this.checkLootPickups();
    this.updateStealthStates(now);

    for (const player of this.players.values()) {
      player.interactTriggered = false;
      player.abilityTriggered = false;
      if (player.alive) {
        Matter.Body.setAngularVelocity(player.body, 0);
      }
    }
  }

  private updatePlayersPreStep(dtMs: number): void {
    const tickRate = PhysicsEngine.TICKS_PER_SECOND;

    for (const p of this.players.values()) {
      if (!p.alive) continue;

      if (p.abilityCooldownMs > 0) {
        p.abilityCooldownMs = Math.max(0, p.abilityCooldownMs - dtMs);
      }
      if (p.invulnTimerMs > 0) {
        p.invulnTimerMs = Math.max(0, p.invulnTimerMs - dtMs);
      }
      if (p.potatoImmunityMs > 0) {
        p.potatoImmunityMs = Math.max(0, p.potatoImmunityMs - dtMs);
      }
      if (p.jumpPadCooldownMs > 0) {
        p.jumpPadCooldownMs = Math.max(0, p.jumpPadCooldownMs - dtMs);
      }
      if (p.shieldActive) {
        p.shieldTimerMs = Math.max(0, p.shieldTimerMs - dtMs);
        if (p.shieldTimerMs <= 0) {
          p.shieldActive = false;
        }
      }

      // Aterrizaje desde trampolín
      if (p.isAirborne) {
        p.airborneTimerMs = Math.max(0, p.airborneTimerMs - dtMs);
        if (p.airborneTimerMs <= 0) {
          p.isAirborne = false;
          this.triggerJumpLandShockwave(p);
        }
      }

      // Temporizador de Último Aliento (4s)
      if (p.isDowned) {
        p.downedTimerMs = Math.max(0, p.downedTimerMs - dtMs);
        if (p.downedTimerMs <= 0) {
          this.finalizeElimination(
            p,
            p.lastAttackerId,
            p.lastAttackerWeapon || "Desangrado"
          );
          continue;
        }
      }

      let totalVx = p.moveVx + p.externalVx;
      let totalVy = p.moveVy + p.externalVy;

      if (p.dashTimerMs > 0) {
        p.dashTimerMs = Math.max(0, p.dashTimerMs - dtMs);
        totalVx = p.dashDirX * 920;
        totalVy = p.dashDirY * 920;
      } else if (p.grappleTimerMs > 0) {
        p.grappleTimerMs = Math.max(0, p.grappleTimerMs - dtMs);
        const dx = p.grappleTargetX - p.body.position.x;
        const dy = p.grappleTargetY - p.body.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 28) {
          p.grappleTimerMs = 0;
        } else {
          totalVx = (dx / dist) * 1140;
          totalVy = (dy / dist) * 1140;
        }
      }

      const damping = this.modifier === "sniper_zero_g" ? 0.962 : 0.87;
      p.externalVx *= damping;
      p.externalVy *= damping;
      if (Math.abs(p.externalVx) < 2) p.externalVx = 0;
      if (Math.abs(p.externalVy) < 2) p.externalVy = 0;

      Matter.Body.setVelocity(p.body, {
        x: totalVx / tickRate,
        y: totalVy / tickRate,
      });
      Matter.Body.setAngularVelocity(p.body, 0);
    }
  }

  private steerSpecialBullet(bullet: InternalBullet, dtSec: number): void {
    if (bullet.isHoming) {
      let nearest: InternalPlayer | null = null;
      let bestDistSq = 560 * 560;

      for (const candidate of this.players.values()) {
        if (
          !candidate.alive ||
          candidate.id === bullet.ownerId ||
          candidate.isInvisible ||
          candidate.isAirborne
        ) {
          continue;
        }
        const dx = candidate.body.position.x - bullet.body.position.x;
        const dy = candidate.body.position.y - bullet.body.position.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          nearest = candidate;
        }
      }

      if (nearest) {
        const curAngle = Math.atan2(
          bullet.body.velocity.y,
          bullet.body.velocity.x
        );
        const desiredAngle = Math.atan2(
          nearest.body.position.y - bullet.body.position.y,
          nearest.body.position.x - bullet.body.position.x
        );
        let diff = desiredAngle - curAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = 3.6 * dtSec;
        const nextAngle =
          curAngle + Math.max(-maxTurn, Math.min(maxTurn, diff));
        Matter.Body.setVelocity(bullet.body, {
          x: Math.cos(nextAngle) * bullet.stepSpeed,
          y: Math.sin(nextAngle) * bullet.stepSpeed,
        });
      }
    } else if (bullet.isBoomerang && bullet.returningToOwner) {
      const owner = this.players.get(bullet.ownerId);
      if (owner && owner.alive) {
        const curAngle = Math.atan2(
          bullet.body.velocity.y,
          bullet.body.velocity.x
        );
        const desiredAngle = Math.atan2(
          owner.body.position.y - bullet.body.position.y,
          owner.body.position.x - bullet.body.position.x
        );
        let diff = desiredAngle - curAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = 4.2 * dtSec;
        const nextAngle =
          curAngle + Math.max(-maxTurn, Math.min(maxTurn, diff));
        Matter.Body.setVelocity(bullet.body, {
          x: Math.cos(nextAngle) * bullet.stepSpeed,
          y: Math.sin(nextAngle) * bullet.stepSpeed,
        });
      }
    }
  }

  private queueFlameZone(ownerId: string, x: number, y: number): void {
    const owner = this.players.get(ownerId);
    if (!owner) return;
    if (this.simNowMs - owner.lastFlameZoneTime < 190) return;
    owner.lastFlameZoneTime = this.simNowMs;
    this.pendingFlameZones.push({ ownerId, x, y });
  }

  private flushPendingFlameZones(): void {
    if (this.pendingFlameZones.length === 0) return;
    const list = [...this.pendingFlameZones];
    this.pendingFlameZones = [];
    for (const fz of list) {
      this.createHazardZone({
        type: "fire",
        ownerId: fz.ownerId,
        x: fz.x,
        y: fz.y,
        radius: 36,
        ttlMs: 3600,
        armed: true,
        armDelayMs: 0,
      });
    }
  }

  private flushPendingGrapples(): void {
    if (this.pendingGrapplePulls.length === 0) return;
    const list = [...this.pendingGrapplePulls];
    this.pendingGrapplePulls = [];
    for (const gp of list) {
      const p = this.players.get(gp.playerId);
      if (p && p.alive && !p.isDowned) {
        p.grappleTargetX = gp.targetX;
        p.grappleTargetY = gp.targetY;
        p.grappleTimerMs = 290;
      }
    }
  }

  private checkBulletOilIgnitions(): void {
    if (this.bullets.size === 0 || this.hazardZones.size === 0) return;
    for (const bullet of this.bullets.values()) {
      for (const hz of this.hazardZones.values()) {
        if (hz.state.type !== "oil") continue;
        const dx = bullet.body.position.x - hz.state.x;
        const dy = bullet.body.position.y - hz.state.y;
        const r = hz.state.radius + bullet.radius;
        if (dx * dx + dy * dy <= r * r) {
          hz.state.type = "fire";
          hz.state.ttlMs = 6500;
          hz.state.ownerId = bullet.ownerId;
          this.callbacks.onHazardUpdated?.({ ...hz.state });
        }
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

    if (this.pendingObstacleHits.length > 0) {
      const obsHits = [...this.pendingObstacleHits];
      this.pendingObstacleHits = [];

      for (const hit of obsHits) {
        this.callbacks.onBulletHit?.({
          x: hit.hitX,
          y: hit.hitY,
          targetType: "crate",
          damage: Math.round(hit.damage),
        });

        this.damageObstacle(
          hit.obstacleId,
          hit.damage,
          hit.ownerId
        );
      }
    }
  }

  private damageObstacle(
    obstacleId: string,
    damage: number,
    attackerId: string
  ): void {
    const obs = this.obstacles.get(obstacleId);
    if (!obs) return;

    // Si es un mimic dormido, se despierta al recibir daño
    if (obs.state.type === "mimic_crate" && !obs.state.awake) {
      this.wakeMimic(obs);
    }

    obs.state.hp = Math.max(0, obs.state.hp - damage);

    if (obs.state.hp > 0) {
      this.callbacks.onObstacleUpdated?.({ ...obs.state });
      return;
    }

    // Destrucción según tipo de obstáculo
    const { id, type, x, y } = obs.state;
    if (obs.body) {
      Matter.Composite.remove(this.world, obs.body);
    }
    this.obstacles.delete(id);
    this.callbacks.onObstacleRemoved?.(id);

    if (type === "crate") {
      const loot = ArenaGenerator.generateLootFromCrate(x, y);
      this.lootItems.set(loot.id, loot);
      this.callbacks.onCrateDestroyed?.({ id, x, y, isGolden: false }, [loot]);
    } else if (type === "golden_crate") {
      const loots = ArenaGenerator.generateLootFromGoldenCrate(x, y);
      for (const l of loots) {
        this.lootItems.set(l.id, l);
      }
      this.callbacks.onCrateDestroyed?.({ id, x, y, isGolden: true }, loots);
    } else if (type === "explosive_barrel") {
      this.triggerExplosion(
        x,
        y,
        150,
        65,
        "barrel",
        attackerId,
        "Barril Explosivo"
      );
    } else if (type === "oil_barrel") {
      this.createHazardZone({
        type: "oil",
        ownerId: attackerId,
        x,
        y,
        radius: 78,
        ttlMs: 15000,
        armed: true,
        armDelayMs: 0,
      });
    } else if (type === "mimic_crate") {
      this.triggerExplosion(
        x,
        y,
        115,
        45,
        "mimic",
        attackerId,
        "Caja Trampa"
      );
    }
  }

  private wakeMimic(obs: InternalObstacle): void {
    if (obs.state.awake) return;
    obs.state.awake = true;
    obs.mimicFuseMs = 4000;
    if (obs.body) {
      Matter.Composite.remove(this.world, obs.body);
      obs.body = null;
    }
    this.callbacks.onObstacleUpdated?.({ ...obs.state });
  }

  private updateMimics(dtMs: number): void {
    const dtSec = dtMs / 1000;

    for (const obs of Array.from(this.obstacles.values())) {
      if (obs.state.type !== "mimic_crate") continue;

      if (!obs.state.awake) {
        for (const p of this.players.values()) {
          if (!p.alive || p.isAirborne) continue;
          const dist = Math.hypot(
            p.body.position.x - obs.state.x,
            p.body.position.y - obs.state.y
          );
          if (dist < 65 + PhysicsEngine.PLAYER_RADIUS) {
            this.wakeMimic(obs);
            break;
          }
        }
      }

      if (obs.state.awake) {
        obs.mimicFuseMs -= dtMs;

        // Perseguir al jugador vivo más cercano
        let target: InternalPlayer | null = null;
        let bestDist = Infinity;
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const d = Math.hypot(
            p.body.position.x - obs.state.x,
            p.body.position.y - obs.state.y
          );
          if (d < bestDist) {
            bestDist = d;
            target = p;
          }
        }

        if (target && bestDist > 1) {
          const speed = 205;
          const dx = target.body.position.x - obs.state.x;
          const dy = target.body.position.y - obs.state.y;
          obs.state.x = Math.max(
            40,
            Math.min(this.mapWidth - 40, obs.state.x + (dx / bestDist) * speed * dtSec)
          );
          obs.state.y = Math.max(
            40,
            Math.min(this.mapHeight - 40, obs.state.y + (dy / bestDist) * speed * dtSec)
          );
          this.callbacks.onObstacleUpdated?.({ ...obs.state });
        }

        if (obs.mimicFuseMs <= 0 || bestDist <= PhysicsEngine.PLAYER_RADIUS + 18) {
          const { id, x, y } = obs.state;
          this.obstacles.delete(id);
          this.callbacks.onObstacleRemoved?.(id);
          this.triggerExplosion(x, y, 115, 45, "mimic", "", "Caja Trampa");
        }
      }
    }
  }

  private triggerExplosion(
    x: number,
    y: number,
    radius: number,
    maxDamage: number,
    kind: ExplosionEvent["kind"],
    attackerId: string,
    weaponLabel: string
  ): void {
    this.callbacks.onExplosion?.({ x, y, radius, kind });
    this.igniteOverlappingOil(x, y, radius, attackerId);

    // Daño y empuje a jugadores en el radio
    for (const p of this.players.values()) {
      if (!p.alive || p.isAirborne) continue;
      const dx = p.body.position.x - x;
      const dy = p.body.position.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius + PhysicsEngine.PLAYER_RADIUS) {
        const ratio = Math.max(0.45, 1 - dist / (radius + PhysicsEngine.PLAYER_RADIUS));
        const dmg = Math.round(maxDamage * ratio);
        const ang = dist > 0.1 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
        const pushForce = kind === "jump_land" ? 640 : 760 * ratio;
        p.externalVx += Math.cos(ang) * pushForce;
        p.externalVy += Math.sin(ang) * pushForce;

        if (dmg > 0 && !(kind === "jump_land" && p.id === attackerId)) {
          this.applyDamageToPlayer(
            p,
            dmg,
            attackerId,
            weaponLabel,
            p.body.position.x,
            p.body.position.y,
            false,
            false
          );
        }
      }
    }

    // Reacción en cadena con barriles, cajas y cajas trampa cercanas
    if (kind !== "jump_land") {
      const nearbyObstacles = Array.from(this.obstacles.values()).filter(
        (obs) =>
          (obs.state.type === "explosive_barrel" ||
            obs.state.type === "oil_barrel" ||
            obs.state.type === "crate" ||
            obs.state.type === "golden_crate" ||
            obs.state.type === "mimic_crate") &&
          Math.hypot(obs.state.x - x, obs.state.y - y) <=
            radius + obs.state.radius
      );
      for (const obs of nearbyObstacles) {
        this.damageObstacle(obs.state.id, maxDamage, attackerId);
      }
    }
  }

  private triggerJumpLandShockwave(lander: InternalPlayer): void {
    const x = lander.body.position.x;
    const y = lander.body.position.y;
    this.triggerExplosion(
      x,
      y,
      115,
      18,
      "jump_land",
      lander.id,
      "Salto Sísmico"
    );
  }

  private updateJumpPads(): void {
    for (const obs of this.obstacles.values()) {
      if (obs.state.type !== "jump_pad") continue;
      for (const p of this.players.values()) {
        if (!p.alive || p.isDowned || p.isAirborne || p.jumpPadCooldownMs > 0) {
          continue;
        }
        const dist = Math.hypot(
          p.body.position.x - obs.state.x,
          p.body.position.y - obs.state.y
        );
        if (dist <= obs.state.radius + 8) {
          p.isAirborne = true;
          p.airborneTimerMs = 700;
          p.jumpPadCooldownMs = 1300;
          const moveLen = Math.hypot(p.moveVx, p.moveVy);
          const launchAng =
            moveLen > 10 ? Math.atan2(p.moveVy, p.moveVx) : p.angle;
          p.externalVx += Math.cos(launchAng) * 440;
          p.externalVy += Math.sin(launchAng) * 440;
        }
      }
    }
  }

  private updateHazardZones(dtMs: number): void {
    for (const [id, hz] of Array.from(this.hazardZones.entries())) {
      hz.state.ttlMs -= dtMs;
      if (hz.state.ttlMs <= 0) {
        this.hazardZones.delete(id);
        this.callbacks.onHazardRemoved?.(id);
        continue;
      }

      if (!hz.state.armed) {
        hz.armTimerMs -= dtMs;
        if (hz.armTimerMs <= 0) {
          hz.state.armed = true;
          this.callbacks.onHazardUpdated?.({ ...hz.state });
        }
      }

      // Minas de proximidad armadas
      if (hz.state.type === "mine" && hz.state.armed) {
        let triggered = false;
        for (const p of this.players.values()) {
          if (!p.alive || p.isAirborne || p.id === hz.state.ownerId) continue;
          const dist = Math.hypot(
            p.body.position.x - hz.state.x,
            p.body.position.y - hz.state.y
          );
          if (dist <= hz.state.radius + PhysicsEngine.PLAYER_RADIUS * 0.7) {
            triggered = true;
            break;
          }
        }
        if (triggered) {
          const { x, y, ownerId } = hz.state;
          this.hazardZones.delete(id);
          this.callbacks.onHazardRemoved?.(id);
          this.triggerExplosion(
            x,
            y,
            115,
            45,
            "mine",
            ownerId,
            "Mina de Proximidad"
          );
        }
      }
    }

    // Daño por zonas de fuego (18 HP/s)
    for (const p of this.players.values()) {
      if (!p.alive || p.isAirborne) {
        p.fireDamageAccumMs = 0;
        continue;
      }
      const fireZone = this.findPlayerZone(p, "fire");
      if (fireZone) {
        p.fireDamageAccumMs += dtMs;
        if (p.fireDamageAccumMs >= 250) {
          p.fireDamageAccumMs -= 250;
          this.applyDamageToPlayer(
            p,
            4.5, // 18 HP/s
            fireZone.ownerId,
            "Fuego",
            p.body.position.x,
            p.body.position.y,
            false,
            true
          );
        }
      } else {
        p.fireDamageAccumMs = 0;
      }
    }
  }

  private updateStorm(dtMs: number): void {
    if (this.roundElapsedMs > PhysicsEngine.STORM_START_MS) {
      const shrink = (PhysicsEngine.STORM_SHRINK_PX_PER_SEC * dtMs) / 1000;
      this.stormRadius = Math.max(
        PhysicsEngine.STORM_MIN_RADIUS,
        this.stormRadius - shrink
      );
    }

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const dist = Math.hypot(
        p.body.position.x - this.stormX,
        p.body.position.y - this.stormY
      );
      if (dist > this.stormRadius) {
        p.stormDamageAccumMs += dtMs;
        if (p.stormDamageAccumMs >= 250) {
          p.stormDamageAccumMs -= 250;
          this.applyDamageToPlayer(
            p,
            PhysicsEngine.STORM_DPS * 0.25, // 8 HP/s
            "",
            "Tormenta",
            p.body.position.x,
            p.body.position.y,
            false,
            true
          );
        }
      } else {
        p.stormDamageAccumMs = 0;
      }
    }
  }

  private updateHotPotato(dtMs: number): void {
    if (this.modifier !== "hot_potato") return;

    let anyCarrier = false;
    for (const p of Array.from(this.players.values())) {
      if (!p.alive || !p.hasHotPotato) continue;
      anyCarrier = true;
      p.hotPotatoTimerMs = Math.max(0, p.hotPotatoTimerMs - dtMs);

      if (p.hotPotatoTimerMs <= 0) {
        p.hasHotPotato = false;
        const bx = p.body.position.x;
        const by = p.body.position.y;
        this.callbacks.onExplosion?.({
          x: bx,
          y: by,
          radius: 145,
          kind: "potato",
        });
        this.finalizeElimination(p, p.lastAttackerId, "Papa Caliente 💣");

        // Daño colateral a cercanos
        for (const other of this.players.values()) {
          if (!other.alive || other.id === p.id || other.isAirborne) continue;
          const d = Math.hypot(
            other.body.position.x - bx,
            other.body.position.y - by
          );
          if (d <= 145) {
            this.applyDamageToPlayer(
              other,
              45,
              p.id,
              "Papa Caliente 💣",
              other.body.position.x,
              other.body.position.y,
              false,
              true
            );
          }
        }
        anyCarrier = false;
      }
    }

    if (!anyCarrier) {
      const aliveHealthy = Array.from(this.players.values()).filter(
        (p) => p.alive && !p.isDowned
      );
      if (aliveHealthy.length >= 2) {
        this.assignHotPotato();
      }
    }
  }

  private updateStealthStates(now: number): void {
    for (const p of this.players.values()) {
      if (!p.alive || p.isDowned) {
        p.isInvisible = false;
        continue;
      }

      const recentlyShot = now - p.lastShootTime < 550;
      const inFire = this.isPlayerInZone(p, "fire");
      const inOil = this.isPlayerInZone(p, "oil");

      if (recentlyShot || inFire || p.hasHotPotato) {
        p.isInvisible = false;
        continue;
      }

      if (this.modifier === "all_invisible") {
        p.isInvisible = !inOil;
        continue;
      }

      const inSmoke = this.isPlayerInZone(p, "smoke");
      const inBush = this.isPlayerInBush(p);
      p.isInvisible = inSmoke || inBush;
    }
  }

  private isPlayerInBush(p: InternalPlayer): boolean {
    for (const obs of this.obstacles.values()) {
      if (obs.state.type !== "bush") continue;
      const d = Math.hypot(
        p.body.position.x - obs.state.x,
        p.body.position.y - obs.state.y
      );
      if (d <= obs.state.radius - 4) return true;
    }
    return false;
  }

  private isPlayerInZone(
    p: InternalPlayer,
    type: HazardZoneState["type"]
  ): boolean {
    return this.findPlayerZone(p, type) !== null;
  }

  private findPlayerZone(
    p: InternalPlayer,
    type: HazardZoneState["type"]
  ): HazardZoneState | null {
    for (const hz of this.hazardZones.values()) {
      if (hz.state.type !== type) continue;
      const d = Math.hypot(
        p.body.position.x - hz.state.x,
        p.body.position.y - hz.state.y
      );
      if (d <= hz.state.radius) return hz.state;
    }
    return null;
  }

  private checkBulletPlayerHits(): void {
    const damageMultiplier = this.modifier === "double_damage" ? 2 : 1;

    for (const [bulletId, bullet] of this.bullets.entries()) {
      if (this.bulletsToDestroy.has(bulletId)) continue;

      const hitRadius = PhysicsEngine.PLAYER_RADIUS + bullet.radius;
      const hitRadiusSq = hitRadius * hitRadius;
      const x1 = bullet.prevX;
      const y1 = bullet.prevY;
      const x2 = bullet.body.position.x;
      const y2 = bullet.body.position.y;

      const canDamageOwner =
        bullet.isBoomerang && this.simNowMs - bullet.spawnTimeMs >= 300;

      for (const victim of this.players.values()) {
        if (!victim.alive || victim.isAirborne) continue;
        if (victim.id === bullet.ownerId && !canDamageOwner) continue;

        const px = victim.body.position.x;
        const py = victim.body.position.y;
        const closest = this.closestPointOnSegment(x1, y1, x2, y2, px, py);
        const dx = px - closest.x;
        const dy = py - closest.y;

        if (dx * dx + dy * dy > hitRadiusSq) continue;

        // Verificar Escudo de Energía Frontal (bloquea y refleja balas frontales)
        if (victim.shieldActive && victim.id !== bullet.ownerId) {
          const incomingAngle = Math.atan2(
            closest.y - py,
            closest.x - px
          );
          let angleDiff = incomingAngle - victim.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          if (Math.abs(angleDiff) <= (78 * Math.PI) / 180) {
            bullet.ownerId = victim.id;
            bullet.distanceTraveled = 0;
            const reflCos = Math.cos(victim.angle);
            const reflSin = Math.sin(victim.angle);
            Matter.Body.setPosition(bullet.body, {
              x: px + reflCos * (hitRadius + 6),
              y: py + reflSin * (hitRadius + 6),
            });
            Matter.Body.setVelocity(bullet.body, {
              x: reflCos * bullet.stepSpeed,
              y: reflSin * bullet.stepSpeed,
            });
            this.callbacks.onBulletHit?.({
              x: closest.x,
              y: closest.y,
              targetType: "shield",
            });
            break;
          }
        }

        this.bulletsToDestroy.add(bulletId);

        const attacker = this.players.get(bullet.ownerId);
        const weaponStats = WEAPON_CONFIGS[bullet.weaponType];

        // Efectos especiales por arma
        if (weaponStats.knockbackTarget) {
          const bAng = Math.atan2(
            bullet.body.velocity.y,
            bullet.body.velocity.x
          );
          victim.externalVx += Math.cos(bAng) * weaponStats.knockbackTarget;
          victim.externalVy += Math.sin(bAng) * weaponStats.knockbackTarget;
        }

        if (bullet.weaponType === "flamethrower") {
          this.queueFlameZone(bullet.ownerId, closest.x, closest.y);
        }

        if (bullet.weaponType === "grappling_hook" && attacker) {
          this.pendingGrapplePulls.push({
            playerId: attacker.id,
            targetX: px,
            targetY: py,
          });
        }

        // Pasar la Papa Caliente al acertar un disparo
        if (
          this.modifier === "hot_potato" &&
          attacker &&
          attacker.hasHotPotato &&
          attacker.potatoImmunityMs <= 0 &&
          victim.id !== attacker.id &&
          !victim.isDowned
        ) {
          const carriedMs = Math.max(4000, attacker.hotPotatoTimerMs);
          attacker.hasHotPotato = false;
          attacker.hotPotatoTimerMs = 0;
          victim.hasHotPotato = true;
          victim.hotPotatoTimerMs = carriedMs;
          victim.potatoImmunityMs = 350;
          victim.lastAttackerId = attacker.id;
        }

        const totalDamage = bullet.baseDamage * damageMultiplier;
        this.applyDamageToPlayer(
          victim,
          totalDamage,
          bullet.ownerId,
          weaponStats.label,
          closest.x,
          closest.y,
          bullet.firedWhileDowned,
          true
        );

        break;
      }
    }
  }

  private applyDamageToPlayer(
    victim: InternalPlayer,
    rawDamage: number,
    attackerId: string,
    weaponLabel: string,
    hitX: number,
    hitY: number,
    isFromDownedShooter: boolean,
    emitHitEvent: boolean
  ): void {
    if (!victim.alive || victim.invulnTimerMs > 0) return;

    if (attackerId && attackerId !== victim.id) {
      victim.lastAttackerId = attackerId;
      victim.lastAttackerWeapon = weaponLabel;
    }

    if (emitHitEvent) {
      this.callbacks.onBulletHit?.({
        x: hitX,
        y: hitY,
        targetType: "player",
        damage: Math.max(1, Math.round(rawDamage)),
      });
    }

    // Revivir si un jugador en Último Aliento acierta un tiro a un rival
    if (isFromDownedShooter && attackerId && attackerId !== victim.id) {
      const shooter = this.players.get(attackerId);
      if (shooter && shooter.alive && shooter.isDowned) {
        shooter.isDowned = false;
        shooter.downedTimerMs = 0;
        shooter.hp = 30;
      }
    }

    // Si la víctima ya estaba en Último Aliento, recibe daño para ser rematada
    if (victim.isDowned) {
      victim.downedBodyHp -= rawDamage;
      if (victim.downedBodyHp <= 0) {
        this.finalizeElimination(
          victim,
          attackerId || victim.lastAttackerId,
          weaponLabel
        );
      }
      return;
    }

    // Absorber primero con escudo y el resto a salud
    let remaining = rawDamage;
    if (victim.shield > 0) {
      const absorbed = Math.min(victim.shield, remaining);
      victim.shield -= absorbed;
      remaining -= absorbed;
    }

    if (remaining > 0) {
      victim.hp = Math.max(0, victim.hp - remaining);
    }

    if (victim.hp <= 0) {
      // Entrar en estado Último Aliento (4s gateando con pistolita de 8 DMG)
      victim.hp = 0;
      victim.shield = 0;
      victim.isDowned = true;
      victim.downedTimerMs = 4000;
      victim.downedBodyHp = 40;
      victim.shieldActive = false;
      victim.shieldTimerMs = 0;
    }
  }

  private finalizeElimination(
    victim: InternalPlayer,
    killerId: string,
    weaponLabel: string
  ): void {
    if (!victim.alive) return;
    victim.alive = false;
    victim.isDowned = false;
    victim.downedTimerMs = 0;
    victim.hp = 0;
    victim.shield = 0;

    const elimX = victim.body.position.x;
    const elimY = victim.body.position.y;
    Matter.Composite.remove(this.world, victim.body);

    const hadBounty = victim.hasBounty;
    victim.hasBounty = false;

    const killer = killerId ? this.players.get(killerId) : undefined;
    if (killer && killer.alive && killer.id !== victim.id) {
      if (this.modifier === "vampire") {
        killer.hp = Math.min(
          killer.maxHp,
          killer.hp + PhysicsEngine.VAMPIRE_HEAL_AMOUNT
        );
      }
      // Recompensa de Bounty: +50 shield + arma dorada al instante
      if (hadBounty) {
        killer.shield = killer.maxShield;
        killer.weapon = ArenaGenerator.pickRandomSpecialWeapon();
      }
    }

    const killerName =
      killer && killer.id !== victim.id ? killer.name : "La Arena";

    this.callbacks.onPlayerEliminated?.(
      {
        victimId: victim.id,
        killerId: killer?.id ?? "",
        x: elimX,
        y: elimY,
      },
      {
        killerName,
        victimName: victim.name,
        weapon: weaponLabel,
      },
      hadBounty
    );
  }

  private checkLootPickups(): void {
    if (this.lootItems.size === 0) return;

    const interactSq =
      PhysicsEngine.INTERACT_LOOT_RADIUS * PhysicsEngine.INTERACT_LOOT_RADIUS;
    const autoSq =
      PhysicsEngine.AUTO_LOOT_RADIUS * PhysicsEngine.AUTO_LOOT_RADIUS;

    for (const player of this.players.values()) {
      if (!player.alive || player.isDowned || player.isAirborne) continue;

      const px = player.body.position.x;
      const py = player.body.position.y;

      // 1. Interacción explícita con E recoge cualquier objeto cercano (y permite cambiar de arma)
      if (player.interactTriggered) {
        let closest: LootItemState | null = null;
        let bestSq = interactSq;
        for (const loot of this.lootItems.values()) {
          const dSq = (px - loot.x) ** 2 + (py - loot.y) ** 2;
          if (dSq <= bestSq) {
            bestSq = dSq;
            closest = loot;
          }
        }
        if (closest) {
          this.consumeLootItem(player, closest);
          continue;
        }
      }

      // 2. Paso automático sobre botiquines (si falta HP), escudos (si falta shield) o primera mejora desde pistola
      for (const loot of Array.from(this.lootItems.values())) {
        const dSq = (px - loot.x) ** 2 + (py - loot.y) ** 2;
        if (dSq > autoSq) continue;

        if (loot.kind === "medkit" && player.hp < player.maxHp) {
          this.consumeLootItem(player, loot);
          break;
        }
        if (loot.kind === "shield" && player.shield < player.maxShield) {
          this.consumeLootItem(player, loot);
          break;
        }
        if (
          loot.kind === "weapon" &&
          loot.weaponType &&
          player.weapon === "pistol"
        ) {
          this.consumeLootItem(player, loot);
          break;
        }
      }
    }
  }

  private consumeLootItem(player: InternalPlayer, loot: LootItemState): void {
    this.lootItems.delete(loot.id);
    this.callbacks.onLootPickedUp?.(loot.id, player.id);

    if (loot.kind === "medkit") {
      const heal = loot.amount ?? PhysicsEngine.MEDKIT_HEAL_AMOUNT;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      return;
    }

    if (loot.kind === "shield") {
      const gain = loot.amount ?? PhysicsEngine.DEFAULT_SHIELD_AMOUNT;
      player.shield = Math.min(player.maxShield, player.shield + gain);
      return;
    }

    if (loot.kind === "weapon" && loot.weaponType) {
      const prevWeapon = player.weapon;
      player.weapon = loot.weaponType;
      if (prevWeapon !== "pistol" && prevWeapon !== loot.weaponType) {
        const dropped = ArenaGenerator.generateWeaponDrop(
          prevWeapon,
          loot.x,
          loot.y
        );
        this.lootItems.set(dropped.id, dropped);
        this.callbacks.onLootSpawned?.(dropped);
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
          if (bullet.weaponType === "grappling_hook") {
            this.pendingGrapplePulls.push({
              playerId: bullet.ownerId,
              targetX: hitX,
              targetY: hitY,
            });
            this.bulletsToDestroy.add(bulletId);
            continue;
          }
          if (bullet.weaponType === "flamethrower") {
            this.queueFlameZone(bullet.ownerId, hitX, hitY);
          }
          if (bullet.bounces < bullet.maxBounces) {
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

          if (bullet.weaponType === "grappling_hook") {
            this.pendingGrapplePulls.push({
              playerId: bullet.ownerId,
              targetX: hitX,
              targetY: hitY,
            });
            this.bulletsToDestroy.add(bulletId);
          }

          if (bullet.weaponType === "flamethrower") {
            this.queueFlameZone(bullet.ownerId, hitX, hitY);
          }

          const type = obs.state.type;
          if (type === "rock") {
            if (bullet.bounces < bullet.maxBounces) {
              bullet.bounces += 1;
            } else {
              this.bulletsToDestroy.add(bulletId);
              this.pendingWallHits.push({
                x: hitX,
                y: hitY,
                targetType: "wall",
              });
            }
          } else if (type === "tree") {
            this.bulletsToDestroy.add(bulletId);
            this.pendingWallHits.push({ x: hitX, y: hitY, targetType: "wall" });
          } else {
            // crate, golden_crate, explosive_barrel, oil_barrel, mimic_crate
            this.bulletsToDestroy.add(bulletId);
            this.pendingObstacleHits.push({
              obstacleId,
              damage: bullet.baseDamage * damageMultiplier,
              hitX,
              hitY,
              ownerId: bullet.ownerId,
              weaponType: bullet.weaponType,
            });
          }
        }
      }
    });
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
    if (lenSq === 0) return { x: x1, y: y1 };
    const t = Math.max(
      0,
      Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq)
    );
    return {
      x: x1 + t * dx,
      y: y1 + t * dy,
    };
  }

  private removeBullet(bulletId: string): void {
    const bullet = this.bullets.get(bulletId);
    if (!bullet) return;
    Matter.Composite.remove(this.world, bullet.body);
    this.bullets.delete(bulletId);
    this.callbacks.onBulletRemoved?.(bulletId);
  }

  public getPlayerSnapshot(id: string): PhysicsPlayerSnapshot | null {
    const p = this.players.get(id);
    if (!p) return null;
    return {
      x: p.body.position.x,
      y: p.body.position.y,
      angle: p.angle,
      hp: Math.round(p.hp),
      maxHp: p.maxHp,
      shield: Math.round(p.shield),
      maxShield: p.maxShield,
      alive: p.alive,
      isDowned: p.isDowned,
      downedTimerMs: Math.round(p.downedTimerMs),
      weapon: p.weapon,
      ability: p.ability,
      abilityCooldownMs: Math.round(p.abilityCooldownMs),
      shieldActive: p.shieldActive,
      hasHotPotato: p.hasHotPotato,
      hotPotatoTimerMs: Math.round(p.hotPotatoTimerMs),
      isInvisible: p.isInvisible,
      isAirborne: p.isAirborne,
    };
  }

  public getActiveBullets(): BulletState[] {
    const list: BulletState[] = [];
    const tickRate = PhysicsEngine.TICKS_PER_SECOND;
    for (const b of this.bullets.values()) {
      list.push({
        id: b.id,
        ownerId: b.ownerId,
        x: b.body.position.x,
        y: b.body.position.y,
        vx: b.body.velocity.x * tickRate,
        vy: b.body.velocity.y * tickRate,
        weaponType: b.weaponType,
        scale: b.scale,
        isHoming: b.isHoming,
        isBoomerang: b.isBoomerang,
      });
    }
    return list;
  }

  public getActiveHazardZones(): HazardZoneState[] {
    const list: HazardZoneState[] = [];
    for (const hz of this.hazardZones.values()) {
      list.push({ ...hz.state, ttlMs: Math.round(hz.state.ttlMs) });
    }
    return list;
  }

  public resetArena(): void {
    Matter.Composite.clear(this.world, false);
    this.borderWalls = [];
    this.players.clear();
    this.obstacles.clear();
    this.hazardZones.clear();
    this.lootItems.clear();
    this.bullets.clear();
    this.bulletsToDestroy.clear();
    this.pendingWallHits = [];
    this.pendingObstacleHits = [];
    this.pendingGrapplePulls = [];
    this.pendingFlameZones = [];
  }
}
