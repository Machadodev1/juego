import { Client, Delayed, Room } from "colyseus";
import type {
  BulletHitEvent,
  CrateDestroyedEvent,
  LootItemState,
  PlayerEliminatedEvent,
  PlayerInput,
  RoundEndEvent,
  WeaponType,
} from "@shared/types";
import {
  BulletSchema,
  GameRoomState,
  LootItemSchema,
  ObstacleSchema,
  PlayerSchema,
} from "./schema/GameRoomState";
import { ArenaGenerator } from "../game/ArenaGenerator";
import { PhysicsEngine } from "../game/PhysicsEngine";

interface JoinOptions {
  name?: string;
  color?: string;
  roomCode?: string;
  create?: boolean;
}

interface ProfileUpdatePayload {
  name?: string;
  color?: string;
}

interface ReadyPayload {
  ready?: boolean;
}

const DEFAULT_COLORS = [
  "#22D3EE", // Cian
  "#EC4899", // Magenta
  "#A3E635", // Lima
  "#F59E0B", // Ámbar
  "#8B5CF6", // Violeta
  "#EF4444", // Rojo
];

const WINNING_SCORE = 5;
const ROUND_END_DELAY_MS = 3500;
const TICK_RATE_HZ = 60;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class TankRoom extends Room<GameRoomState> {
  public maxClients = 4;

  private physics!: PhysicsEngine;
  private playerInputs: Map<string, PlayerInput> = new Map();
  private shootLatched: Map<string, boolean> = new Map();
  private interactLatched: Map<string, boolean> = new Map();
  private roundTransitionTimer: Delayed | null = null;
  private roundEndingScheduled: boolean = false;

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

    TankRoom.activeRoomCodes.add(requestedCode);

    // Registrar roomCode en el RoomListing de Colyseus para que filterBy(["roomCode"]) funcione al unirse
    options.roomCode = requestedCode;
    if (this.listing) {
      (this.listing as unknown as Record<string, unknown>).roomCode = requestedCode;
    }
    void this.setMetadata({ roomCode: requestedCode });

    this.physics = new PhysicsEngine({
      onBulletHit: (event: BulletHitEvent) => {
        this.broadcast("bulletHit", event);
      },
      onObstacleDamaged: (obstacleId: string, hp: number) => {
        const obs = this.state.obstacles.get(obstacleId);
        if (obs) {
          obs.hp = hp;
        }
      },
      onCrateDestroyed: (event: CrateDestroyedEvent, spawnedLoot: LootItemState) => {
        this.state.obstacles.delete(event.id);
        this.addLootToState(spawnedLoot);
        this.broadcast("crateDestroyed", event);
      },
      onPlayerDamaged: (playerId: string, hp: number) => {
        const player = this.state.players.get(playerId);
        if (player) {
          player.hp = hp;
        }
      },
      onPlayerHealed: (playerId: string, hp: number) => {
        const player = this.state.players.get(playerId);
        if (player) {
          player.hp = hp;
        }
      },
      onPlayerWeaponChanged: (playerId: string, weapon: WeaponType) => {
        const player = this.state.players.get(playerId);
        if (player) {
          player.weapon = weapon;
        }
      },
      onPlayerEliminated: (event: PlayerEliminatedEvent) => {
        const victim = this.state.players.get(event.victimId);
        if (victim) {
          victim.hp = 0;
          victim.alive = false;
        }
        this.broadcast("playerEliminated", event);
        this.checkRoundEndCondition();
      },
      onBulletRemoved: (bulletId: string) => {
        this.state.bullets.delete(bulletId);
      },
      onLootPickedUp: (lootId: string) => {
        this.state.lootItems.delete(lootId);
      },
    });

    // Generar una arena inicial para previsualización / primera partida
    this.generateAndLoadArena();

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
    player.x = spawn.x;
    player.y = spawn.y;
    player.angle = spawn.angle;
    player.hp = PhysicsEngine.PLAYER_MAX_HP;
    player.maxHp = PhysicsEngine.PLAYER_MAX_HP;
    player.alive = this.state.status === "waiting";
    player.score = 0;
    player.ready = false;
    player.weapon = "pistol";

    this.state.players.set(client.sessionId, player);
    this.shootLatched.set(client.sessionId, false);
    this.interactLatched.set(client.sessionId, false);
    this.playerInputs.set(client.sessionId, {
      up: false,
      down: false,
      left: false,
      right: false,
      angle: spawn.angle,
      shoot: false,
      interact: false,
      seq: 0,
    });
  }

  onLeave(client: Client): void {
    this.physics.removePlayer(client.sessionId);
    this.playerInputs.delete(client.sessionId);
    this.shootLatched.delete(client.sessionId);
    this.interactLatched.delete(client.sessionId);
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
    // 1. "updateProfile": actualiza name y color mientras status === "waiting"
    this.onMessage("updateProfile", (client, payload: ProfileUpdatePayload) => {
      if (this.state.status !== "waiting") return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !payload) return;

      if (typeof payload.name === "string" && payload.name.trim().length > 0) {
        player.name = this.sanitizeName(payload.name, 1);
      }
      if (typeof payload.color === "string" && payload.color.trim().length > 0) {
        player.color = this.sanitizeColor(payload.color, 0);
      }
    });

    // 2. "ready": alterna player.ready en "waiting" e inicia cuando >= 2 jugadores están listos
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

    // Soporte opcional de inicio directo ("startGame") cuando hay >= 2 jugadores
    this.onMessage("startGame", (client) => {
      if (this.state.status !== "waiting") return;
      if (this.state.players.size < 2) return;
      if (!this.state.players.has(client.sessionId)) return;

      this.startMatch();
    });

    // 3. "input": guarda el último PlayerInput para aplicarlo en el ciclo físico a 60 Hz
    const handleInput = (client: Client, input: PlayerInput) => {
      if (this.state.status !== "playing" || !input) return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      const shootPressed = Boolean(input.shoot);
      const interactPressed = Boolean(input.interact);

      if (shootPressed) {
        this.shootLatched.set(client.sessionId, true);
      }
      if (interactPressed) {
        this.interactLatched.set(client.sessionId, true);
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
        seq: typeof input.seq === "number" ? input.seq : 0,
      });
    };

    this.onMessage("input", handleInput);
    this.onMessage("playerInput", handleInput);
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
    }
    this.startNewRound();
  }

  private startNewRound(): void {
    if (this.roundTransitionTimer) {
      this.roundTransitionTimer.clear();
      this.roundTransitionTimer = null;
    }
    this.roundEndingScheduled = false;

    const nextModifier = ArenaGenerator.pickRandomModifier();

    this.state.modifier = nextModifier;
    this.physics.setModifier(nextModifier);

    const arena = this.generateAndLoadArena();
    const playerIds = Array.from(this.state.players.keys());

    // Barajar los 4 puntos de aparición para que las esquinas roten de forma justa cada ronda
    const shuffledSpawns = [...arena.spawnPoints];
    for (let i = shuffledSpawns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledSpawns[i], shuffledSpawns[j]] = [
        shuffledSpawns[j],
        shuffledSpawns[i],
      ];
    }

    playerIds.forEach((id, idx) => {
      const player = this.state.players.get(id);
      const spawn = shuffledSpawns[idx % shuffledSpawns.length];
      if (!player || !spawn) return;

      player.x = spawn.x;
      player.y = spawn.y;
      player.angle = spawn.angle;
      player.hp = PhysicsEngine.PLAYER_MAX_HP;
      player.maxHp = PhysicsEngine.PLAYER_MAX_HP;
      player.alive = true;
      player.weapon = "pistol";

      this.shootLatched.set(id, false);
      this.interactLatched.set(id, false);
      this.playerInputs.set(id, {
        up: false,
        down: false,
        left: false,
        right: false,
        angle: spawn.angle,
        shoot: false,
        interact: false,
        seq: 0,
      });

      this.physics.spawnPlayer(id, spawn.x, spawn.y, spawn.angle, "pistol");
    });

    this.state.status = "playing";
  }

  private generateAndLoadArena() {
    const arena = ArenaGenerator.generate(
      ArenaGenerator.MAP_WIDTH,
      ArenaGenerator.MAP_HEIGHT
    );

    this.state.mapWidth = arena.mapWidth;
    this.state.mapHeight = arena.mapHeight;
    this.state.obstacles.clear();
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
      this.state.obstacles.set(obs.id, obsSchema);
    }

    this.physics.loadArena(arena.mapWidth, arena.mapHeight, arena.obstacles);
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
    this.state.lootItems.set(loot.id, schema);
  }

  private updateSimulation(deltaTime: number): void {
    if (this.state.status !== "playing") return;

    const now = Date.now();

    // 1. Aplicar inputs de jugadores vivos y registrar proyectiles disparados
    for (const [playerId, player] of this.state.players.entries()) {
      if (!player.alive) continue;
      const input = this.playerInputs.get(playerId);
      if (!input) continue;

      const latchedShoot = Boolean(this.shootLatched.get(playerId));
      const latchedInteract = Boolean(this.interactLatched.get(playerId));
      this.shootLatched.set(playerId, false);
      this.interactLatched.set(playerId, false);

      const effectiveInput: PlayerInput = {
        ...input,
        shoot: input.shoot || latchedShoot,
        interact: input.interact || latchedInteract,
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
        this.state.bullets.set(b.id, bulletSchema);
      }
    }

    // 2. Avanzar paso de simulación Matter.js
    this.physics.update(deltaTime);

    // 3. Sincronizar estado autoritativo de los jugadores
    for (const [playerId, player] of this.state.players.entries()) {
      const snap = this.physics.getPlayerSnapshot(playerId);
      if (snap) {
        player.x = snap.x;
        player.y = snap.y;
        player.angle = snap.angle;
        player.hp = snap.hp;
        player.maxHp = snap.maxHp;
        player.alive = snap.alive;
        player.weapon = snap.weapon;
      }
    }

    // 4. Sincronizar estado autoritativo de los proyectiles activos
    const activeBullets = this.physics.getActiveBullets();
    for (const b of activeBullets) {
      let schema = this.state.bullets.get(b.id);
      if (!schema) {
        schema = new BulletSchema();
        schema.id = b.id;
        schema.ownerId = b.ownerId;
        schema.weaponType = b.weaponType;
        this.state.bullets.set(b.id, schema);
      }
      schema.x = b.x;
      schema.y = b.y;
      schema.vx = b.vx;
      schema.vy = b.vy;
    }

    // 5. Verificar condición de fin de ronda por si la última baja ocurrió en este tick
    this.checkRoundEndCondition();
  }

  private checkRoundEndCondition(): void {
    if (this.state.status !== "playing" || this.roundEndingScheduled) {
      return;
    }

    const alivePlayers: PlayerSchema[] = [];
    for (const player of this.state.players.values()) {
      if (player.alive) {
        alivePlayers.push(player);
      }
    }

    if (alivePlayers.length <= 1) {
      this.roundEndingScheduled = true;
      this.finishRound(alivePlayers[0] ?? null);
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

    // Tras 3.5 segundos genera nueva arena, nuevo modificador aleatorio y revive a todos (reiniciando marcadores si alguien llegó a 5)
    this.roundTransitionTimer = this.clock.setTimeout(() => {
      if (championReached) {
        for (const player of this.state.players.values()) {
          player.score = 0;
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
    this.generateAndLoadArena();

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
      player.hp = PhysicsEngine.PLAYER_MAX_HP;
      player.maxHp = PhysicsEngine.PLAYER_MAX_HP;
      player.weapon = "pistol";
      player.x = sp.x;
      player.y = sp.y;
      player.angle = sp.angle;
      if (resetScores) {
        player.score = 0;
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

  private sanitizeName(rawName: string | undefined, fallbackNumber: number): string {
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
}
