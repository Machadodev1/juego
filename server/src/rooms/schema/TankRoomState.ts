import { Schema, MapSchema, type } from "@colyseus/schema";
import { BulletState, PlayerState, RoomStatus } from "@shared/types";

export class PlayerSchema extends Schema implements PlayerState {
  @type("string") id: string = "";
  @type("string") name: string = "Tanque";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") angle: number = 0;
  @type("string") color: string = "#3B82F6";
  @type("boolean") alive: boolean = true;
  @type("number") score: number = 0;
  @type("boolean") ready: boolean = false;
}

export class BulletSchema extends Schema implements BulletState {
  @type("string") id: string = "";
  @type("string") ownerId: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
}

export class TankRoomState extends Schema {
  @type("string") status: RoomStatus = "waiting";
  @type("string") roomCode: string = "";
  @type("string") mazeJson: string = "";
  @type("string") winnerId: string = "";
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: BulletSchema }) bullets = new MapSchema<BulletSchema>();
}
