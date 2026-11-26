import { Client, Room } from "colyseus.js";
import type {
  AbilityType,
  BulletHitEvent,
  BulletState,
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
  PlayerState,
  RoomStatus,
  RoundEndEvent,
  RoundModifier,
} from "@shared/types";
import { SERVER_URL } from "../constants";

export interface TankRoomSnapshot {
  roomId: string;
  sessionId: string;
  roomCode: string;
  status: RoomStatus;
  modifier: RoundModifier;
  mapWidth: number;
  mapHeight: number;
  stormRadius: number;
  stormX: number;
  stormY: number;
  players: Record<string, PlayerState>;
  obstacles: Record<string, ObstacleState>;
  hazardZones: Record<string, HazardZoneState>;
  lootItems: Record<string, LootItemState>;
  bullets: Record<string, BulletState>;
}

interface RawMapLike<T> {
  forEach?: (callback: (value: T, key: string) => void) => void;
}

interface RawGameRoomState {
  status?: RoomStatus;
  roomCode?: string;
  modifier?: RoundModifier;
  mapWidth?: number;
  mapHeight?: number;
  stormRadius?: number;
  stormX?: number;
  stormY?: number;
  players?: RawMapLike<PlayerState> & Record<string, PlayerState>;
  obstacles?: RawMapLike<ObstacleState> & Record<string, ObstacleState>;
  hazardZones?: RawMapLike<HazardZoneState> & Record<string, HazardZoneState>;
  lootItems?: RawMapLike<LootItemState> & Record<string, LootItemState>;
  bullets?: RawMapLike<BulletState> & Record<string, BulletState>;
}

type StateListener = (snapshot: TankRoomSnapshot | null) => void;
type BulletHitListener = (event: BulletHitEvent) => void;
type ExplosionListener = (event: ExplosionEvent) => void;
type CrateDestroyedListener = (event: CrateDestroyedEvent) => void;
type PlayerEliminatedListener = (event: PlayerEliminatedEvent) => void;
type EmoteListener = (event: EmoteEvent) => void;
type KillFeedListener = (event: KillFeedEvent) => void;
type RoundEndListener = (event: RoundEndEvent) => void;
type DisconnectListener = (reason?: string) => void;

function mapToRecord<T extends object>(
  source?: RawMapLike<T> & Record<string, T>
): Record<string, T> {
  const result: Record<string, T> = {};
  if (!source) return result;

  if (typeof source.forEach === "function") {
    source.forEach((value, key) => {
      result[key] = { ...value };
    });
  } else {
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === "object") {
        result[key] = { ...value };
      }
    }
  }
  return result;
}

function playersToRecord(
  source?: RawMapLike<PlayerState> & Record<string, PlayerState>
): Record<string, PlayerState> {
  const result: Record<string, PlayerState> = {};
  if (!source) return result;

  const normalize = (raw: PlayerState): PlayerState => ({
    id: raw.id,
    name: raw.name,
    x: raw.x,
    y: raw.y,
    angle: raw.angle,
    color: raw.color,
    hp: raw.hp ?? 100,
    maxHp: raw.maxHp ?? 100,
    shield: raw.shield ?? 0,
    maxShield: raw.maxShield ?? 50,
    alive: Boolean(raw.alive),
    isDowned: Boolean(raw.isDowned),
    downedTimerMs: raw.downedTimerMs ?? 0,
    score: raw.score ?? 0,
    streak: raw.streak ?? 0,
    hasBounty: Boolean(raw.hasBounty),
    ready: Boolean(raw.ready),
    weapon: raw.weapon || "pistol",
    ability: raw.ability || "dash",
    abilityCooldownMs: raw.abilityCooldownMs ?? 0,
    shieldActive: Boolean(raw.shieldActive),
    hasHotPotato: Boolean(raw.hasHotPotato),
    hotPotatoTimerMs: raw.hotPotatoTimerMs ?? 0,
    isInvisible: Boolean(raw.isInvisible),
    isAirborne: Boolean(raw.isAirborne),
  });

  if (typeof source.forEach === "function") {
    source.forEach((value, key) => {
      result[key] = normalize(value);
    });
  } else {
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === "object") {
        result[key] = normalize(value);
      }
    }
  }
  return result;
}

class ColyseusService {
  private client: Client;
  private room: Room<RawGameRoomState> | null = null;
  private snapshot: TankRoomSnapshot | null = null;

  private stateListeners = new Set<StateListener>();
  private bulletHitListeners = new Set<BulletHitListener>();
  private explosionListeners = new Set<ExplosionListener>();
  private crateDestroyedListeners = new Set<CrateDestroyedListener>();
  private playerEliminatedListeners = new Set<PlayerEliminatedListener>();
  private emoteListeners = new Set<EmoteListener>();
  private killFeedListeners = new Set<KillFeedListener>();
  private roundEndListeners = new Set<RoundEndListener>();
  private disconnectListeners = new Set<DisconnectListener>();

  constructor() {
    this.client = new Client(SERVER_URL);
  }

  public getSnapshot(): TankRoomSnapshot | null {
    return this.snapshot;
  }

  public isConnected(): boolean {
    return this.room !== null;
  }

  public async createRoom(
    name: string,
    color: string,
    ability: AbilityType = "dash"
  ): Promise<TankRoomSnapshot> {
    await this.leaveRoom();
    const room = await this.client.create<RawGameRoomState>("tank_room", {
      name,
      color,
      ability,
      create: true,
    });
    return this.attachRoom(room);
  }

  public async joinRoomByCode(
    roomCode: string,
    name: string,
    color: string,
    ability: AbilityType = "dash"
  ): Promise<TankRoomSnapshot> {
    await this.leaveRoom();
    const room = await this.client.join<RawGameRoomState>("tank_room", {
      roomCode: roomCode.trim().toUpperCase(),
      name,
      color,
      ability,
    });
    return this.attachRoom(room);
  }

  private attachRoom(room: Room<RawGameRoomState>): TankRoomSnapshot {
    this.room = room;

    const syncState = (state: RawGameRoomState) => {
      const mapWidth = state?.mapWidth || 1600;
      const mapHeight = state?.mapHeight || 1200;
      this.snapshot = {
        roomId: room.roomId,
        sessionId: room.sessionId,
        roomCode: state?.roomCode || "",
        status: state?.status || "waiting",
        modifier: state?.modifier || "normal",
        mapWidth,
        mapHeight,
        stormRadius: state?.stormRadius ?? 1100,
        stormX: state?.stormX ?? mapWidth / 2,
        stormY: state?.stormY ?? mapHeight / 2,
        players: playersToRecord(state?.players),
        obstacles: mapToRecord(state?.obstacles),
        hazardZones: mapToRecord(state?.hazardZones),
        lootItems: mapToRecord(state?.lootItems),
        bullets: mapToRecord(state?.bullets),
      };

      this.stateListeners.forEach((listener) => listener(this.snapshot));
    };

    room.onStateChange((state) => {
      syncState(state);
    });

    room.onMessage("bulletHit", (payload: BulletHitEvent) => {
      this.bulletHitListeners.forEach((listener) => listener(payload));
    });

    room.onMessage("explosion", (payload: ExplosionEvent) => {
      this.explosionListeners.forEach((listener) => listener(payload));
    });

    room.onMessage("crateDestroyed", (payload: CrateDestroyedEvent) => {
      this.crateDestroyedListeners.forEach((listener) => listener(payload));
    });

    room.onMessage("playerEliminated", (payload: PlayerEliminatedEvent) => {
      this.playerEliminatedListeners.forEach((listener) => listener(payload));
    });

    room.onMessage("emote", (payload: EmoteEvent) => {
      this.emoteListeners.forEach((listener) => listener(payload));
    });

    room.onMessage("killFeed", (payload: KillFeedEvent) => {
      this.killFeedListeners.forEach((listener) => listener(payload));
    });

    room.onMessage("roundEnd", (payload: RoundEndEvent) => {
      this.roundEndListeners.forEach((listener) => listener(payload));
    });

    room.onLeave((code) => {
      if (this.room === room) {
        this.room = null;
        this.snapshot = null;
        this.stateListeners.forEach((listener) => listener(null));
        this.disconnectListeners.forEach((listener) =>
          listener(code === 1000 ? undefined : `Desconectado (código ${code})`)
        );
      }
    });

    room.onError((code, message) => {
      this.disconnectListeners.forEach((listener) =>
        listener(`Error de sala (${code}): ${message ?? "desconocido"}`)
      );
    });

    syncState(room.state || {});
    return this.snapshot!;
  }

  public sendInput(input: PlayerInput): void {
    if (!this.room) return;
    this.room.send("input", input);
  }

  public sendEmote(emote: EmoteType): void {
    if (!this.room) return;
    this.room.send("emote", { emote });
  }

  public toggleReady(ready?: boolean): void {
    if (!this.room) return;
    this.room.send("ready", ready !== undefined ? { ready } : {});
  }

  public updateProfile(profile: {
    name?: string;
    color?: string;
    ability?: AbilityType;
  }): void {
    if (!this.room) return;
    this.room.send("updateProfile", profile);
  }

  public startGame(): void {
    if (!this.room) return;
    this.room.send("startGame", {});
  }

  public async leaveRoom(): Promise<void> {
    if (!this.room) return;
    const current = this.room;
    this.room = null;
    this.snapshot = null;
    try {
      await current.leave(true);
    } catch {
      // Ignorar conexiones cerradas
    }
    this.stateListeners.forEach((listener) => listener(null));
  }

  public subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public onBulletHit(listener: BulletHitListener): () => void {
    this.bulletHitListeners.add(listener);
    return () => {
      this.bulletHitListeners.delete(listener);
    };
  }

  public onExplosion(listener: ExplosionListener): () => void {
    this.explosionListeners.add(listener);
    return () => {
      this.explosionListeners.delete(listener);
    };
  }

  public onCrateDestroyed(listener: CrateDestroyedListener): () => void {
    this.crateDestroyedListeners.add(listener);
    return () => {
      this.crateDestroyedListeners.delete(listener);
    };
  }

  public onPlayerEliminated(listener: PlayerEliminatedListener): () => void {
    this.playerEliminatedListeners.add(listener);
    return () => {
      this.playerEliminatedListeners.delete(listener);
    };
  }

  public onEmote(listener: EmoteListener): () => void {
    this.emoteListeners.add(listener);
    return () => {
      this.emoteListeners.delete(listener);
    };
  }

  public onKillFeed(listener: KillFeedListener): () => void {
    this.killFeedListeners.add(listener);
    return () => {
      this.killFeedListeners.delete(listener);
    };
  }

  public onRoundEnd(listener: RoundEndListener): () => void {
    this.roundEndListeners.add(listener);
    return () => {
      this.roundEndListeners.delete(listener);
    };
  }

  public onDisconnect(listener: DisconnectListener): () => void {
    this.disconnectListeners.add(listener);
    return () => {
      this.disconnectListeners.delete(listener);
    };
  }
}

export const colyseusClient = new ColyseusService();
