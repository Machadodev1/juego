export type RoomStatus = "waiting" | "playing" | "round_end";

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  seq: number;
}

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  color: string;
  alive: boolean;
  score: number;
  ready: boolean;
}

export interface BulletState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface MazeCell {
  row: number;
  col: number;
  walls: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

export interface MazeGrid {
  rows: number;
  cols: number;
  cellSize: number;
  cells: MazeCell[][];
}

// Eventos Servidor -> Cliente
export interface BulletBounceEvent {
  x: number;
  y: number;
}

export interface TankDestroyedEvent {
  victimId: string;
  killerId: string;
  x: number;
  y: number;
}

export interface RoundEndEvent {
  winnerId: string | null;
  scores: Record<string, number>;
}
