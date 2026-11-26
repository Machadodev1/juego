import { Schema, MapSchema, ArraySchema, defineTypes } from "@colyseus/schema";
import type {
  ArenaTheme,
  BulletState,
  LootItemState,
  ObstacleState,
  ObstacleType,
  RoundModifier,
  RoomStatus,
  WeaponType,
} from "@shared/types";

export class PlayerSchema extends Schema {
  declare id: string;
  declare name: string;
  declare x: number;
  declare y: number;
  declare angle: number;
  declare color: string;
  declare hp: number;
  declare maxHp: number;
  declare alive: boolean;
  declare score: number;
  declare ready: boolean;
  declare weapon: WeaponType;
  declare inventory: ArraySchema<string>;
  declare activeSlot: number;

  constructor() {
    super();
    this.id = "";
    this.name = "Agente";
    this.x = 180;
    this.y = 180;
    this.angle = 0;
    this.color = "#22D3EE";
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.score = 0;
    this.ready = false;
    this.weapon = "pistol";
    this.inventory = new ArraySchema<string>("pistol");
    this.activeSlot = 0;
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
  alive: "boolean",
  score: "number",
  ready: "boolean",
  weapon: "string",
  inventory: ["string"],
  activeSlot: "number",
});

export class ObstacleSchema extends Schema implements ObstacleState {
  declare id: string;
  declare type: ObstacleType;
  declare x: number;
  declare y: number;
  declare radius: number;
  declare hp: number;
  declare maxHp: number;

  constructor() {
    super();
    this.id = "";
    this.type = "rock";
    this.x = 0;
    this.y = 0;
    this.radius = 38;
    this.hp = 9999;
    this.maxHp = 9999;
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
});

export class LootItemSchema extends Schema implements LootItemState {
  declare id: string;
  declare kind: "weapon" | "medkit";
  declare weaponType?: WeaponType;
  declare x: number;
  declare y: number;

  constructor() {
    super();
    this.id = "";
    this.kind = "medkit";
    this.x = 0;
    this.y = 0;
  }
}

defineTypes(LootItemSchema, {
  id: "string",
  kind: "string",
  weaponType: "string",
  x: "number",
  y: "number",
});

export class BulletSchema extends Schema implements BulletState {
  declare id: string;
  declare ownerId: string;
  declare x: number;
  declare y: number;
  declare vx: number;
  declare vy: number;
  declare weaponType: WeaponType;

  constructor() {
    super();
    this.id = "";
    this.ownerId = "";
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.weaponType = "pistol";
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
});

export class GameRoomState extends Schema {
  declare roomCode: string;
  declare status: RoomStatus;
  declare theme: ArenaTheme;
  declare preferredTheme: string;
  declare modifier: RoundModifier;
  declare mapWidth: number;
  declare mapHeight: number;
  declare players: MapSchema<PlayerSchema>;
  declare obstacles: MapSchema<ObstacleSchema>;
  declare lootItems: MapSchema<LootItemSchema>;
  declare bullets: MapSchema<BulletSchema>;

  constructor() {
    super();
    this.roomCode = "";
    this.status = "waiting";
    this.theme = "cyber_outpost";
    this.preferredTheme = "random";
    this.modifier = "normal";
    this.mapWidth = 1600;
    this.mapHeight = 1200;
    this.players = new MapSchema<PlayerSchema>();
    this.obstacles = new MapSchema<ObstacleSchema>();
    this.lootItems = new MapSchema<LootItemSchema>();
    this.bullets = new MapSchema<BulletSchema>();
  }
}

defineTypes(GameRoomState, {
  roomCode: "string",
  status: "string",
  theme: "string",
  preferredTheme: "string",
  modifier: "string",
  mapWidth: "number",
  mapHeight: "number",
  players: { map: PlayerSchema },
  obstacles: { map: ObstacleSchema },
  lootItems: { map: LootItemSchema },
  bullets: { map: BulletSchema },
});
