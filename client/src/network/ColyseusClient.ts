import { Client, Room } from "colyseus.js";
import type {
  BulletBounceEvent,
  BulletState,
  MazeGrid,
  PlayerInput,
  PlayerState,
  RoomStatus,
  RoundEndEvent,
  TankDestroyedEvent,
} from "@shared/types";
import { SERVER_URL } from "../constants";

export interface TankRoomSnapshot {
  roomId: string;
  sessionId: string;
  roomCode: string;
  status: RoomStatus;
  winnerId: string;
  maze: MazeGrid | null;
  players: Record<string, PlayerState>;
  bullets: Record<string, BulletState>;
}

interface RawMapLike<T> {
  forEach?: (callback: (value: T, key: string) => void) => void;
}

interface RawTankRoomState {
  status?: RoomStatus;
  roomCode?: string;
  mazeJson?: string;
  winnerId?: string;
  players?: RawMapLike<PlayerState> & Record<string, PlayerState>;
  bullets?: RawMapLike<BulletState> & Record<string, BulletState>;
}

type StateListener = (snapshot: TankRoomSnapshot | null) => void;
type BounceListener = (event: BulletBounceEvent) => void;
type DestroyedListener = (event: TankDestroyedEvent) => void;
type RoundEndListener = (event: RoundEndEvent) => void;
type DisconnectListener = (reason?: string) => void;

function mapToRecord<T extends object>(source?: RawMapLike<T> & Record<string, T>): Record<string, T> {
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

class ColyseusService {
  private client: Client;
  private room: Room<RawTankRoomState> | null = null;
  private snapshot: TankRoomSnapshot | null = null;
  private lastMazeJson = "";
  private cachedMaze: MazeGrid | null = null;

  private stateListeners = new Set<StateListener>();
  private bounceListeners = new Set<BounceListener>();
  private destroyedListeners = new Set<DestroyedListener>();
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

  public async createRoom(name: string, color: string): Promise<TankRoomSnapshot> {
    await this.leaveRoom();
    const room = await this.client.create<RawTankRoomState>("tank_room", {
      name,
      color,
      create: true,
    });
    return this.attachRoom(room);
  }

  public async quickJoin(name: string, color: string): Promise<TankRoomSnapshot> {
    await this.leaveRoom();
    const room = await this.client.joinOrCreate<RawTankRoomState>("tank_room", {
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
    const room = await this.client.join<RawTankRoomState>("tank_room", {
      roomCode: roomCode.trim().toUpperCase(),
      name,
      color,
    });
    return this.attachRoom(room);
  }

  private attachRoom(room: Room<RawTankRoomState>): TankRoomSnapshot {
    this.room = room;
    this.lastMazeJson = "";
    this.cachedMaze = null;

    const syncState = (state: RawTankRoomState) => {
      const mazeJson = state?.mazeJson || "";
      if (mazeJson && mazeJson !== this.lastMazeJson) {
        try {
          this.cachedMaze = JSON.parse(mazeJson) as MazeGrid;
          this.lastMazeJson = mazeJson;
        } catch {
          this.cachedMaze = null;
        }
      } else if (!mazeJson) {
        this.cachedMaze = null;
        this.lastMazeJson = "";
      }

      this.snapshot = {
        roomId: room.roomId,
        sessionId: room.sessionId,
        roomCode: state?.roomCode || "",
        status: state?.status || "waiting",
        winnerId: state?.winnerId || "",
        maze: this.cachedMaze,
        players: mapToRecord(state?.players),
        bullets: mapToRecord(state?.bullets),
      };

      this.stateListeners.forEach((listener) => listener(this.snapshot));
    };

    room.onStateChange((state) => {
      syncState(state);
    });

    room.onMessage("bulletBounce", (payload: BulletBounceEvent) => {
      this.bounceListeners.forEach((listener) => listener(payload));
    });

    room.onMessage("tankDestroyed", (payload: TankDestroyedEvent) => {
      this.destroyedListeners.forEach((listener) => listener(payload));
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
    this.lastMazeJson = "";
    this.cachedMaze = null;
    try {
      await current.leave(true);
    } catch {
      // Ignore already closed connections
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

  public onBulletBounce(listener: BounceListener): () => void {
    this.bounceListeners.add(listener);
    return () => {
      this.bounceListeners.delete(listener);
    };
  }

  public onTankDestroyed(listener: DestroyedListener): () => void {
    this.destroyedListeners.add(listener);
    return () => {
      this.destroyedListeners.delete(listener);
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
