import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import type {
  AbilityType,
  BulletState,
  HazardZoneState,
  HazardZoneType,
  LootItemState,
  ObstacleState,
  ObstacleType,
  PlayerState,
  RoomStatus,
  RoundModifier,
  WeaponType,
} from "@shared/types";

export class PlayerSchema extends Schema implements PlayerState {
  declare id: string;
  declare name: string;
  declare x: number;
  declare y: number;
  declare angle: number;
  declare color: string;
  declare hp: number;
  declare maxHp: number;
  declare shield: number;
  declare maxShield: number;
  declare alive: boolean;
  declare isDowned: boolean;
  declare downedTimerMs: number;
  declare score: number;
  declare streak: number;
  declare hasBounty: boolean;
  declare ready: boolean;
  declare weapon: WeaponType;
  declare ability: AbilityType;
  declare abilityCooldownMs: number;
  declare shieldActive: boolean;
  declare hasHotPotato: boolean;
  declare hotPotatoTimerMs: number;
  declare isInvisible: boolean;
  declare isAirborne: boolean;

  constructor() {
    super();
    this.id = "";
    this.name = "Jugador";
    this.x = 180;
    this.y = 180;
    this.angle = 0;
    this.color = "#22D3EE";
    this.hp = 100;
    this.maxHp = 100;
    this.shield = 0;
    this.maxShield = 50;
    this.alive = true;
    this.isDowned = false;
    this.downedTimerMs = 0;
    this.score = 0;
    this.streak = 0;
    this.hasBounty = false;
    this.ready = false;
    this.weapon = "pistol";
    this.ability = "dash";
    this.abilityCooldownMs = 0;
    this.shieldActive = false;
    this.hasHotPotato = false;
    this.hotPotatoTimerMs = 0;
    this.isInvisible = false;
    this.isAirborne = false;
  }
}

defineTypes(PlayerSchema, {
  id: "string",
  name: "string",
  x: "number",
  y: "number",
  angle: "number",
  color: "string",
  hp: "number",
  maxHp: "number",
  shield: "number",
  maxShield: "number",
  alive: "boolean",
  isDowned: "boolean",
  downedTimerMs: "number",
  score: "number",
  streak: "number",
  hasBounty: "boolean",
  ready: "boolean",
  weapon: "string",
  ability: "string",
  abilityCooldownMs: "number",
  shieldActive: "boolean",
  hasHotPotato: "boolean",
  hotPotatoTimerMs: "number",
  isInvisible: "boolean",
  isAirborne: "boolean",
});

export class ObstacleSchema extends Schema implements ObstacleState {
  declare id: string;
  declare type: ObstacleType;
  declare x: number;
  declare y: number;
  declare radius: number;
  declare hp: number;
  declare maxHp: number;
  declare awake?: boolean;

  constructor() {
    super();
    this.id = "";
    this.type = "rock";
    this.x = 0;
    this.y = 0;
    this.radius = 36;
    this.hp = 9999;
    this.maxHp = 9999;
    this.awake = false;
  }
}

defineTypes(ObstacleSchema, {
  id: "string",
  type: "string",
  x: "number",
  y: "number",
  radius: "number",
  hp: "number",
  maxHp: "number",
  awake: "boolean",
});

export class HazardZoneSchema extends Schema implements HazardZoneState {
  declare id: string;
  declare type: HazardZoneType;
  declare ownerId: string;
  declare x: number;
  declare y: number;
  declare radius: number;
  declare ttlMs: number;
  declare armed: boolean;

  constructor() {
    super();
    this.id = "";
    this.type = "fire";
    this.ownerId = "";
    this.x = 0;
    this.y = 0;
    this.radius = 45;
    this.ttlMs = 5000;
    this.armed = true;
  }
}

defineTypes(HazardZoneSchema, {
  id: "string",
  type: "string",
  ownerId: "string",
  x: "number",
  y: "number",
  radius: "number",
  ttlMs: "number",
  armed: "boolean",
});

export class LootItemSchema extends Schema implements LootItemState {
  declare id: string;
  declare kind: "weapon" | "medkit" | "shield";
  declare weaponType?: WeaponType;
  declare x: number;
  declare y: number;
  declare amount?: number;

  constructor() {
    super();
    this.id = "";
    this.kind = "medkit";
    this.x = 0;
    this.y = 0;
    this.amount = 35;
  }
}

defineTypes(LootItemSchema, {
  id: "string",
  kind: "string",
  weaponType: "string",
  x: "number",
  y: "number",
  amount: "number",
});

export class BulletSchema extends Schema implements BulletState {
  declare id: string;
  declare ownerId: string;
  declare x: number;
  declare y: number;
  declare vx: number;
  declare vy: number;
  declare weaponType: WeaponType;
  declare scale: number;
  declare isHoming: boolean;
  declare isBoomerang: boolean;

  constructor() {
    super();
    this.id = "";
    this.ownerId = "";
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.weaponType = "pistol";
    this.scale = 1;
    this.isHoming = false;
    this.isBoomerang = false;
  }
}

defineTypes(BulletSchema, {
  id: "string",
  ownerId: "string",
  x: "number",
  y: "number",
  vx: "number",
  vy: "number",
  weaponType: "string",
  scale: "number",
  isHoming: "boolean",
  isBoomerang: "boolean",
});

export class GameRoomState extends Schema {
  declare roomCode: string;
  declare status: RoomStatus;
  declare modifier: RoundModifier;
  declare mapWidth: number;
  declare mapHeight: number;
  declare stormRadius: number;
  declare stormX: number;
  declare stormY: number;
  declare players: MapSchema<PlayerSchema>;
  declare obstacles: MapSchema<ObstacleSchema>;
  declare hazardZones: MapSchema<HazardZoneSchema>;
  declare lootItems: MapSchema<LootItemSchema>;
  declare bullets: MapSchema<BulletSchema>;

  constructor() {
    super();
    this.roomCode = "";
    this.status = "waiting";
    this.modifier = "normal";
    this.mapWidth = 1600;
    this.mapHeight = 1200;
    this.stormRadius = 1300;
    this.stormX = 800;
    this.stormY = 600;
    this.players = new MapSchema<PlayerSchema>();
    this.obstacles = new MapSchema<ObstacleSchema>();
    this.hazardZones = new MapSchema<HazardZoneSchema>();
    this.lootItems = new MapSchema<LootItemSchema>();
    this.bullets = new MapSchema<BulletSchema>();
  }
}

defineTypes(GameRoomState, {
  roomCode: "string",
  status: "string",
  modifier: "string",
  mapWidth: "number",
  mapHeight: "number",
  stormRadius: "number",
  stormX: "number",
  stormY: "number",
  players: { map: PlayerSchema },
  obstacles: { map: ObstacleSchema },
  hazardZones: { map: HazardZoneSchema },
  lootItems: { map: LootItemSchema },
  bullets: { map: BulletSchema },
});
