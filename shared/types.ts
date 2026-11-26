export type RoomStatus = "waiting" | "playing" | "round_end";

export type WeaponType =
  | "pistol"
  | "shotgun"
  | "rifle"
  | "sniper"
  | "impulse_gun"
  | "flamethrower"
  | "saw_disc"
  | "bee_cannon"
  | "grappling_hook";

export type AbilityType =
  | "dash"
  | "energy_shield"
  | "proximity_mine"
  | "smoke_grenade";

export type RoundModifier =
  | "normal"
  | "speed_boost"
  | "ricochet"
  | "vampire"
  | "double_damage"
  | "hot_potato"
  | "sniper_zero_g"
  | "tiny_shotgun"
  | "all_invisible"
  | "giant_bullets";

export type ObstacleType =
  | "tree"
  | "rock"
  | "crate"
  | "golden_crate"
  | "explosive_barrel"
  | "oil_barrel"
  | "bush"
  | "jump_pad"
  | "mimic_crate";

export type EmoteType = "laugh" | "skull" | "gg" | "chicken";

export type HazardZoneType = "fire" | "oil" | "smoke" | "mine";

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  angle: number;
  shoot: boolean;
  interact: boolean;
  useAbility: boolean;
  emote?: EmoteType;
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
  shield: number;
  maxShield: number;
  alive: boolean;
  isDowned: boolean;
  downedTimerMs: number;
  score: number;
  streak: number;
  hasBounty: boolean;
  ready: boolean;
  weapon: WeaponType;
  ability: AbilityType;
  abilityCooldownMs: number;
  shieldActive: boolean;
  hasHotPotato: boolean;
  hotPotatoTimerMs: number;
  isInvisible: boolean;
  isAirborne: boolean;
}

export interface ObstacleState {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  awake?: boolean;
}

export interface HazardZoneState {
  id: string;
  type: HazardZoneType;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  ttlMs: number;
  armed: boolean;
}

export interface LootItemState {
  id: string;
  kind: "weapon" | "medkit" | "shield";
  weaponType?: WeaponType;
  x: number;
  y: number;
  amount?: number;
}

export interface BulletState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  weaponType: WeaponType;
  scale: number;
  isHoming: boolean;
  isBoomerang: boolean;
}

// Eventos Servidor -> Cliente
export interface BulletHitEvent {
  x: number;
  y: number;
  targetType: "wall" | "crate" | "player" | "shield";
  damage?: number;
}

export interface ExplosionEvent {
  x: number;
  y: number;
  radius: number;
  kind: "barrel" | "potato" | "mine" | "jump_land" | "mimic";
}

export interface EmoteEvent {
  playerId: string;
  x: number;
  y: number;
  emote: EmoteType;
}

export interface KillFeedEvent {
  killerName: string;
  victimName: string;
  weapon: string;
}

export interface CrateDestroyedEvent {
  id: string;
  x: number;
  y: number;
  isGolden?: boolean;
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
