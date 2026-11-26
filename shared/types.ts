export type RoomStatus = "waiting" | "playing" | "round_end";

export type ArenaTheme = "cyber_outpost" | "midnight" | "arctic" | "desert";

export type WeaponType =
  | "pistol"
  | "smg"
  | "shotgun"
  | "rifle"
  | "burst"
  | "plasma"
  | "sniper";

export type RoundModifier =
  | "normal"
  | "speed_boost"
  | "ricochet"
  | "vampire"
  | "double_damage";

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  angle: number;
  shoot: boolean;
  interact: boolean;
  weaponSlot?: number;
  seq: number;
}

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  color: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  score: number;
  ready: boolean;
  weapon: WeaponType;
  inventory: WeaponType[];
  activeSlot: number;
}

export type ObstacleType = "tree" | "rock" | "crate";

export interface ObstacleState {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
}

export interface LootItemState {
  id: string;
  kind: "weapon" | "medkit";
  weaponType?: WeaponType;
  x: number;
  y: number;
}

export interface BulletState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  weaponType: WeaponType;
}

// Eventos Servidor -> Cliente
export interface BulletHitEvent {
  x: number;
  y: number;
  targetType: "wall" | "crate" | "player";
}

export interface CrateDestroyedEvent {
  id: string;
  x: number;
  y: number;
}

export interface PlayerEliminatedEvent {
  victimId: string;
  killerId: string;
  x: number;
  y: number;
}

export interface RoundEndEvent {
  winnerId: string | null;
  scores: Record<string, number>;
}
