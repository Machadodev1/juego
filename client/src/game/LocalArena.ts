import type {
  BulletHitEvent,
  BulletState,
  CrateDestroyedEvent,
  LootItemState,
  ObstacleState,
  ObstacleType,
  PlayerEliminatedEvent,
  PlayerInput,
  PlayerState,
  RoundModifier,
  WeaponType,
} from "@shared/types";

interface LocalBullet extends BulletState {
  damage: number;
  maxRange: number;
  traveled: number;
  bounces: number;
}

interface LocalCallbacks {
  onShoot?: (x: number, y: number, angle: number, color: string) => void;
  onBulletHit?: (event: BulletHitEvent) => void;
  onCrateDestroyed?: (event: CrateDestroyedEvent) => void;
  onPickup?: () => void;
  onEliminated?: (event: PlayerEliminatedEvent) => void;
}

const LOCAL_WEAPONS: Record<
  WeaponType,
  {
    damage: number;
    cooldown: number;
    pellets: number;
    spreadDeg: number;
    speed: number;
    maxRange: number;
    fan: boolean;
  }
> = {
  pistol: {
    damage: 15,
    cooldown: 0.3,
    pellets: 1,
    spreadDeg: 0,
    speed: 750,
    maxRange: 700,
    fan: false,
  },
  shotgun: {
    damage: 12,
    cooldown: 0.85,
    pellets: 5,
    spreadDeg: 25,
    speed: 680,
    maxRange: 380,
    fan: true,
  },
  rifle: {
    damage: 14,
    cooldown: 0.13,
    pellets: 1,
    spreadDeg: 4,
    speed: 900,
    maxRange: 950,
    fan: false,
  },
  sniper: {
    damage: 65,
    cooldown: 1.2,
    pellets: 1,
    spreadDeg: 0,
    speed: 1350,
    maxRange: 1400,
    fan: false,
  },
};

const MODIFIERS: RoundModifier[] = [
  "normal",
  "speed_boost",
  "ricochet",
  "vampire",
  "double_damage",
];

export class LocalArena {
  public readonly mapWidth = 1600;
  public readonly mapHeight = 1200;
  public readonly localId = "local-player";

  public modifier: RoundModifier = "normal";
  public players: Record<string, PlayerState> = {};
  public obstacles: Record<string, ObstacleState> = {};
  public lootItems: Record<string, LootItemState> = {};
  public bullets: Record<string, BulletState> = {};

  private internalBullets = new Map<string, LocalBullet>();
  private cooldowns = new Map<string, number>();
  private respawnTimers = new Map<string, number>();
  private botWanderAngles = new Map<string, number>();
  private bulletSeq = 0;
  private lootSeq = 0;

  private callbacks: LocalCallbacks;
  private playerName: string;
  private playerColor: string;

  constructor(
    playerName: string,
    playerColor: string,
    callbacks: LocalCallbacks = {}
  ) {
    this.playerName = playerName || "Piloto";
    this.playerColor = playerColor;
    this.callbacks = callbacks;
    this.resetArena();
  }

  public resetArena(): void {
    this.modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
    this.internalBullets.clear();
    this.bullets = {};
    this.lootItems = {};
    this.cooldowns.clear();
    this.respawnTimers.clear();
    this.generateObstacles();
    this.spawnEntities();
  }

  private generateObstacles(): void {
    const spawns = [
      { x: 180, y: 180 },
      { x: 1420, y: 180 },
      { x: 180, y: 1020 },
      { x: 1420, y: 1020 },
    ];
    const specs: Array<{
      type: ObstacleType;
      count: number;
      radius: number;
      hp: number;
    }> = [
      { type: "rock", count: 10, radius: 38, hp: 9999 },
      { type: "tree", count: 12, radius: 22, hp: 9999 },
      { type: "crate", count: 14, radius: 28, hp: 40 },
    ];

    const list: ObstacleState[] = [];
    let seq = 0;

    for (const s of specs) {
      let placed = 0;
      let tries = 0;
      while (placed < s.count && tries < s.count * 100) {
        tries++;
        const x = Math.round(65 + s.radius + Math.random() * (this.mapWidth - 130 - s.radius * 2));
        const y = Math.round(65 + s.radius + Math.random() * (this.mapHeight - 130 - s.radius * 2));

        if (spawns.some((sp) => Math.hypot(x - sp.x, y - sp.y) < 160 + s.radius)) {
          continue;
        }
        if (list.some((o) => Math.hypot(x - o.x, y - o.y) < s.radius + o.radius + 20)) {
          continue;
        }

        list.push({
          id: `lobs_${++seq}`,
          type: s.type,
          x,
          y,
          radius: s.radius,
          hp: s.hp,
          maxHp: s.hp,
        });
        placed++;
      }
    }

    const next: Record<string, ObstacleState> = {};
    for (const o of list) next[o.id] = o;
    this.obstacles = next;
  }

  private spawnEntities(): void {
    const prevLocalScore = this.players[this.localId]?.score ?? 0;
    this.players = {
      [this.localId]: {
        id: this.localId,
        name: this.playerName,
        x: 180,
        y: 180,
        angle: 0.6,
        color: this.playerColor,
        hp: 100,
        maxHp: 100,
        alive: true,
        score: prevLocalScore,
        ready: true,
        weapon: "pistol",
      },
      "bot-1": {
        id: "bot-1",
        name: "Bot Escopetero",
        x: 1420,
        y: 180,
        angle: Math.PI,
        color: "#EC4899",
        hp: 100,
        maxHp: 100,
        alive: true,
        score: 0,
        ready: true,
        weapon: "shotgun",
      },
      "bot-2": {
        id: "bot-2",
        name: "Bot Asalto",
        x: 180,
        y: 1020,
        angle: 0,
        color: "#F59E0B",
        hp: 100,
        maxHp: 100,
        alive: true,
        score: 0,
        ready: true,
        weapon: "rifle",
      },
      "bot-3": {
        id: "bot-3",
        name: "Bot Francotirador",
        x: 1420,
        y: 1020,
        angle: -Math.PI * 0.75,
        color: "#A3E635",
        hp: 100,
        maxHp: 100,
        alive: true,
        score: 0,
        ready: true,
        weapon: "pistol",
      },
    };

    this.botWanderAngles.set("bot-1", 2.4);
    this.botWanderAngles.set("bot-2", -0.8);
    this.botWanderAngles.set("bot-3", -2.3);
  }

  public step(input: PlayerInput, dtSeconds: number): void {
    const dt = Math.min(dtSeconds, 0.05);
    const speedMult = this.modifier === "speed_boost" ? 1.4 : 1;
    const baseSpeed = 260 * speedMult;

    // 1. Respawn bots
    for (const [id, t] of this.respawnTimers.entries()) {
      const rem = t - dt;
      if (rem <= 0) {
        this.respawnTimers.delete(id);
        const p = this.players[id];
        if (p) {
          const corners = [
            { x: 180, y: 180 },
            { x: 1420, y: 180 },
            { x: 180, y: 1020 },
            { x: 1420, y: 1020 },
          ];
          const c = corners[Math.floor(Math.random() * corners.length)];
          p.x = c.x;
          p.y = c.y;
          p.hp = 100;
          p.alive = true;
        }
      } else {
        this.respawnTimers.set(id, rem);
      }
    }

    // 2. Cooldowns
    for (const [id, cd] of this.cooldowns.entries()) {
      if (cd > 0) this.cooldowns.set(id, Math.max(0, cd - dt));
    }

    // 3. Move local player
    const me = this.players[this.localId];
    if (me && me.alive) {
      me.angle = input.angle;
      let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len;
        my /= len;
        const nextPos = this.resolveCircleMovement(
          me.x + mx * baseSpeed * dt,
          me.y + my * baseSpeed * dt,
          22
        );
        me.x = nextPos.x;
        me.y = nextPos.y;
      }

      if (input.shoot && (this.cooldowns.get(me.id) ?? 0) <= 0) {
        this.fireWeapon(me);
      }
    }

    // 4. Light bot movement
    for (const bot of Object.values(this.players)) {
      if (bot.id === this.localId || !bot.alive) continue;
      let wAngle = this.botWanderAngles.get(bot.id) ?? 0;
      if (Math.random() < 0.02) {
        wAngle += (Math.random() - 0.5) * 1.4;
      }
      const nextPos = this.resolveCircleMovement(
        bot.x + Math.cos(wAngle) * (baseSpeed * 0.52) * dt,
        bot.y + Math.sin(wAngle) * (baseSpeed * 0.52) * dt,
        22
      );
      if (
        Math.abs(nextPos.x - bot.x) < 0.2 &&
        Math.abs(nextPos.y - bot.y) < 0.2
      ) {
        wAngle += Math.PI * 0.75;
      }
      this.botWanderAngles.set(bot.id, wAngle);
      bot.x = nextPos.x;
      bot.y = nextPos.y;
      if (me && me.alive) {
        bot.angle = Math.atan2(me.y - bot.y, me.x - bot.x);
      }
    }

    // 5. Step bullets
    const dmgMult = this.modifier === "double_damage" ? 2 : 1;
    for (const [bid, b] of Array.from(this.internalBullets.entries())) {
      const subSteps = 2;
      const subDt = dt / subSteps;
      let removed = false;

      for (let s = 0; s < subSteps; s++) {
        const prevX = b.x;
        const prevY = b.y;
        b.x += b.vx * subDt;
        b.y += b.vy * subDt;
        b.traveled += Math.hypot(b.x - prevX, b.y - prevY);

        if (b.traveled >= b.maxRange) {
          this.internalBullets.delete(bid);
          removed = true;
          break;
        }

        // Border collision
        if (b.x <= 5 || b.x >= this.mapWidth - 5 || b.y <= 5 || b.y >= this.mapHeight - 5) {
          if (this.modifier === "ricochet" && b.bounces < 2) {
            if (b.x <= 5 || b.x >= this.mapWidth - 5) b.vx = -b.vx;
            if (b.y <= 5 || b.y >= this.mapHeight - 5) b.vy = -b.vy;
            b.x = Math.max(6, Math.min(this.mapWidth - 6, b.x));
            b.y = Math.max(6, Math.min(this.mapHeight - 6, b.y));
            b.bounces += 1;
          } else {
            this.callbacks.onBulletHit?.({ x: b.x, y: b.y, targetType: "wall" });
            this.internalBullets.delete(bid);
            removed = true;
            break;
          }
        }

        // Obstacle collision
        for (const obs of Object.values(this.obstacles)) {
          const dx = b.x - obs.x;
          const dy = b.y - obs.y;
          const minD = obs.radius + 5;
          if (dx * dx + dy * dy <= minD * minD) {
            if (obs.type === "rock" && this.modifier === "ricochet" && b.bounces < 2) {
              const dist = Math.hypot(dx, dy) || 1;
              const nx = dx / dist;
              const ny = dy / dist;
              const dot = b.vx * nx + b.vy * ny;
              b.vx -= 2 * dot * nx;
              b.vy -= 2 * dot * ny;
              b.x = obs.x + nx * (minD + 1);
              b.y = obs.y + ny * (minD + 1);
              b.bounces += 1;
            } else if (obs.type === "crate") {
              obs.hp = Math.max(0, obs.hp - b.damage * dmgMult);
              this.callbacks.onBulletHit?.({ x: b.x, y: b.y, targetType: "crate" });
              if (obs.hp <= 0) {
                delete this.obstacles[obs.id];
                this.spawnCrateLoot(obs.x, obs.y);
                this.callbacks.onCrateDestroyed?.({ id: obs.id, x: obs.x, y: obs.y });
              }
              this.internalBullets.delete(bid);
              removed = true;
            } else {
              this.callbacks.onBulletHit?.({ x: b.x, y: b.y, targetType: "wall" });
              this.internalBullets.delete(bid);
              removed = true;
            }
            break;
          }
        }
        if (removed) break;

        // Player collision
        for (const target of Object.values(this.players)) {
          if (!target.alive || target.id === b.ownerId) continue;
          const dx = b.x - target.x;
          const dy = b.y - target.y;
          if (dx * dx + dy * dy <= 27 * 27) {
            target.hp = Math.max(0, target.hp - b.damage * dmgMult);
            this.callbacks.onBulletHit?.({ x: b.x, y: b.y, targetType: "player" });
            this.internalBullets.delete(bid);
            removed = true;

            if (target.hp <= 0) {
              target.alive = false;
              const killer = this.players[b.ownerId];
              if (killer) {
                killer.score += 1;
                if (this.modifier === "vampire" && killer.alive) {
                  killer.hp = Math.min(killer.maxHp, killer.hp + 25);
                }
              }
              this.respawnTimers.set(target.id, 2.5);
              this.callbacks.onEliminated?.({
                victimId: target.id,
                killerId: b.ownerId,
                x: target.x,
                y: target.y,
              });
            }
            break;
          }
        }
        if (removed) break;
      }
    }

    // 6. Loot pickup
    if (me && me.alive) {
      const pickupRad = input.interact ? 52 : 42;
      for (const [lid, loot] of Object.entries(this.lootItems)) {
        if (Math.hypot(me.x - loot.x, me.y - loot.y) < pickupRad) {
          if (loot.kind === "medkit") {
            me.hp = Math.min(me.maxHp, me.hp + 35);
          } else if (loot.kind === "weapon" && loot.weaponType) {
            me.weapon = loot.weaponType;
          }
          delete this.lootItems[lid];
          this.callbacks.onPickup?.();
        }
      }
    }

    const nextBullets: Record<string, BulletState> = {};
    for (const [id, b] of this.internalBullets.entries()) {
      nextBullets[id] = {
        id: b.id,
        ownerId: b.ownerId,
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        weaponType: b.weaponType,
      };
    }
    this.bullets = nextBullets;
  }

  private fireWeapon(shooter: PlayerState): void {
    const cfg = LOCAL_WEAPONS[shooter.weapon];
    this.cooldowns.set(shooter.id, cfg.cooldown);
    const spreadRad = (cfg.spreadDeg * Math.PI) / 180;
    const muzzle = 30;

    for (let i = 0; i < cfg.pellets; i++) {
      let ang = shooter.angle;
      if (cfg.pellets > 1 && cfg.fan) {
        ang += (i / (cfg.pellets - 1) - 0.5) * spreadRad;
      } else if (spreadRad > 0) {
        ang += (Math.random() - 0.5) * spreadRad;
      }
      const bx = shooter.x + Math.cos(ang) * muzzle;
      const by = shooter.y + Math.sin(ang) * muzzle;
      const id = `lb_${++this.bulletSeq}`;
      this.internalBullets.set(id, {
        id,
        ownerId: shooter.id,
        x: bx,
        y: by,
        vx: Math.cos(ang) * cfg.speed,
        vy: Math.sin(ang) * cfg.speed,
        weaponType: shooter.weapon,
        damage: cfg.damage,
        maxRange: cfg.maxRange,
        traveled: 0,
        bounces: 0,
      });
    }

    this.callbacks.onShoot?.(
      shooter.x + Math.cos(shooter.angle) * muzzle,
      shooter.y + Math.sin(shooter.angle) * muzzle,
      shooter.angle,
      shooter.color
    );
  }

  private spawnCrateLoot(x: number, y: number): void {
    const id = `lloot_${++this.lootSeq}`;
    if (Math.random() < 0.7) {
      const pool: WeaponType[] = ["shotgun", "rifle", "sniper"];
      const weaponType = pool[Math.floor(Math.random() * pool.length)];
      this.lootItems[id] = { id, kind: "weapon", weaponType, x, y };
    } else {
      this.lootItems[id] = { id, kind: "medkit", x, y };
    }
  }

  private resolveCircleMovement(
    x: number,
    y: number,
    radius: number
  ): { x: number; y: number } {
    let nx = Math.max(radius, Math.min(this.mapWidth - radius, x));
    let ny = Math.max(radius, Math.min(this.mapHeight - radius, y));

    for (const obs of Object.values(this.obstacles)) {
      const dx = nx - obs.x;
      const dy = ny - obs.y;
      const dist = Math.hypot(dx, dy);
      const minD = radius + obs.radius;
      if (dist < minD && dist > 0.0001) {
        nx = obs.x + (dx / dist) * minD;
        ny = obs.y + (dy / dist) * minD;
      }
    }

    nx = Math.max(radius, Math.min(this.mapWidth - radius, nx));
    ny = Math.max(radius, Math.min(this.mapHeight - radius, ny));
    return { x: nx, y: ny };
  }
}
