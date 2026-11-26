import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import type { BulletState, PlayerState, RoomStatus } from "@shared/types";

export class PlayerSchema extends Schema implements PlayerState {
  declare id: string;
  declare name: string;
  declare x: number;
  declare y: number;
  declare angle: number;
  declare color: string;
  declare alive: boolean;
  declare score: number;
  declare ready: boolean;

  constructor() {
    super();
    this.id = "";
    this.name = "Tanque";
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.color = "#22D3EE";
    this.alive = true;
    this.score = 0;
    this.ready = false;
  }
}

defineTypes(PlayerSchema, {
  id: "string",
  name: "string",
  x: "number",
  y: "number",
  angle: "number",
  color: "string",
  alive: "boolean",
  score: "number",
  ready: "boolean",
});

export class BulletSchema extends Schema implements BulletState {
  declare id: string;
  declare ownerId: string;
  declare x: number;
  declare y: number;
  declare vx: number;
  declare vy: number;

  constructor() {
    super();
    this.id = "";
    this.ownerId = "";
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
  }
}

defineTypes(BulletSchema, {
  id: "string",
  ownerId: "string",
  x: "number",
  y: "number",
  vx: "number",
  vy: "number",
});

export class TankRoomState extends Schema {
  declare status: RoomStatus;
  declare roomCode: string;
  declare mazeJson: string;
  declare winnerId: string;
  declare players: MapSchema<PlayerSchema>;
  declare bullets: MapSchema<BulletSchema>;

  constructor() {
    super();
    this.status = "waiting";
    this.roomCode = "";
    this.mazeJson = "";
    this.winnerId = "";
    this.players = new MapSchema<PlayerSchema>();
    this.bullets = new MapSchema<BulletSchema>();
  }
}

defineTypes(TankRoomState, {
  status: "string",
  roomCode: "string",
  mazeJson: "string",
  winnerId: "string",
  players: { map: PlayerSchema },
  bullets: { map: BulletSchema },
});
