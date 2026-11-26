import { Client, Room } from "colyseus.js";
import type {
  ArenaTheme,
  BulletHitEvent,
  BulletState,
  CrateDestroyedEvent,
  LootItemState,
  ObstacleState,
  PlayerEliminatedEvent,
  PlayerInput,
  PlayerState,
  RoomStatus,
  RoundEndEvent,
  RoundModifier,
  WeaponType,
} from "@shared/types";
import { SERVER_URL } from "../constants";

export interface TankRoomSnapshot {
  roomId: string;
  sessionId: string;
  roomCode: string;
  status: RoomStatus;
  theme: ArenaTheme;
  preferredTheme: string;
  modifier: RoundModifier;
  mapWidth: number;
  mapHeight: number;
  players: Record<string, PlayerState>;
  obstacles: Record<string, ObstacleState>;
  lootItems: Record<string, LootItemState>;
  bullets: Record<string, BulletState>;
}

interface RawMapLike<T> {
  forEach?: (callback: (value: T, key: string) => void) => void;
}

interface RawGameRoomState {
  status?: RoomStatus;
  roomCode?: string;
  theme?: ArenaTheme;
  preferredTheme?: string;
  modifier?: RoundModifier;
  mapWidth?: number;
  mapHeight?: number;
  players?: RawMapLike<RawPlayer> & Record<string, RawPlayer>;
  obstacles?: RawMapLike<ObstacleState> & Record<string, ObstacleState>;
  lootItems?: RawMapLike<LootItemState> & Record<string, LootItemState>;
  bullets?: RawMapLike<BulletState> & Record<string, BulletState>;
}

type RawPlayer = Omit<PlayerState, "inventory"> & {
  inventory?: Iterable<string> | ArrayLike<string>;
};

type StateListener = (snapshot: TankRoomSnapshot | null) => void;
type BulletHitListener = (event: BulletHitEvent) => void;
type CrateDestroyedListener = (event: CrateDestroyedEvent) => void;
type PlayerEliminatedListener = (event: PlayerEliminatedEvent) => void;
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
  source?: RawMapLike<RawPlayer> & Record<string, RawPlayer>
): Record<string, PlayerState> {
  const result: Record<string, PlayerState> = {};
  if (!source) return result;

  const convert = (raw: RawPlayer): PlayerState => {
    const inv: WeaponType[] = raw.inventory
      ? (Array.from(raw.inventory as ArrayLike<string>) as WeaponType[])
      : ["pistol"];
    return {
      id: raw.id,
      name: raw.name,
      x: raw.x,
      y: raw.y,
      angle: raw.angle,
      color: raw.color,
      hp: raw.hp,
      maxHp: raw.maxHp,
      alive: raw.alive,
      score: raw.score,
      ready: raw.ready,
      weapon: raw.weapon,
      inventory: inv.length > 0 ? inv : ["pistol"],
      activeSlot: raw.activeSlot ?? 0,
    };
  };

  if (typeof source.forEach === "function") {
    source.forEach((value, key) => {
      result[key] = convert(value);
    });
  } else {
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === "object") {
        result[key] = convert(value);
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
  private crateDestroyedListeners = new Set<CrateDestroyedListener>();
  private playerEliminatedListeners = new Set<PlayerEliminatedListener>();
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
    theme = "random"
  ): Promise<TankRoomSnapshot> {
    await this.leaveRoom();
    const room = await this.client.create<RawGameRoomState>("tank_room", {
      name,
      color,
      theme,
      create: true,
    });
    return this.attachRoom(room);
  }

  public async quickJoin(name: string, color: string): Promise<TankRoomSnapshot> {
    await this.leaveRoom();
    const room = await this.client.joinOrCreate<RawGameRoomState>("tank_room", {
      name,
      color,
    });
    return this.attachRoom(room);
  }

  public async joinRoomByCode(
    roomCode: string,
    name: string,
    color: string
  ): Promise<TankRoomSnapshot> {
    await this.leaveRoom();
    const room = await this.client.join<RawGameRoomState>("tank_room", {
      roomCode: roomCode.trim().toUpperCase(),
      name,
      color,
    });
    return this.attachRoom(room);
  }

  private attachRoom(room: Room<RawGameRoomState>): TankRoomSnapshot {
    this.room = room;

    const syncState = (state: RawGameRoomState) => {
      this.snapshot = {
        roomId: room.roomId,
        sessionId: room.sessionId,
        roomCode: state?.roomCode || "",
        status: state?.status || "waiting",
        theme: state?.theme || "cyber_outpost",
        preferredTheme: state?.preferredTheme || "random",
        modifier: state?.modifier || "normal",
        mapWidth: state?.mapWidth || 1600,
        mapHeight: state?.mapHeight || 1200,
        players: playersToRecord(state?.players),
        obstacles: mapToRecord(state?.obstacles),
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

    room.onMessage("crateDestroyed", (payload: CrateDestroyedEvent) => {
      this.crateDestroyedListeners.forEach((listener) => listener(payload));
    });

    room.onMessage("playerEliminated", (payload: PlayerEliminatedEvent) => {
      this.playerEliminatedListeners.forEach((listener) => listener(payload));
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

  public selectSlot(slot: number): void {
    if (!this.room) return;
    this.room.send("selectSlot", { slot });
  }

  public selectTheme(theme: string): void {
    if (!this.room) return;
    this.room.send("selectTheme", { theme });
  }

  public toggleReady(ready?: boolean): void {
    if (!this.room) return;
    this.room.send("ready", ready !== undefined ? { ready } : {});
  }

  public updateProfile(profile: { name?: string; color?: string }): void {
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
      // Ignorar conexiones ya cerradas
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
