import { Client, Delayed, Room } from "colyseus";
import type {
  AbilityType,
  BulletHitEvent,
  CrateDestroyedEvent,
  EmoteEvent,
  EmoteType,
  ExplosionEvent,
  HazardZoneState,
  KillFeedEvent,
  LootItemState,
  ObstacleState,
  PlayerEliminatedEvent,
  PlayerInput,
  RoundEndEvent,
  WeaponType,
} from "@shared/types";
import {
  BulletSchema,
  GameRoomState,
  HazardZoneSchema,
  LootItemSchema,
  ObstacleSchema,
  PlayerSchema,
} from "./schema/GameRoomState";
import { ArenaGenerator } from "../game/ArenaGenerator";
import { PhysicsEngine } from "../game/PhysicsEngine";

interface JoinOptions {
  name?: string;
  color?: string;
  ability?: AbilityType;
  roomCode?: string;
  create?: boolean;
}

interface ProfileUpdatePayload {
  name?: string;
  color?: string;
  ability?: AbilityType;
}

interface ReadyPayload {
  ready?: boolean;
}

interface EmotePayload {
  emote?: EmoteType;
}

const VALID_ABILITIES: AbilityType[] = [
  "dash",
  "energy_shield",
  "proximity_mine",
  "smoke_grenade",
];

const VALID_EMOTES: EmoteType[] = ["laugh", "skull", "gg", "chicken"];

const DEFAULT_COLORS = [
  "#22D3EE",
  "#EC4899",
  "#A3E635",
  "#F59E0B",
  "#8B5CF6",
  "#EF4444",
];

const WINNING_SCORE = 5;
const ROUND_END_DELAY_MS = 3600;
const TICK_RATE_HZ = 60;
const EMOTE_COOLDOWN_MS = 750;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class TankRoom extends Room<GameRoomState> {
  public maxClients = 4;

  private physics!: PhysicsEngine;
  private playerInputs: Map<string, PlayerInput> = new Map();
  private shootLatched: Map<string, boolean> = new Map();
  private interactLatched: Map<string, boolean> = new Map();
  private abilityLatched: Map<string, boolean> = new Map();
  private lastEmoteTime: Map<string, number> = new Map();
  private roundTransitionTimer: Delayed | null = null;
  private roundEndingScheduled = false;

  private static activeRoomCodes: Set<string> = new Set();

  onCreate(options: JoinOptions): void {
    this.setState(new GameRoomState());

    const requestedCode =
      typeof options?.roomCode === "string" &&
      /^[A-Z0-9]{4}$/i.test(options.roomCode.trim())
        ? options.roomCode.trim().toUpperCase()
        : this.generateUniqueRoomCode();

    this.state.roomCode = requestedCode;
    this.state.status = "waiting";
    this.state.modifier = "normal";
    this.state.mapWidth = ArenaGenerator.MAP_WIDTH;
    this.state.mapHeight = ArenaGenerator.MAP_HEIGHT;
    this.state.stormX = ArenaGenerator.MAP_WIDTH / 2;
    this.state.stormY = ArenaGenerator.MAP_HEIGHT / 2;
    this.state.stormRadius = Math.round(
      Math.hypot(ArenaGenerator.MAP_WIDTH / 2, ArenaGenerator.MAP_HEIGHT / 2) +
        80
    );

    TankRoom.activeRoomCodes.add(requestedCode);

    options.roomCode = requestedCode;
    if (this.listing) {
      (this.listing as unknown as Record<string, unknown>).roomCode =
        requestedCode;
    }
    void this.setMetadata({ roomCode: requestedCode });

    this.physics = new PhysicsEngine({
      onBulletHit: (event: BulletHitEvent) => {
        this.broadcast("bulletHit", event);
      },
      onExplosion: (event: ExplosionEvent) => {
        this.broadcast("explosion", event);
      },
      onObstacleUpdated: (obs: ObstacleState) => {
        const schema = this.state.obstacles.get(obs.id);
        if (schema) {
          schema.x = obs.x;
          schema.y = obs.y;
          schema.hp = obs.hp;
          schema.awake = Boolean(obs.awake);
        }
      },
      onObstacleRemoved: (obstacleId: string) => {
        this.state.obstacles.delete(obstacleId);
      },
      onCrateDestroyed: (
        event: CrateDestroyedEvent,
        spawnedLoot: LootItemState[]
      ) => {
        this.state.obstacles.delete(event.id);
        for (const item of spawnedLoot) {
          this.addLootToState(item);
        }
        this.broadcast("crateDestroyed", event);
      },
      onHazardSpawned: (zone: HazardZoneState) => {
        this.upsertHazardInState(zone);
      },
      onHazardUpdated: (zone: HazardZoneState) => {
        this.upsertHazardInState(zone);
      },
      onHazardRemoved: (zoneId: string) => {
        this.state.hazardZones.delete(zoneId);
      },
      onLootSpawned: (loot: LootItemState) => {
        this.addLootToState(loot);
      },
      onLootPickedUp: (lootId: string) => {
        this.state.lootItems.delete(lootId);
      },
      onBulletRemoved: (bulletId: string) => {
        this.state.bullets.delete(bulletId);
      },
      onPlayerEliminated: (
        event: PlayerEliminatedEvent,
        killFeed: KillFeedEvent,
        victimHadBounty: boolean
      ) => {
        const victim = this.state.players.get(event.victimId);
        if (victim) {
          victim.hp = 0;
          victim.shield = 0;
          victim.alive = false;
          victim.isDowned = false;
          victim.downedTimerMs = 0;
          if (victimHadBounty) {
            victim.streak = 0;
            victim.hasBounty = false;
          }
        }
        this.broadcast("playerEliminated", event);
        this.broadcast("killFeed", killFeed);
        this.checkRoundEndCondition();
      },
    });

    this.generateAndLoadArena("normal");
    this.registerMessageHandlers();

    this.setPatchRate(1000 / TICK_RATE_HZ);
    this.setSimulationInterval((deltaTime) => {
      this.updateSimulation(deltaTime);
    }, 1000 / TICK_RATE_HZ);
  }

  onJoin(client: Client, options: JoinOptions): void {
    const playerIndex = this.state.players.size;
    const spawns = ArenaGenerator.getSpawnPoints(
      this.state.mapWidth,
      this.state.mapHeight
    );
    const spawn = spawns[playerIndex % spawns.length];

    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = this.sanitizeName(options?.name, playerIndex + 1);
    player.color = this.sanitizeColor(options?.color, playerIndex);
    player.ability = this.sanitizeAbility(options?.ability);
    player.x = spawn.x;
    player.y = spawn.y;
    player.angle = spawn.angle;
    player.hp = PhysicsEngine.PLAYER_MAX_HP;
    player.maxHp = PhysicsEngine.PLAYER_MAX_HP;
    player.shield = 0;
    player.maxShield = PhysicsEngine.PLAYER_MAX_SHIELD;
    player.alive = this.state.status === "waiting";
    player.isDowned = false;
    player.downedTimerMs = 0;
    player.score = 0;
    player.streak = 0;
    player.hasBounty = false;
    player.ready = false;
    player.weapon = "pistol";
    player.abilityCooldownMs = 0;
    player.shieldActive = false;
    player.hasHotPotato = false;
    player.hotPotatoTimerMs = 0;
    player.isInvisible = false;
    player.isAirborne = false;

    this.state.players.set(client.sessionId, player);
    this.shootLatched.set(client.sessionId, false);
    this.interactLatched.set(client.sessionId, false);
    this.abilityLatched.set(client.sessionId, false);
    this.playerInputs.set(client.sessionId, {
      up: false,
      down: false,
      left: false,
      right: false,
      angle: spawn.angle,
      shoot: false,
      interact: false,
      useAbility: false,
      seq: 0,
    });
  }

  onLeave(client: Client): void {
    this.physics.removePlayer(client.sessionId);
    this.playerInputs.delete(client.sessionId);
    this.shootLatched.delete(client.sessionId);
    this.interactLatched.delete(client.sessionId);
    this.abilityLatched.delete(client.sessionId);
    this.lastEmoteTime.delete(client.sessionId);
    this.state.players.delete(client.sessionId);

    if (this.state.status === "playing") {
      if (this.state.players.size < 2) {
        this.returnToWaiting(false);
      } else {
        this.checkRoundEndCondition();
      }
    } else if (this.state.status === "waiting") {
      this.checkAutoStart();
    }
  }

  onDispose(): void {
    if (this.roundTransitionTimer) {
      this.roundTransitionTimer.clear();
      this.roundTransitionTimer = null;
    }
    if (this.state?.roomCode) {
      TankRoom.activeRoomCodes.delete(this.state.roomCode);
    }
  }

  private registerMessageHandlers(): void {
    this.onMessage("updateProfile", (client, payload: ProfileUpdatePayload) => {
      if (this.state.status !== "waiting") return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !payload) return;

      if (typeof payload.name === "string" && payload.name.trim().length > 0) {
        player.name = this.sanitizeName(payload.name, 1);
      }
      if (
        typeof payload.color === "string" &&
        payload.color.trim().length > 0
      ) {
        player.color = this.sanitizeColor(payload.color, 0);
      }
      if (payload.ability) {
        player.ability = this.sanitizeAbility(payload.ability);
      }
    });

    this.onMessage("ready", (client, payload?: ReadyPayload | boolean) => {
      if (this.state.status !== "waiting") return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (typeof payload === "boolean") {
        player.ready = payload;
      } else if (payload && typeof payload.ready === "boolean") {
        player.ready = payload.ready;
      } else {
        player.ready = !player.ready;
      }

      this.checkAutoStart();
    });

    this.onMessage("startGame", (client) => {
      if (this.state.status !== "waiting") return;
      if (this.state.players.size < 2) return;
      if (!this.state.players.has(client.sessionId)) return;

      this.startMatch();
    });

    this.onMessage("emote", (client, payload: EmotePayload) => {
      if (!payload?.emote) return;
      this.tryEmitEmote(client.sessionId, payload.emote);
    });

    const handleInput = (client: Client, input: PlayerInput) => {
      if (this.state.status !== "playing" || !input) return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      const shootPressed = Boolean(input.shoot);
      const interactPressed = Boolean(input.interact);
      const abilityPressed = Boolean(input.useAbility);

      if (shootPressed) {
        this.shootLatched.set(client.sessionId, true);
      }
      if (interactPressed) {
        this.interactLatched.set(client.sessionId, true);
      }
      if (abilityPressed) {
        this.abilityLatched.set(client.sessionId, true);
      }
      if (input.emote) {
        this.tryEmitEmote(client.sessionId, input.emote);
      }

      const prevInput = this.playerInputs.get(client.sessionId);
      const nextAngle =
        typeof input.angle === "number" && Number.isFinite(input.angle)
          ? input.angle
          : prevInput?.angle ?? player.angle;

      this.playerInputs.set(client.sessionId, {
        up: Boolean(input.up),
        down: Boolean(input.down),
        left: Boolean(input.left),
        right: Boolean(input.right),
        angle: nextAngle,
        shoot: shootPressed,
        interact: interactPressed,
        useAbility: abilityPressed,
        seq: typeof input.seq === "number" ? input.seq : 0,
      });
    };

    this.onMessage("input", handleInput);
    this.onMessage("playerInput", handleInput);
  }

  private tryEmitEmote(playerId: string, emote: EmoteType): void {
    if (!VALID_EMOTES.includes(emote)) return;
    const player = this.state.players.get(playerId);
    if (!player) return;

    const now = Date.now();
    const last = this.lastEmoteTime.get(playerId) ?? 0;
    if (now - last < EMOTE_COOLDOWN_MS) return;
    this.lastEmoteTime.set(playerId, now);

    const event: EmoteEvent = {
      playerId,
      x: player.x,
      y: player.y,
      emote,
    };
    this.broadcast("emote", event);
  }

  private checkAutoStart(): void {
    if (this.state.status !== "waiting") return;
    if (this.state.players.size >= 2 && this.areAllPlayersReady()) {
      this.startMatch();
    }
  }

  private areAllPlayersReady(): boolean {
    if (this.state.players.size < 2) return false;
    for (const player of this.state.players.values()) {
      if (!player.ready) return false;
    }
    return true;
  }

  private startMatch(): void {
    void this.lock();
    for (const player of this.state.players.values()) {
      player.score = 0;
      player.streak = 0;
      player.hasBounty = false;
    }
    this.startNewRound();
  }

  private startNewRound(): void {
    if (this.roundTransitionTimer) {
      this.roundTransitionTimer.clear();
      this.roundTransitionTimer = null;
    }
    this.roundEndingScheduled = false;

    const nextModifier = ArenaGenerator.pickRandomModifier(this.state.modifier);
    this.state.modifier = nextModifier;
    this.physics.setModifier(nextModifier);

    const arena = this.generateAndLoadArena(nextModifier);
    const playerIds = Array.from(this.state.players.keys());

    const shuffledSpawns = [...arena.spawnPoints];
    for (let i = shuffledSpawns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledSpawns[i], shuffledSpawns[j]] = [
        shuffledSpawns[j],
        shuffledSpawns[i],
      ];
    }

    const startingWeapon: WeaponType =
      nextModifier === "sniper_zero_g"
        ? "sniper"
        : nextModifier === "tiny_shotgun"
        ? "shotgun"
        : "pistol";

    playerIds.forEach((id, idx) => {
      const player = this.state.players.get(id);
      const spawn = shuffledSpawns[idx % shuffledSpawns.length];
      if (!player || !spawn) return;

      player.x = spawn.x;
      player.y = spawn.y;
      player.angle = spawn.angle;
      player.hp = PhysicsEngine.PLAYER_MAX_HP;
      player.maxHp = PhysicsEngine.PLAYER_MAX_HP;
      player.shield = 0;
      player.maxShield = PhysicsEngine.PLAYER_MAX_SHIELD;
      player.alive = true;
      player.isDowned = false;
      player.downedTimerMs = 0;
      player.weapon = startingWeapon;
      player.abilityCooldownMs = 0;
      player.shieldActive = false;
      player.hasHotPotato = false;
      player.hotPotatoTimerMs = 0;
      player.isInvisible = nextModifier === "all_invisible";
      player.isAirborne = false;

      this.shootLatched.set(id, false);
      this.interactLatched.set(id, false);
      this.abilityLatched.set(id, false);
      this.playerInputs.set(id, {
        up: false,
        down: false,
        left: false,
        right: false,
        angle: spawn.angle,
        shoot: false,
        interact: false,
        useAbility: false,
        seq: 0,
      });

      this.physics.spawnPlayer(
        id,
        player.name,
        spawn.x,
        spawn.y,
        spawn.angle,
        startingWeapon,
        player.ability,
        player.hasBounty
      );
    });

    if (nextModifier === "hot_potato") {
      const holderId = this.physics.assignHotPotato();
      if (holderId) {
        const holder = this.state.players.get(holderId);
        if (holder) {
          holder.hasHotPotato = true;
          holder.hotPotatoTimerMs = 12000;
        }
      }
    }

    const storm = this.physics.getStormState();
    this.state.stormX = storm.stormX;
    this.state.stormY = storm.stormY;
    this.state.stormRadius = storm.stormRadius;

    this.state.status = "playing";
  }

  private generateAndLoadArena(modifier = this.state.modifier) {
    const arena = ArenaGenerator.generate(modifier);

    this.state.mapWidth = arena.mapWidth;
    this.state.mapHeight = arena.mapHeight;
    this.state.obstacles.clear();
    this.state.hazardZones.clear();
    this.state.lootItems.clear();
    this.state.bullets.clear();

    for (const obs of arena.obstacles) {
      const obsSchema = new ObstacleSchema();
      obsSchema.id = obs.id;
      obsSchema.type = obs.type;
      obsSchema.x = obs.x;
      obsSchema.y = obs.y;
      obsSchema.radius = obs.radius;
      obsSchema.hp = obs.hp;
      obsSchema.maxHp = obs.maxHp;
      obsSchema.awake = Boolean(obs.awake);
      this.state.obstacles.set(obs.id, obsSchema);
    }

    this.physics.loadArena(arena.mapWidth, arena.mapHeight, arena.obstacles);
    const storm = this.physics.getStormState();
    this.state.stormX = storm.stormX;
    this.state.stormY = storm.stormY;
    this.state.stormRadius = storm.stormRadius;

    return arena;
  }

  private addLootToState(loot: LootItemState): void {
    const schema = new LootItemSchema();
    schema.id = loot.id;
    schema.kind = loot.kind;
    if (loot.weaponType) {
      schema.weaponType = loot.weaponType;
    }
    schema.x = loot.x;
    schema.y = loot.y;
    schema.amount = loot.amount ?? 35;
    this.state.lootItems.set(loot.id, schema);
  }

  private upsertHazardInState(zone: HazardZoneState): void {
    let schema = this.state.hazardZones.get(zone.id);
    if (!schema) {
      schema = new HazardZoneSchema();
      schema.id = zone.id;
      this.state.hazardZones.set(zone.id, schema);
    }
    schema.type = zone.type;
    schema.ownerId = zone.ownerId;
    schema.x = zone.x;
    schema.y = zone.y;
    schema.radius = zone.radius;
    schema.ttlMs = zone.ttlMs;
    schema.armed = zone.armed;
  }

  private updateSimulation(deltaTime: number): void {
    if (this.state.status !== "playing") return;

    const now = Date.now();

    for (const [playerId, player] of this.state.players.entries()) {
      if (!player.alive) continue;
      const input = this.playerInputs.get(playerId);
      if (!input) continue;

      const latchedShoot = Boolean(this.shootLatched.get(playerId));
      const latchedInteract = Boolean(this.interactLatched.get(playerId));
      const latchedAbility = Boolean(this.abilityLatched.get(playerId));
      this.shootLatched.set(playerId, false);
      this.interactLatched.set(playerId, false);
      this.abilityLatched.set(playerId, false);

      const effectiveInput: PlayerInput = {
        ...input,
        shoot: input.shoot || latchedShoot,
        interact: input.interact || latchedInteract,
        useAbility: input.useAbility || latchedAbility,
      };

      const spawnedBullets = this.physics.applyPlayerInput(
        playerId,
        effectiveInput,
        now
      );

      for (const b of spawnedBullets) {
        const bulletSchema = new BulletSchema();
        bulletSchema.id = b.id;
        bulletSchema.ownerId = b.ownerId;
        bulletSchema.x = b.x;
        bulletSchema.y = b.y;
        bulletSchema.vx = b.vx;
        bulletSchema.vy = b.vy;
        bulletSchema.weaponType = b.weaponType;
        bulletSchema.scale = b.scale;
        bulletSchema.isHoming = b.isHoming;
        bulletSchema.isBoomerang = b.isBoomerang;
        this.state.bullets.set(b.id, bulletSchema);
      }
    }

    this.physics.update(deltaTime, now);

    // Sincronizar tormenta
    const storm = this.physics.getStormState();
    this.state.stormX = storm.stormX;
    this.state.stormY = storm.stormY;
    this.state.stormRadius = Math.round(storm.stormRadius);

    // Sincronizar zonas de peligro activas
    for (const hz of this.physics.getActiveHazardZones()) {
      const schema = this.state.hazardZones.get(hz.id);
      if (schema) {
        schema.ttlMs = hz.ttlMs;
        schema.armed = hz.armed;
        schema.type = hz.type;
      }
    }

    // Sincronizar instantánea de jugadores
    for (const [playerId, player] of this.state.players.entries()) {
      const snap = this.physics.getPlayerSnapshot(playerId);
      if (snap) {
        player.x = snap.x;
        player.y = snap.y;
        player.angle = snap.angle;
        player.hp = snap.hp;
        player.maxHp = snap.maxHp;
        player.shield = snap.shield;
        player.maxShield = snap.maxShield;
        player.alive = snap.alive;
        player.isDowned = snap.isDowned;
        player.downedTimerMs = snap.downedTimerMs;
        player.weapon = snap.weapon;
        player.ability = snap.ability;
        player.abilityCooldownMs = snap.abilityCooldownMs;
        player.shieldActive = snap.shieldActive;
        player.hasHotPotato = snap.hasHotPotato;
        player.hotPotatoTimerMs = snap.hotPotatoTimerMs;
        player.isInvisible = snap.isInvisible;
        player.isAirborne = snap.isAirborne;
      }
    }

    // Sincronizar proyectiles activos
    const activeBullets = this.physics.getActiveBullets();
    for (const b of activeBullets) {
      let schema = this.state.bullets.get(b.id);
      if (!schema) {
        schema = new BulletSchema();
        schema.id = b.id;
        schema.ownerId = b.ownerId;
        schema.weaponType = b.weaponType;
        schema.scale = b.scale;
        schema.isHoming = b.isHoming;
        schema.isBoomerang = b.isBoomerang;
        this.state.bullets.set(b.id, schema);
      }
      schema.ownerId = b.ownerId;
      schema.x = b.x;
      schema.y = b.y;
      schema.vx = b.vx;
      schema.vy = b.vy;
    }

    this.checkRoundEndCondition();
  }

  private checkRoundEndCondition(): void {
    if (this.state.status !== "playing" || this.roundEndingScheduled) {
      return;
    }

    const standingPlayers: PlayerSchema[] = [];
    const downedPlayers: PlayerSchema[] = [];

    for (const player of this.state.players.values()) {
      if (!player.alive) continue;
      if (player.isDowned) {
        downedPlayers.push(player);
      } else {
        standingPlayers.push(player);
      }
    }

    // Si nadie queda en pie ni gateando: empate
    if (standingPlayers.length === 0 && downedPlayers.length === 0) {
      this.roundEndingScheduled = true;
      this.finishRound(null);
      return;
    }

    // Si queda 1 en pie y 0 gateando: gana el sobreviviente
    if (standingPlayers.length === 1 && downedPlayers.length === 0) {
      this.roundEndingScheduled = true;
      this.finishRound(standingPlayers[0]);
      return;
    }

    // Si solo queda 1 gateando y todos los demás ya murieron: sobrevive la ronda
    if (standingPlayers.length === 0 && downedPlayers.length === 1) {
      downedPlayers[0].isDowned = false;
      downedPlayers[0].hp = 30;
      this.roundEndingScheduled = true;
      this.finishRound(downedPlayers[0]);
    }
  }

  private finishRound(survivor: PlayerSchema | null): void {
    this.state.status = "round_end";

    let winnerId: string | null = null;
    if (survivor) {
      survivor.score += 1;
      winnerId = survivor.id;
    }

    const scores: Record<string, number> = {};
    let championReached = false;

    for (const [id, player] of this.state.players.entries()) {
      if (survivor && id === survivor.id) {
        player.streak += 1;
        player.hasBounty = player.streak >= 2;
      } else {
        player.streak = 0;
        player.hasBounty = false;
      }

      scores[id] = player.score;
      if (player.score >= WINNING_SCORE) {
        championReached = true;
      }
    }

    const roundEndEvent: RoundEndEvent = {
      winnerId,
      scores,
    };
    this.broadcast("roundEnd", roundEndEvent);

    this.roundTransitionTimer = this.clock.setTimeout(() => {
      if (championReached) {
        for (const player of this.state.players.values()) {
          player.score = 0;
          player.streak = 0;
          player.hasBounty = false;
        }
      }

      if (this.state.players.size < 2) {
        this.returnToWaiting(false);
        return;
      }

      this.startNewRound();
    }, ROUND_END_DELAY_MS);
  }

  private returnToWaiting(resetScores: boolean): void {
    if (this.roundTransitionTimer) {
      this.roundTransitionTimer.clear();
      this.roundTransitionTimer = null;
    }
    this.roundEndingScheduled = false;
    this.state.status = "waiting";
    this.state.modifier = "normal";
    this.generateAndLoadArena("normal");

    if (this.clients.length < this.maxClients) {
      void this.unlock();
    }

    const spawns = ArenaGenerator.getSpawnPoints(
      this.state.mapWidth,
      this.state.mapHeight
    );
    let idx = 0;
    for (const player of this.state.players.values()) {
      const sp = spawns[idx % spawns.length];
      idx++;
      player.ready = false;
      player.alive = true;
      player.isDowned = false;
      player.downedTimerMs = 0;
      player.hp = PhysicsEngine.PLAYER_MAX_HP;
      player.maxHp = PhysicsEngine.PLAYER_MAX_HP;
      player.shield = 0;
      player.maxShield = PhysicsEngine.PLAYER_MAX_SHIELD;
      player.weapon = "pistol";
      player.abilityCooldownMs = 0;
      player.shieldActive = false;
      player.hasHotPotato = false;
      player.hotPotatoTimerMs = 0;
      player.isInvisible = false;
      player.isAirborne = false;
      player.x = sp.x;
      player.y = sp.y;
      player.angle = sp.angle;
      if (resetScores) {
        player.score = 0;
        player.streak = 0;
        player.hasBounty = false;
      }
    }
  }

  private generateUniqueRoomCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = "";
      for (let i = 0; i < 4; i++) {
        code += ROOM_CODE_CHARS.charAt(
          Math.floor(Math.random() * ROOM_CODE_CHARS.length)
        );
      }
      if (!TankRoom.activeRoomCodes.has(code)) {
        return code;
      }
    }
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  private sanitizeName(
    rawName: string | undefined,
    fallbackNumber: number
  ): string {
    if (typeof rawName === "string") {
      const cleaned = rawName.trim().slice(0, 16);
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
    return `Jugador ${fallbackNumber}`;
  }

  private sanitizeColor(rawColor: string | undefined, index: number): string {
    if (
      typeof rawColor === "string" &&
      /^#[0-9A-Fa-f]{6}$/.test(rawColor.trim())
    ) {
      return rawColor.trim();
    }
    return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  }

  private sanitizeAbility(rawAbility: string | undefined): AbilityType {
    if (
      typeof rawAbility === "string" &&
      VALID_ABILITIES.includes(rawAbility as AbilityType)
    ) {
      return rawAbility as AbilityType;
    }
    return "dash";
  }
}
