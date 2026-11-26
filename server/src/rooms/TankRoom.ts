import { Client, Delayed, Room } from "colyseus";
import type {
  BulletBounceEvent,
  PlayerInput,
  RoundEndEvent,
  TankDestroyedEvent,
} from "@shared/types";
import {
  BulletSchema,
  PlayerSchema,
  TankRoomState,
} from "./schema/TankRoomState";
import { MazeGenerator } from "../game/MazeGenerator";
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
  "#22D3EE", // Cian Neón
  "#EC4899", // Magenta
  "#A3E635", // Lima Ácido
  "#F59E0B", // Ámbar Solar
  "#8B5CF6", // Violeta
  "#EF4444", // Rojo
];

const WINNING_SCORE = 5;
const ROUND_END_DELAY_MS = 3000;
const CHAMPION_END_DELAY_MS = 4500;
const TICK_RATE_HZ = 60;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class TankRoom extends Room<TankRoomState> {
  public maxClients = 4;

  private physics!: PhysicsEngine;
  private playerInputs: Map<string, PlayerInput> = new Map();
  private shootLatched: Map<string, boolean> = new Map();
  private roundTransitionTimer: Delayed | null = null;
  private roundEndingScheduled: boolean = false;
  private static activeRoomCodes: Set<string> = new Set();

  onCreate(options: JoinOptions): void {
    this.setState(new TankRoomState());

    const requestedCode =
      typeof options?.roomCode === "string" &&
      /^[A-Z0-9]{4}$/i.test(options.roomCode.trim())
        ? options.roomCode.trim().toUpperCase()
        : this.generateUniqueRoomCode();

    this.state.roomCode = requestedCode;
    this.state.status = "waiting";
    TankRoom.activeRoomCodes.add(requestedCode);

    // Registrar roomCode directamente en el RoomListing del MatchMaker para que filterBy(['roomCode']) funcione al unirse por código
    options.roomCode = requestedCode;
    if (this.listing) {
      (this.listing as unknown as Record<string, unknown>).roomCode = requestedCode;
    }
    void this.setMetadata({ roomCode: requestedCode });

    // Inicializar motor de físicas con callbacks para emitir eventos de red a los clientes
    this.physics = new PhysicsEngine({
      onBulletBounce: (event: BulletBounceEvent) => {
        this.broadcast("bulletBounce", event);
      },
      onTankDestroyed: (event: TankDestroyedEvent) => {
        const victim = this.state.players.get(event.victimId);
        if (victim) {
          victim.alive = false;
        }
        this.broadcast("tankDestroyed", event);
        this.checkRoundEndCondition();
      },
      onBulletRemoved: (bulletId: string) => {
        this.state.bullets.delete(bulletId);
      },
    });

    // Generar un laberinto inicial para previsualización o primera partida
    this.generateAndLoadMaze();

    // Registrar handlers de mensajes desde el cliente
    this.registerMessageHandlers();

    // Sincronización de red a 30 Hz y bucle físico fijo a 60 Hz
    this.setPatchRate(1000 / 30);
    this.setSimulationInterval((deltaTime) => {
      this.updateSimulation(deltaTime);
    }, 1000 / TICK_RATE_HZ);
  }

  onJoin(client: Client, options: JoinOptions): void {
    const playerIndex = this.state.players.size;
    const player = new PlayerSchema();

    player.id = client.sessionId;
    player.name = this.sanitizeName(options?.name, playerIndex + 1);
    player.color = this.sanitizeColor(options?.color, playerIndex);
    player.alive = this.state.status === "waiting";
    player.score = 0;
    player.ready = false;

    // Ubicar en un punto del laberinto actual
    const currentMaze = JSON.parse(this.state.mazeJson);
    const spawns = MazeGenerator.getSpawnPoints(currentMaze, 4);
    const spawn = spawns[playerIndex % spawns.length];
    if (spawn) {
      player.x = spawn.x;
      player.y = spawn.y;
      player.angle = spawn.angle;
    }

    this.state.players.set(client.sessionId, player);
    this.shootLatched.set(client.sessionId, false);
    this.playerInputs.set(client.sessionId, {
      up: false,
      down: false,
      left: false,
      right: false,
      shoot: false,
      seq: 0,
    });
  }

  onLeave(client: Client): void {
    this.physics.removeTank(client.sessionId);
    this.playerInputs.delete(client.sessionId);
    this.shootLatched.delete(client.sessionId);
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
    // 1. Mensaje "ready": marca o alterna el estado listo del jugador en la sala de espera
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

    // 2. Mensaje "updateProfile": actualiza nombre y/o color del tanque en "waiting"
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

    // 3. Mensaje "startGame": permite iniciar partida cuando hay >= 2 jugadores en la sala
    this.onMessage("startGame", (client) => {
      if (this.state.status !== "waiting") return;
      if (this.state.players.size < 2) return;
      if (!this.state.players.has(client.sessionId)) return;

      this.startNewMatch();
    });

    // 4. Mensaje "input" (o PlayerInput directo): controles del tanque durante "playing"
    const handleInput = (client: Client, input: PlayerInput) => {
      if (this.state.status !== "playing" || !input) return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      const shootPressed = Boolean(input.shoot);
      if (shootPressed) {
        this.shootLatched.set(client.sessionId, true);
      }

      this.playerInputs.set(client.sessionId, {
        up: Boolean(input.up),
        down: Boolean(input.down),
        left: Boolean(input.left),
        right: Boolean(input.right),
        shoot: shootPressed,
        seq: typeof input.seq === "number" ? input.seq : 0,
      });
    };

    this.onMessage("input", handleInput);
    this.onMessage("playerInput", handleInput);
  }

  private checkAutoStart(): void {
    if (this.state.status !== "waiting") return;
    if (this.state.players.size >= 2 && this.areAllPlayersReady()) {
      this.startNewMatch();
    }
  }

  private areAllPlayersReady(): boolean {
    if (this.state.players.size < 2) return false;
    for (const player of this.state.players.values()) {
      if (!player.ready) return false;
    }
    return true;
  }

  private startNewMatch(): void {
    void this.lock();
    this.state.winnerId = "";
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

    this.physics.resetRound();
    this.state.bullets.clear();

    const maze = this.generateAndLoadMaze();
    const playerIds = Array.from(this.state.players.keys());
    const spawnPoints = MazeGenerator.getSpawnPoints(maze, playerIds.length);

    playerIds.forEach((id, index) => {
      const player = this.state.players.get(id);
      const spawn = spawnPoints[index];
      if (!player || !spawn) return;

      player.x = spawn.x;
      player.y = spawn.y;
      player.angle = spawn.angle;
      player.alive = true;

      this.shootLatched.set(id, false);
      this.playerInputs.set(id, {
        up: false,
        down: false,
        left: false,
        right: false,
        shoot: false,
        seq: 0,
      });

      this.physics.spawnTank(id, spawn.x, spawn.y, spawn.angle);
    });

    this.state.status = "playing";
  }

  private generateAndLoadMaze() {
    const maze = MazeGenerator.generate(12, 8, 80, 0.12);
    this.state.mazeJson = JSON.stringify(maze);
    this.physics.buildMazeWalls(maze);
    return maze;
  }

  private updateSimulation(deltaTime: number): void {
    if (this.state.status !== "playing") return;

    const now = Date.now();

    // 1. Aplicar inputs de todos los jugadores vivos y registrar nuevas balas disparadas
    for (const [playerId, player] of this.state.players.entries()) {
      if (!player.alive) continue;
      const input = this.playerInputs.get(playerId);
      if (!input) continue;

      const latchedShoot = Boolean(this.shootLatched.get(playerId));
      this.shootLatched.set(playerId, false);

      const effectiveInput: PlayerInput = {
        ...input,
        shoot: input.shoot || latchedShoot,
      };

      const spawnedBullet = this.physics.applyPlayerInput(playerId, effectiveInput, now);
      if (spawnedBullet) {
        const bulletSchema = new BulletSchema();
        bulletSchema.id = spawnedBullet.id;
        bulletSchema.ownerId = spawnedBullet.ownerId;
        bulletSchema.x = spawnedBullet.x;
        bulletSchema.y = spawnedBullet.y;
        bulletSchema.vx = spawnedBullet.vx;
        bulletSchema.vy = spawnedBullet.vy;
        this.state.bullets.set(spawnedBullet.id, bulletSchema);
      }
    }

    // 2. Avanzar paso de simulación Matter.js
    this.physics.update(deltaTime, now);

    // 3. Sincronizar transformaciones de tanques al estado Colyseus
    for (const [playerId, player] of this.state.players.entries()) {
      const transform = this.physics.getTankTransform(playerId);
      if (transform) {
        player.x = transform.x;
        player.y = transform.y;
        player.angle = transform.angle;
        player.alive = transform.alive;
      }
    }

    // 4. Sincronizar posiciones y velocidades de balas activas al estado Colyseus
    const activeBullets = this.physics.getActiveBullets();
    for (const b of activeBullets) {
      let schema = this.state.bullets.get(b.id);
      if (!schema) {
        schema = new BulletSchema();
        schema.id = b.id;
        schema.ownerId = b.ownerId;
        this.state.bullets.set(b.id, schema);
      }
      schema.x = b.x;
      schema.y = b.y;
      schema.vx = b.vx;
      schema.vy = b.vy;
    }
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
      this.state.winnerId = survivor.id;
    } else {
      this.state.winnerId = "";
    }

    const scores: Record<string, number> = {};
    let championId: string | null = null;

    for (const [id, player] of this.state.players.entries()) {
      scores[id] = player.score;
      if (player.score >= WINNING_SCORE) {
        championId = id;
      }
    }

    const roundEndEvent: RoundEndEvent = {
      winnerId,
      scores,
    };
    this.broadcast("roundEnd", roundEndEvent);

    const transitionDelay = championId ? CHAMPION_END_DELAY_MS : ROUND_END_DELAY_MS;

    // Esperar antes de generar el siguiente laberinto o volver a waiting si hay campeón
    this.roundTransitionTimer = this.clock.setTimeout(() => {
      if (this.state.players.size < 2) {
        this.returnToWaiting(false);
        return;
      }

      if (championId) {
        // Alguien llegó a 5 puntos: reiniciar marcadores y volver a "waiting" tras mostrar el campeón
        this.returnToWaiting(true);
      } else {
        this.startNewRound();
      }
    }, transitionDelay);
  }

  private returnToWaiting(resetScores: boolean): void {
    if (this.roundTransitionTimer) {
      this.roundTransitionTimer.clear();
      this.roundTransitionTimer = null;
    }
    this.roundEndingScheduled = false;
    this.physics.resetRound();
    this.state.bullets.clear();
    this.state.status = "waiting";

    if (this.clients.length < this.maxClients) {
      void this.unlock();
    }

    for (const player of this.state.players.values()) {
      player.ready = false;
      player.alive = true;
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
    return `Tanque ${fallbackNumber}`;
  }

  private sanitizeColor(rawColor: string | undefined, index: number): string {
    if (typeof rawColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(rawColor.trim())) {
      return rawColor.trim();
    }
    return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  }
}
