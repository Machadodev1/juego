import type {
  AbilityType,
  BulletHitEvent,
  BulletState,
  CrateDestroyedEvent,
  EmoteEvent,
  ExplosionEvent,
  HazardZoneState,
  KillFeedEvent,
  LootItemState,
  ObstacleState,
  PlayerEliminatedEvent,
  PlayerInput,
  PlayerState,
  RoundModifier,
  WeaponType,
} from "@shared/types";
import { WEAPON_META } from "../constants";

export interface LocalArenaCallbacks {
  onShoot?: (
    playerId: string,
    x: number,
    y: number,
    angle: number,
    color: string,
    weapon: WeaponType
  ) => void;
  onBulletHit?: (ev: BulletHitEvent, victimId?: string) => void;
  onExplosion?: (ev: ExplosionEvent) => void;
  onCrateDestroyed?: (ev: CrateDestroyedEvent) => void;
  onPickup?: () => void;
  onAbilityUsed?: (ability: AbilityType) => void;
  onEmote?: (ev: EmoteEvent) => void;
  onEliminated?: (ev: PlayerEliminatedEvent, killFeed: KillFeedEvent) => void;
  onModifierChanged?: (modifier: RoundModifier) => void;
}

interface LocalBullet extends BulletState {
  radius: number;
  damage: number;
  maxRange: number;
  traveled: number;
  bouncesLeft: number;
  returning: boolean;
  spawnTime: number;
  fromDowned: boolean;
}

interface LocalBotBrain {
  strafeDir: number;
  decisionTimer: number;
  respawnTimer: number;
}

interface LocalPlayerRuntime {
  moveVx: number;
  moveVy: number;
  extVx: number;
  extVy: number;
  lastShoot: number;
  lastFlame: number;
  dashMs: number;
  dashDx: number;
  dashDy: number;
  invulnMs: number;
  shieldMs: number;
  airborneMs: number;
  padCdMs: number;
  grappleMs: number;
  grappleTx: number;
  grappleTy: number;
  downedBodyHp: number;
  lastAttackerId: string;
  lastAttackerWeapon: string;
  wasInteract: boolean;
  wasAbility: boolean;
  fireAccumMs: number;
  stormAccumMs: number;
}

const ALL_MODIFIERS: RoundModifier[] = [
  "normal",
  "speed_boost",
  "ricochet",
  "vampire",
  "double_damage",
  "hot_potato",
  "sniper_zero_g",
  "tiny_shotgun",
  "all_invisible",
  "giant_bullets",
];

const ALL_WEAPONS: WeaponType[] = [
  "pistol",
  "shotgun",
  "rifle",
  "sniper",
  "impulse_gun",
  "flamethrower",
  "saw_disc",
  "bee_cannon",
  "grappling_hook",
];

const SPECIAL_WEAPONS: WeaponType[] = [
  "impulse_gun",
  "flamethrower",
  "saw_disc",
  "bee_cannon",
  "grappling_hook",
];

const ABILITY_CD_MS: Record<AbilityType, number> = {
  dash: 4000,
  energy_shield: 8000,
  proximity_mine: 10000,
  smoke_grenade: 9000,
};

const WEAPON_CFG: Record<
  WeaponType,
  {
    dmg: number;
    cd: number;
    speed: number;
    pellets: number;
    spreadDeg: number;
    range: number;
    rad: number;
    bounces: number;
    homing?: boolean;
    boomerang?: boolean;
    kbTarget?: number;
    recoil?: number;
  }
> = {
  pistol: { dmg: 15, cd: 270, speed: 660, pellets: 1, spreadDeg: 2, range: 760, rad: 5, bounces: 0 },
  shotgun: { dmg: 12, cd: 740, speed: 610, pellets: 5, spreadDeg: 25, range: 430, rad: 4.5, bounces: 0 },
  rifle: { dmg: 14, cd: 130, speed: 750, pellets: 1, spreadDeg: 4, range: 840, rad: 5, bounces: 0 },
  sniper: { dmg: 65, cd: 1050, speed: 1240, pellets: 1, spreadDeg: 0, range: 1450, rad: 6, bounces: 0 },
  impulse_gun: { dmg: 5, cd: 620, speed: 800, pellets: 1, spreadDeg: 0, range: 700, rad: 9, bounces: 0, kbTarget: 1020, recoil: 500 },
  flamethrower: { dmg: 6, cd: 80, speed: 430, pellets: 2, spreadDeg: 20, range: 255, rad: 8, bounces: 0 },
  saw_disc: { dmg: 28, cd: 680, speed: 630, pellets: 1, spreadDeg: 0, range: 1450, rad: 11, bounces: 3, boomerang: true },
  bee_cannon: { dmg: 16, cd: 520, speed: 340, pellets: 2, spreadDeg: 22, range: 980, rad: 6, bounces: 0, homing: true },
  grappling_hook: { dmg: 20, cd: 880, speed: 1080, pellets: 1, spreadDeg: 0, range: 680, rad: 7, bounces: 0 },
};

export class LocalArena {
  public mapWidth = 1600;
  public mapHeight = 1200;
  public stormX = 800;
  public stormY = 600;
  public stormRadius = 1100;
  public modifier: RoundModifier = "normal";

  public obstacles: Record<string, ObstacleState> = {};
  public hazardZones: Record<string, HazardZoneState> = {};
  public lootItems: Record<string, LootItemState> = {};
  public players: Record<string, PlayerState> = {};
  public bullets: Record<string, BulletState> = {};

  public readonly localId = "local-player";

  private localBullets: Map<string, LocalBullet> = new Map();
  private runtime: Map<string, LocalPlayerRuntime> = new Map();
  private mimicFuse: Map<string, number> = new Map();
  private bots: Map<string, LocalBotBrain> = new Map();
  private callbacks: LocalArenaCallbacks;

  private playerName: string;
  private playerColor: string;
  private playerAbility: AbilityType;
  private roundElapsedMs = 0;
  private seq = 0;

  constructor(
    playerName: string,
    playerColor: string,
    playerAbility: AbilityType,
    callbacks: LocalArenaCallbacks = {}
  ) {
    this.playerName = playerName || "Jugador";
    this.playerColor = playerColor || "#22D3EE";
    this.playerAbility = playerAbility || "dash";
    this.callbacks = callbacks;
    this.resetArena("normal");
  }

  public setLocalAbility(ability: AbilityType): void {
    this.playerAbility = ability;
    const me = this.players[this.localId];
    if (me) {
      me.ability = ability;
      me.abilityCooldownMs = 0;
    }
  }

  public cycleWeapon(): void {
    const me = this.players[this.localId];
    if (!me || !me.alive) return;
    const idx = ALL_WEAPONS.indexOf(me.weapon);
    me.weapon = ALL_WEAPONS[(idx + 1) % ALL_WEAPONS.length];
    this.callbacks.onPickup?.();
  }

  public cycleModifier(): void {
    const idx = ALL_MODIFIERS.indexOf(this.modifier);
    const next = ALL_MODIFIERS[(idx + 1) % ALL_MODIFIERS.length];
    this.resetArena(next);
  }

  public resetArena(forcedModifier?: RoundModifier): void {
    this.modifier =
      forcedModifier ??
      ALL_MODIFIERS[Math.floor(Math.random() * ALL_MODIFIERS.length)];

    this.mapWidth = this.modifier === "tiny_shotgun" ? 900 : 1600;
    this.mapHeight = this.modifier === "tiny_shotgun" ? 700 : 1200;
    this.stormX = this.mapWidth / 2;
    this.stormY = this.mapHeight / 2;
    this.stormRadius = Math.round(
      Math.hypot(this.mapWidth / 2, this.mapHeight / 2) + 80
    );
    this.roundElapsedMs = 0;

    this.obstacles = {};
    this.hazardZones = {};
    this.lootItems = {};
    this.bullets = {};
    this.localBullets.clear();
    this.mimicFuse.clear();
    this.runtime.clear();
    this.bots.clear();

    const margin = this.mapWidth <= 1000 ? 130 : 170;
    const spawns = [
      { x: margin, y: margin },
      { x: this.mapWidth - margin, y: margin },
      { x: margin, y: this.mapHeight - margin },
      { x: this.mapWidth - margin, y: this.mapHeight - margin },
    ];

    // 1. Caja dorada central
    const gcId = `obs_${++this.seq}`;
    this.obstacles[gcId] = {
      id: gcId,
      type: "golden_crate",
      x: Math.round(this.mapWidth / 2),
      y: Math.round(this.mapHeight / 2),
      radius: 34,
      hp: 80,
      maxHp: 80,
      awake: false,
    };

    const isCompact = this.mapWidth <= 1000;
    const specs: Array<{
      type: ObstacleState["type"];
      count: number;
      radius: number;
      hp: number;
    }> = [
      { type: "explosive_barrel", count: 5, radius: 23, hp: 25 },
      { type: "oil_barrel", count: 4, radius: 23, hp: 20 },
      { type: "mimic_crate", count: 2, radius: 27, hp: 35 },
      { type: "jump_pad", count: 2, radius: 30, hp: 9999 },
      { type: "bush", count: 6, radius: 40, hp: 9999 },
      { type: "crate", count: isCompact ? 6 : 11, radius: 27, hp: 40 },
      { type: "rock", count: isCompact ? 4 : 8, radius: 36, hp: 9999 },
      { type: "tree", count: isCompact ? 4 : 8, radius: 22, hp: 9999 },
    ];

    for (const spec of specs) {
      let placed = 0;
      let tries = 0;
      while (placed < spec.count && tries < 900) {
        tries++;
        const x =
          70 + spec.radius + Math.random() * (this.mapWidth - 140 - spec.radius * 2);
        const y =
          70 + spec.radius + Math.random() * (this.mapHeight - 140 - spec.radius * 2);

        if (spawns.some((s) => Math.hypot(s.x - x, s.y - y) < 125 + spec.radius)) {
          continue;
        }
        if (
          Object.values(this.obstacles).some(
            (o) => Math.hypot(o.x - x, o.y - y) < o.radius + spec.radius + 16
          )
        ) {
          continue;
        }

        const id = `obs_${++this.seq}`;
        this.obstacles[id] = {
          id,
          type: spec.type,
          x: Math.round(x),
          y: Math.round(y),
          radius: spec.radius,
          hp: spec.hp,
          maxHp: spec.hp,
          awake: false,
        };
        placed++;
      }
    }

    const startWeapon: WeaponType =
      this.modifier === "sniper_zero_g"
        ? "sniper"
        : this.modifier === "tiny_shotgun"
        ? "shotgun"
        : "pistol";

    const prevScores: Record<string, number> = {};
    for (const [pid, p] of Object.entries(this.players)) {
      prevScores[pid] = p.score;
    }

    const roster: Array<{
      id: string;
      name: string;
      color: string;
      ability: AbilityType;
      spawn: { x: number; y: number };
    }> = [
      {
        id: this.localId,
        name: this.playerName,
        color: this.playerColor,
        ability: this.playerAbility,
        spawn: spawns[0],
      },
      {
        id: "bot-1",
        name: "Bot Nitro",
        color: "#EC4899",
        ability: "dash",
        spawn: spawns[1],
      },
      {
        id: "bot-2",
        name: "Bot Sombra",
        color: "#A3E635",
        ability: "smoke_grenade",
        spawn: spawns[2],
      },
      {
        id: "bot-3",
        name: "Bot Titán",
        color: "#F59E0B",
        ability: "energy_shield",
        spawn: spawns[3],
      },
    ];

    this.players = {};
    for (const r of roster) {
      this.players[r.id] = {
        id: r.id,
        name: r.name,
        x: r.spawn.x,
        y: r.spawn.y,
        angle: Math.atan2(this.mapHeight / 2 - r.spawn.y, this.mapWidth / 2 - r.spawn.x),
        color: r.color,
        hp: 100,
        maxHp: 100,
        shield: 0,
        maxShield: 50,
        alive: true,
        isDowned: false,
        downedTimerMs: 0,
        score: prevScores[r.id] ?? 0,
        streak: 0,
        hasBounty: false,
        ready: true,
        weapon: startWeapon,
        ability: r.ability,
        abilityCooldownMs: 0,
        shieldActive: false,
        hasHotPotato: false,
        hotPotatoTimerMs: 0,
        isInvisible: this.modifier === "all_invisible",
        isAirborne: false,
      };
      this.runtime.set(r.id, this.freshRuntime());
      if (r.id !== this.localId) {
        this.bots.set(r.id, {
          strafeDir: Math.random() > 0.5 ? 1 : -1,
          decisionTimer: 0.8,
          respawnTimer: 0,
        });
      }
    }

    if (this.modifier === "hot_potato") {
      this.players[this.localId].hasHotPotato = true;
      this.players[this.localId].hotPotatoTimerMs = 12000;
    }

    // Dejar 2 armas especiales de prueba cerca de la esquina del jugador para probar al instante
    const demoW1 = SPECIAL_WEAPONS[Math.floor(Math.random() * SPECIAL_WEAPONS.length)];
    const demoW2 =
      SPECIAL_WEAPONS[(SPECIAL_WEAPONS.indexOf(demoW1) + 2) % SPECIAL_WEAPONS.length];
    this.spawnWeaponLoot(demoW1, spawns[0].x + 95, spawns[0].y + 20);
    this.spawnWeaponLoot(demoW2, spawns[0].x + 20, spawns[0].y + 95);

    this.callbacks.onModifierChanged?.(this.modifier);
  }

  private freshRuntime(): LocalPlayerRuntime {
    return {
      moveVx: 0,
      moveVy: 0,
      extVx: 0,
      extVy: 0,
      lastShoot: -9999,
      lastFlame: -9999,
      dashMs: 0,
      dashDx: 0,
      dashDy: 0,
      invulnMs: 0,
      shieldMs: 0,
      airborneMs: 0,
      padCdMs: 0,
      grappleMs: 0,
      grappleTx: 0,
      grappleTy: 0,
      downedBodyHp: 40,
      lastAttackerId: "",
      lastAttackerWeapon: "Arena",
      wasInteract: false,
      wasAbility: false,
      fireAccumMs: 0,
      stormAccumMs: 0,
    };
  }

  private spawnWeaponLoot(weaponType: WeaponType, x: number, y: number): void {
    const id = `loot_${++this.seq}`;
    this.lootItems[id] = { id, kind: "weapon", weaponType, x, y };
  }

  public step(localInput: PlayerInput, dtSec: number): void {
    const dt = Math.min(dtSec, 0.05);
    const dtMs = dt * 1000;
    const now = performance.now();
    this.roundElapsedMs += dtMs;

    if (localInput.emote) {
      const me = this.players[this.localId];
      if (me) {
        this.callbacks.onEmote?.({
          playerId: me.id,
          x: me.x,
          y: me.y,
          emote: localInput.emote,
        });
      }
    }

    // 1.Jugador local (revive tras 2.5s en modo práctica si muere)
    const me = this.players[this.localId];
    if (me && me.alive) {
      this.applyInputToPlayer(me, localInput, dt, now);
    }

    // 2. Bots IA
    for (const [botId, brain] of this.bots.entries()) {
      const bot = this.players[botId];
      if (!bot) continue;
      if (!bot.alive) {
        brain.respawnTimer -= dt;
        if (brain.respawnTimer <= 0) {
          this.respawnPlayer(bot);
        }
        continue;
      }

      brain.decisionTimer -= dt;
      if (brain.decisionTimer <= 0) {
        brain.decisionTimer = 0.7 + Math.random() * 0.8;
        brain.strafeDir = Math.random() > 0.5 ? 1 : -1;
      }

      let target: PlayerState | null = null;
      let bestDist = Infinity;
      for (const other of Object.values(this.players)) {
        if (other.id === bot.id || !other.alive || other.isInvisible) continue;
        const d = Math.hypot(other.x - bot.x, other.y - bot.y);
        if (d < bestDist) {
          bestDist = d;
          target = other;
        }
      }

      const botInput: PlayerInput = {
        up: false,
        down: false,
        left: false,
        right: false,
        angle: bot.angle,
        shoot: false,
        interact: false,
        useAbility: false,
        seq: 0,
      };

      if (target) {
        const ang = Math.atan2(target.y - bot.y, target.x - bot.x);
        botInput.angle = ang;
        const desiredAngle =
          bestDist > 300
            ? ang
            : bestDist < 165
            ? ang + Math.PI
            : ang + (Math.PI / 2) * brain.strafeDir;
        const mx = Math.cos(desiredAngle);
        const my = Math.sin(desiredAngle);
        botInput.right = mx > 0.3;
        botInput.left = mx < -0.3;
        botInput.down = my > 0.3;
        botInput.up = my < -0.3;
        botInput.shoot = bestDist < 540;
        botInput.useAbility =
          bot.abilityCooldownMs <= 0 && bestDist < 260 && Math.random() < 0.02;
      }

      this.applyInputToPlayer(bot, botInput, dt, now);
    }

    if (me && !me.alive) {
      let meBrain = this.bots.get(this.localId);
      if (!meBrain) {
        meBrain = { strafeDir: 1, decisionTimer: 1, respawnTimer: 2.2 };
        this.bots.set(this.localId, meBrain);
      } else {
        meBrain.respawnTimer -= dt;
        if (meBrain.respawnTimer <= 0) {
          this.bots.delete(this.localId);
          this.respawnPlayer(me);
        }
      }
    }

    // 3. Actualizar proyectiles, mimics, zonas, trampolines, tormenta, papa caliente y sigilo
    this.stepBullets(dt, now);
    this.stepMimics(dt, dtMs);
    this.stepHazards(dtMs);
    this.stepJumpPads();
    this.stepStorm(dtMs);
    this.stepHotPotato(dtMs);
    this.stepStealth(now);
  }

  private respawnPlayer(p: PlayerState): void {
    const margin = this.mapWidth <= 1000 ? 130 : 170;
    p.x = margin + Math.random() * (this.mapWidth - margin * 2);
    p.y = margin + Math.random() * (this.mapHeight - margin * 2);
    p.hp = 100;
    p.shield = 0;
    p.alive = true;
    p.isDowned = false;
    p.downedTimerMs = 0;
    p.weapon =
      this.modifier === "sniper_zero_g"
        ? "sniper"
        : this.modifier === "tiny_shotgun"
        ? "shotgun"
        : "pistol";
    p.abilityCooldownMs = 0;
    p.shieldActive = false;
    p.isAirborne = false;
    this.runtime.set(p.id, this.freshRuntime());
  }

  private applyInputToPlayer(
    p: PlayerState,
    input: PlayerInput,
    dt: number,
    now: number
  ): void {
    const rt = this.runtime.get(p.id) ?? this.freshRuntime();
    this.runtime.set(p.id, rt);
    const dtMs = dt * 1000;

    p.angle = input.angle;
    if (p.abilityCooldownMs > 0) {
      p.abilityCooldownMs = Math.max(0, p.abilityCooldownMs - dtMs);
    }
    if (rt.invulnMs > 0) rt.invulnMs = Math.max(0, rt.invulnMs - dtMs);
    if (rt.padCdMs > 0) rt.padCdMs = Math.max(0, rt.padCdMs - dtMs);
    if (p.shieldActive) {
      rt.shieldMs = Math.max(0, rt.shieldMs - dtMs);
      if (rt.shieldMs <= 0) p.shieldActive = false;
    }
    if (p.isAirborne) {
      rt.airborneMs = Math.max(0, rt.airborneMs - dtMs);
      if (rt.airborneMs <= 0) {
        p.isAirborne = false;
        this.triggerExplosion(p.x, p.y, 115, 18, "jump_land", p.id, "Salto Sísmico");
      }
    }
    if (p.isDowned) {
      p.downedTimerMs = Math.max(0, p.downedTimerMs - dtMs);
      if (p.downedTimerMs <= 0) {
        this.eliminatePlayer(p, rt.lastAttackerId, rt.lastAttackerWeapon);
        return;
      }
    }

    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    let mult = this.modifier === "speed_boost" ? 1.4 : 1;
    if (p.isDowned) mult *= 0.38;
    else if (p.isAirborne) mult *= 1.25;

    const targetVx = dx * 265 * mult;
    const targetVy = dy * 265 * mult;
    const onOil = !p.isAirborne && this.inHazard(p.x, p.y, "oil") !== null;

    if (onOil) {
      if (len > 0) {
        rt.moveVx += (targetVx * 1.22 - rt.moveVx) * 0.065;
        rt.moveVy += (targetVy * 1.22 - rt.moveVy) * 0.065;
      } else {
        rt.moveVx *= 0.985;
        rt.moveVy *= 0.985;
      }
    } else if (this.modifier === "sniper_zero_g") {
      if (len > 0) {
        rt.moveVx += (targetVx - rt.moveVx) * 0.14;
        rt.moveVy += (targetVy - rt.moveVy) * 0.14;
      } else {
        rt.moveVx *= 0.96;
        rt.moveVy *= 0.96;
      }
    } else {
      rt.moveVx = targetVx;
      rt.moveVy = targetVy;
    }

    // Habilidad
    const abilEdge = Boolean(input.useAbility) && !rt.wasAbility;
    rt.wasAbility = Boolean(input.useAbility);
    if (abilEdge && !p.isDowned && p.abilityCooldownMs <= 0) {
      this.activateAbility(p, rt, dx, dy);
    }

    let vx = rt.moveVx + rt.extVx;
    let vy = rt.moveVy + rt.extVy;

    if (rt.dashMs > 0) {
      rt.dashMs = Math.max(0, rt.dashMs - dtMs);
      vx = rt.dashDx * 920;
      vy = rt.dashDy * 920;
    } else if (rt.grappleMs > 0) {
      rt.grappleMs = Math.max(0, rt.grappleMs - dtMs);
      const gdx = rt.grappleTx - p.x;
      const gdy = rt.grappleTy - p.y;
      const gd = Math.hypot(gdx, gdy);
      if (gd < 28) rt.grappleMs = 0;
      else {
        vx = (gdx / gd) * 1140;
        vy = (gdy / gd) * 1140;
      }
    }

    const damp = this.modifier === "sniper_zero_g" ? 0.962 : 0.87;
    rt.extVx *= damp;
    rt.extVy *= damp;

    p.x = Math.max(24, Math.min(this.mapWidth - 24, p.x + vx * dt));
    p.y = Math.max(24, Math.min(this.mapHeight - 24, p.y + vy * dt));

    // Colisión suave contra obstáculos sólidos
    for (const obs of Object.values(this.obstacles)) {
      if (obs.type === "bush" || obs.type === "jump_pad" || obs.awake) continue;
      const odx = p.x - obs.x;
      const ody = p.y - obs.y;
      const dist = Math.hypot(odx, ody);
      const minD = 22 + obs.radius;
      if (dist < minD && dist > 0.001) {
        p.x = obs.x + (odx / dist) * minD;
        p.y = obs.y + (ody / dist) * minD;
      }
    }

    // Botín (tecla E o auto medkit/shield/pistola)
    const interEdge = Boolean(input.interact) && !rt.wasInteract;
    rt.wasInteract = Boolean(input.interact);
    this.checkLootForPlayer(p, interEdge);

    // Disparo
    if (p.isDowned) {
      if (input.shoot && now - rt.lastShoot >= 420) {
        rt.lastShoot = now;
        this.fireProjectiles(p, rt, now, true);
      }
    } else {
      const cfg = WEAPON_CFG[p.weapon];
      const cd =
        this.modifier === "tiny_shotgun" && p.weapon === "shotgun"
          ? cfg.cd * 0.52
          : cfg.cd;
      if (input.shoot && now - rt.lastShoot >= cd) {
        rt.lastShoot = now;
        this.fireProjectiles(p, rt, now, false);
      }
    }
  }

  private activateAbility(
    p: PlayerState,
    rt: LocalPlayerRuntime,
    dx: number,
    dy: number
  ): void {
    p.abilityCooldownMs = ABILITY_CD_MS[p.ability];
    if (p.id === this.localId) {
      this.callbacks.onAbilityUsed?.(p.ability);
    }

    if (p.ability === "dash") {
      const hasMove = Math.hypot(dx, dy) > 0.1;
      rt.dashDx = hasMove ? dx : Math.cos(p.angle);
      rt.dashDy = hasMove ? dy : Math.sin(p.angle);
      rt.dashMs = 175;
      rt.invulnMs = 150;
    } else if (p.ability === "energy_shield") {
      p.shieldActive = true;
      rt.shieldMs = 2500;
    } else if (p.ability === "proximity_mine") {
      const id = `haz_${++this.seq}`;
      this.hazardZones[id] = {
        id,
        type: "mine",
        ownerId: p.id,
        x: p.x,
        y: p.y,
        radius: 34,
        ttlMs: 25000,
        armed: true,
      };
    } else if (p.ability === "smoke_grenade") {
      const id = `haz_${++this.seq}`;
      this.hazardZones[id] = {
        id,
        type: "smoke",
        ownerId: p.id,
        x: Math.max(80, Math.min(this.mapWidth - 80, p.x + Math.cos(p.angle) * 175)),
        y: Math.max(80, Math.min(this.mapHeight - 80, p.y + Math.sin(p.angle) * 175)),
        radius: 108,
        ttlMs: 7500,
        armed: true,
      };
    }
  }

  private fireProjectiles(
    p: PlayerState,
    rt: LocalPlayerRuntime,
    now: number,
    fromDowned: boolean
  ): void {
    const wType: WeaponType = fromDowned ? "pistol" : p.weapon;
    const cfg = WEAPON_CFG[wType];
    const isGiant = this.modifier === "giant_bullets";
    const scale = isGiant ? 4 : fromDowned ? 0.85 : 1;
    const speed = (fromDowned ? 560 : cfg.speed) * (isGiant ? 0.48 : 1);
    const rad = cfg.rad * (isGiant ? 3.1 : 1);
    const extraBounces = this.modifier === "ricochet" ? 2 : 0;

    const recoil =
      !fromDowned && this.modifier === "sniper_zero_g"
        ? 780
        : !fromDowned
        ? cfg.recoil ?? 0
        : 0;
    if (recoil > 0) {
      rt.extVx -= Math.cos(p.angle) * recoil;
      rt.extVy -= Math.sin(p.angle) * recoil;
    }

    const pellets = fromDowned ? 1 : cfg.pellets;
    const spreadRad = ((fromDowned ? 2 : cfg.spreadDeg) * Math.PI) / 180;

    for (let i = 0; i < pellets; i++) {
      let ang = p.angle;
      if (pellets > 1 && wType === "shotgun") {
        ang += (i / (pellets - 1) - 0.5) * spreadRad;
      } else if (spreadRad > 0) {
        ang += (Math.random() - 0.5) * spreadRad;
      }

      const sx = p.x + Math.cos(ang) * (26 + rad);
      const sy = p.y + Math.sin(ang) * (26 + rad);
      const id = `b_${++this.seq}`;
      const lb: LocalBullet = {
        id,
        ownerId: p.id,
        x: sx,
        y: sy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        weaponType: wType,
        scale,
        isHoming: Boolean(!fromDowned && cfg.homing),
        isBoomerang: Boolean(!fromDowned && cfg.boomerang),
        radius: rad,
        damage: fromDowned ? 8 : cfg.dmg,
        maxRange: fromDowned ? 540 : cfg.range,
        traveled: 0,
        bouncesLeft: (fromDowned ? 0 : cfg.bounces) + extraBounces,
        returning: false,
        spawnTime: now,
        fromDowned,
      };
      this.localBullets.set(id, lb);
    }

    this.callbacks.onShoot?.(
      p.id,
      p.x + Math.cos(p.angle) * 28,
      p.y + Math.sin(p.angle) * 28,
      p.angle,
      p.color,
      wType
    );
  }

  private stepBullets(dt: number, now: number): void {
    const dmgMult = this.modifier === "double_damage" ? 2 : 1;

    for (const [id, b] of Array.from(this.localBullets.entries())) {
      const speed = Math.hypot(b.vx, b.vy);
      if (b.isHoming) {
        let best: PlayerState | null = null;
        let bestD = 550;
        for (const cand of Object.values(this.players)) {
          if (!cand.alive || cand.id === b.ownerId || cand.isInvisible || cand.isAirborne) {
            continue;
          }
          const d = Math.hypot(cand.x - b.x, cand.y - b.y);
          if (d < bestD) {
            bestD = d;
            best = cand;
          }
        }
        if (best) {
          const cur = Math.atan2(b.vy, b.vx);
          const des = Math.atan2(best.y - b.y, best.x - b.x);
          let diff = des - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const next = cur + Math.max(-3.6 * dt, Math.min(3.6 * dt, diff));
          b.vx = Math.cos(next) * speed;
          b.vy = Math.sin(next) * speed;
        }
      } else if (b.isBoomerang && b.returning) {
        const owner = this.players[b.ownerId];
        if (owner && owner.alive) {
          const cur = Math.atan2(b.vy, b.vx);
          const des = Math.atan2(owner.y - b.y, owner.x - b.x);
          let diff = des - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const next = cur + Math.max(-4.2 * dt, Math.min(4.2 * dt, diff));
          b.vx = Math.cos(next) * speed;
          b.vy = Math.sin(next) * speed;
        }
      }

      const stepDx = b.vx * dt;
      const stepDy = b.vy * dt;
      b.x += stepDx;
      b.y += stepDy;
      b.traveled += Math.hypot(stepDx, stepDy);

      if (b.isBoomerang && !b.returning && b.traveled >= 380) {
        b.returning = true;
      }

      // Ignición de aceite
      for (const hz of Object.values(this.hazardZones)) {
        if (hz.type === "oil" && Math.hypot(hz.x - b.x, hz.y - b.y) <= hz.radius + b.radius) {
          hz.type = "fire";
          hz.ttlMs = 6500;
        }
      }

      if (b.traveled >= b.maxRange) {
        if (b.weaponType === "flamethrower") {
          this.maybeSpawnFire(b.ownerId, b.x, b.y, now);
        }
        this.localBullets.delete(id);
        continue;
      }

      // Bordes
      if (b.x <= b.radius || b.x >= this.mapWidth - b.radius) {
        if (b.weaponType === "grappling_hook") {
          this.pullGrapple(b.ownerId, b.x, b.y);
          this.localBullets.delete(id);
          continue;
        }
        if (b.bouncesLeft > 0) {
          b.bouncesLeft--;
          b.vx = -b.vx;
          if (b.isBoomerang) b.returning = true;
        } else {
          this.callbacks.onBulletHit?.({ x: b.x, y: b.y, targetType: "wall" });
          this.localBullets.delete(id);
          continue;
        }
      }
      if (b.y <= b.radius || b.y >= this.mapHeight - b.radius) {
        if (b.weaponType === "grappling_hook") {
          this.pullGrapple(b.ownerId, b.x, b.y);
          this.localBullets.delete(id);
          continue;
        }
        if (b.bouncesLeft > 0) {
          b.bouncesLeft--;
          b.vy = -b.vy;
          if (b.isBoomerang) b.returning = true;
        } else {
          this.callbacks.onBulletHit?.({ x: b.x, y: b.y, targetType: "wall" });
          this.localBullets.delete(id);
          continue;
        }
      }

      // Obstáculos
      let removed = false;
      for (const obs of Object.values(this.obstacles)) {
        if (obs.type === "bush" || obs.type === "jump_pad") continue;
        const d = Math.hypot(b.x - obs.x, b.y - obs.y);
        if (d <= obs.radius + b.radius) {
          if (b.weaponType === "grappling_hook") {
            this.pullGrapple(b.ownerId, b.x, b.y);
            this.localBullets.delete(id);
            removed = true;
            break;
          }
          if (b.weaponType === "flamethrower") {
            this.maybeSpawnFire(b.ownerId, b.x, b.y, now);
          }
          if (obs.type === "rock") {
            if (b.bouncesLeft > 0) {
              b.bouncesLeft--;
              const nx = (b.x - obs.x) / (d || 1);
              const ny = (b.y - obs.y) / (d || 1);
              const dot = b.vx * nx + b.vy * ny;
              b.vx -= 2 * dot * nx;
              b.vy -= 2 * dot * ny;
              if (b.isBoomerang) b.returning = true;
            } else {
              this.callbacks.onBulletHit?.({ x: b.x, y: b.y, targetType: "wall" });
              this.localBullets.delete(id);
              removed = true;
            }
          } else if (obs.type === "tree") {
            this.callbacks.onBulletHit?.({ x: b.x, y: b.y, targetType: "wall" });
            this.localBullets.delete(id);
            removed = true;
          } else {
            const hitDmg = Math.round(b.damage * dmgMult);
            this.callbacks.onBulletHit?.({
              x: b.x,
              y: b.y,
              targetType: "crate",
              damage: hitDmg,
            });
            this.damageObstacle(obs.id, hitDmg, b.ownerId);
            this.localBullets.delete(id);
            removed = true;
          }
          break;
        }
      }
      if (removed) continue;

      // Jugadores
      const canHitOwner = b.isBoomerang && now - b.spawnTime >= 300;
      for (const victim of Object.values(this.players)) {
        if (!victim.alive || victim.isAirborne) continue;
        if (victim.id === b.ownerId && !canHitOwner) continue;

        if (Math.hypot(b.x - victim.x, b.y - victim.y) <= 22 + b.radius) {
          if (victim.shieldActive && victim.id !== b.ownerId) {
            const inc = Math.atan2(b.y - victim.y, b.x - victim.x);
            let diff = inc - victim.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) <= (78 * Math.PI) / 180) {
              b.ownerId = victim.id;
              b.traveled = 0;
              b.vx = Math.cos(victim.angle) * speed;
              b.vy = Math.sin(victim.angle) * speed;
              this.callbacks.onBulletHit?.({
                x: b.x,
                y: b.y,
                targetType: "shield",
              });
              break;
            }
          }

          const vrt = this.runtime.get(victim.id);
          const cfg = WEAPON_CFG[b.weaponType];
          if (cfg.kbTarget && vrt) {
            const ba = Math.atan2(b.vy, b.vx);
            vrt.extVx += Math.cos(ba) * cfg.kbTarget;
            vrt.extVy += Math.sin(ba) * cfg.kbTarget;
          }
          if (b.weaponType === "flamethrower") {
            this.maybeSpawnFire(b.ownerId, b.x, b.y, now);
          }
          if (b.weaponType === "grappling_hook") {
            this.pullGrapple(b.ownerId, victim.x, victim.y);
          }

          const attacker = this.players[b.ownerId];
          if (
            this.modifier === "hot_potato" &&
            attacker?.hasHotPotato &&
            victim.id !== attacker.id &&
            !victim.isDowned
          ) {
            const rem = Math.max(4000, attacker.hotPotatoTimerMs);
            attacker.hasHotPotato = false;
            attacker.hotPotatoTimerMs = 0;
            victim.hasHotPotato = true;
            victim.hotPotatoTimerMs = rem;
          }

          this.applyDamage(
            victim,
            b.damage * dmgMult,
            b.ownerId,
            WEAPON_META[b.weaponType].label,
            b.x,
            b.y,
            b.fromDowned
          );
          this.localBullets.delete(id);
          break;
        }
      }
    }

    const synced: Record<string, BulletState> = {};
    for (const [id, b] of this.localBullets.entries()) {
      synced[id] = {
        id: b.id,
        ownerId: b.ownerId,
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        weaponType: b.weaponType,
        scale: b.scale,
        isHoming: b.isHoming,
        isBoomerang: b.isBoomerang,
      };
    }
    this.bullets = synced;
  }

  private pullGrapple(playerId: string, tx: number, ty: number): void {
    const rt = this.runtime.get(playerId);
    if (rt) {
      rt.grappleTx = tx;
      rt.grappleTy = ty;
      rt.grappleMs = 290;
    }
  }

  private maybeSpawnFire(ownerId: string, x: number, y: number, now: number): void {
    const rt = this.runtime.get(ownerId);
    if (!rt || now - rt.lastFlame < 190) return;
    rt.lastFlame = now;
    const id = `haz_${++this.seq}`;
    this.hazardZones[id] = {
      id,
      type: "fire",
      ownerId,
      x,
      y,
      radius: 36,
      ttlMs: 3600,
      armed: true,
    };
  }

  private damageObstacle(obsId: string, dmg: number, attackerId: string): void {
    const obs = this.obstacles[obsId];
    if (!obs) return;

    if (obs.type === "mimic_crate" && !obs.awake) {
      obs.awake = true;
      this.mimicFuse.set(obs.id, 4000);
    }

    obs.hp = Math.max(0, obs.hp - dmg);
    if (obs.hp > 0) return;

    delete this.obstacles[obsId];

    if (obs.type === "crate") {
      this.callbacks.onCrateDestroyed?.({ id: obs.id, x: obs.x, y: obs.y });
      const r = Math.random();
      const lid = `loot_${++this.seq}`;
      if (r < 0.55) {
        const pool: WeaponType[] = ["shotgun", "rifle", "sniper"];
        this.lootItems[lid] = {
          id: lid,
          kind: "weapon",
          weaponType: pool[Math.floor(Math.random() * pool.length)],
          x: obs.x,
          y: obs.y,
        };
      } else if (r < 0.8) {
        this.lootItems[lid] = { id: lid, kind: "medkit", x: obs.x, y: obs.y, amount: 35 };
      } else {
        this.lootItems[lid] = { id: lid, kind: "shield", x: obs.x, y: obs.y, amount: 25 };
      }
    } else if (obs.type === "golden_crate") {
      this.callbacks.onCrateDestroyed?.({
        id: obs.id,
        x: obs.x,
        y: obs.y,
        isGolden: true,
      });
      const sw = SPECIAL_WEAPONS[Math.floor(Math.random() * SPECIAL_WEAPONS.length)];
      this.spawnWeaponLoot(sw, obs.x - 20, obs.y);
      const sid = `loot_${++this.seq}`;
      this.lootItems[sid] = {
        id: sid,
        kind: "shield",
        x: obs.x + 20,
        y: obs.y,
        amount: 50,
      };
    } else if (obs.type === "explosive_barrel") {
      this.triggerExplosion(obs.x, obs.y, 150, 65, "barrel", attackerId, "Barril Explosivo");
    } else if (obs.type === "oil_barrel") {
      const hid = `haz_${++this.seq}`;
      this.hazardZones[hid] = {
        id: hid,
        type: "oil",
        ownerId: attackerId,
        x: obs.x,
        y: obs.y,
        radius: 78,
        ttlMs: 15000,
        armed: true,
      };
    } else if (obs.type === "mimic_crate") {
      this.triggerExplosion(obs.x, obs.y, 115, 45, "mimic", attackerId, "Caja Trampa");
    }
  }

  private triggerExplosion(
    x: number,
    y: number,
    radius: number,
    maxDmg: number,
    kind: ExplosionEvent["kind"],
    attackerId: string,
    label: string
  ): void {
    this.callbacks.onExplosion?.({ x, y, radius, kind });

    for (const hz of Object.values(this.hazardZones)) {
      if (hz.type === "oil" && Math.hypot(hz.x - x, hz.y - y) <= radius + hz.radius) {
        hz.type = "fire";
        hz.ttlMs = 6500;
      }
    }

    for (const p of Object.values(this.players)) {
      if (!p.alive || p.isAirborne) continue;
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist <= radius + 22) {
        const ratio = Math.max(0.45, 1 - dist / (radius + 22));
        const rt = this.runtime.get(p.id);
        if (rt) {
          const ang = Math.atan2(p.y - y, p.x - x);
          const force = kind === "jump_land" ? 640 : 760 * ratio;
          rt.extVx += Math.cos(ang) * force;
          rt.extVy += Math.sin(ang) * force;
        }
        if (!(kind === "jump_land" && p.id === attackerId)) {
          this.applyDamage(
            p,
            Math.round(maxDmg * ratio),
            attackerId,
            label,
            p.x,
            p.y,
            false
          );
        }
      }
    }

    if (kind !== "jump_land") {
      for (const obs of Object.values(this.obstacles)) {
        if (
          obs.type !== "rock" &&
          obs.type !== "tree" &&
          obs.type !== "bush" &&
          obs.type !== "jump_pad" &&
          Math.hypot(obs.x - x, obs.y - y) <= radius + obs.radius
        ) {
          this.damageObstacle(obs.id, maxDmg, attackerId);
        }
      }
    }
  }

  private stepMimics(dt: number, dtMs: number): void {
    for (const obs of Object.values(this.obstacles)) {
      if (obs.type !== "mimic_crate") continue;
      if (!obs.awake) {
        for (const p of Object.values(this.players)) {
          if (p.alive && !p.isAirborne && Math.hypot(p.x - obs.x, p.y - obs.y) < 85) {
            obs.awake = true;
            this.mimicFuse.set(obs.id, 4000);
            break;
          }
        }
      } else {
        const fuse = (this.mimicFuse.get(obs.id) ?? 4000) - dtMs;
        this.mimicFuse.set(obs.id, fuse);

        let nearest: PlayerState | null = null;
        let bestD = Infinity;
        for (const p of Object.values(this.players)) {
          if (!p.alive) continue;
          const d = Math.hypot(p.x - obs.x, p.y - obs.y);
          if (d < bestD) {
            bestD = d;
            nearest = p;
          }
        }
        if (nearest && bestD > 1) {
          obs.x += ((nearest.x - obs.x) / bestD) * 205 * dt;
          obs.y += ((nearest.y - obs.y) / bestD) * 205 * dt;
        }
        if (fuse <= 0 || bestD <= 38) {
          delete this.obstacles[obs.id];
          this.triggerExplosion(obs.x, obs.y, 115, 45, "mimic", "", "Caja Trampa");
        }
      }
    }
  }

  private stepHazards(dtMs: number): void {
    for (const [id, hz] of Object.entries(this.hazardZones)) {
      hz.ttlMs -= dtMs;
      if (hz.ttlMs <= 0) {
        delete this.hazardZones[id];
        continue;
      }
      if (hz.type === "mine" && hz.armed) {
        for (const p of Object.values(this.players)) {
          if (!p.alive || p.isAirborne || p.id === hz.ownerId) continue;
          if (Math.hypot(p.x - hz.x, p.y - hz.y) <= hz.radius + 15) {
            delete this.hazardZones[id];
            this.triggerExplosion(
              hz.x,
              hz.y,
              115,
              45,
              "mine",
              hz.ownerId,
              "Mina de Proximidad"
            );
            break;
          }
        }
      }
    }

    for (const p of Object.values(this.players)) {
      const rt = this.runtime.get(p.id);
      if (!rt || !p.alive || p.isAirborne) continue;
      const fire = this.inHazard(p.x, p.y, "fire");
      if (fire) {
        rt.fireAccumMs += dtMs;
        if (rt.fireAccumMs >= 250) {
          rt.fireAccumMs -= 250;
          this.applyDamage(p, 4.5, fire.ownerId, "Fuego", p.x, p.y, false);
        }
      } else {
        rt.fireAccumMs = 0;
      }
    }
  }

  private stepJumpPads(): void {
    for (const obs of Object.values(this.obstacles)) {
      if (obs.type !== "jump_pad") continue;
      for (const p of Object.values(this.players)) {
        const rt = this.runtime.get(p.id);
        if (!rt || !p.alive || p.isDowned || p.isAirborne || rt.padCdMs > 0) continue;
        if (Math.hypot(p.x - obs.x, p.y - obs.y) <= obs.radius + 8) {
          p.isAirborne = true;
          rt.airborneMs = 700;
          rt.padCdMs = 1300;
          rt.extVx += Math.cos(p.angle) * 440;
          rt.extVy += Math.sin(p.angle) * 440;
        }
      }
    }
  }

  private stepStorm(dtMs: number): void {
    if (this.roundElapsedMs > 35000) {
      this.stormRadius = Math.max(110, this.stormRadius - (24 * dtMs) / 1000);
    }
    for (const p of Object.values(this.players)) {
      const rt = this.runtime.get(p.id);
      if (!rt || !p.alive) continue;
      if (Math.hypot(p.x - this.stormX, p.y - this.stormY) > this.stormRadius) {
        rt.stormAccumMs += dtMs;
        if (rt.stormAccumMs >= 250) {
          rt.stormAccumMs -= 250;
          this.applyDamage(p, 2, "", "Tormenta", p.x, p.y, false);
        }
      } else {
        rt.stormAccumMs = 0;
      }
    }
  }

  private stepHotPotato(dtMs: number): void {
    if (this.modifier !== "hot_potato") return;
    let any = false;
    for (const p of Object.values(this.players)) {
      if (!p.alive || !p.hasHotPotato) continue;
      any = true;
      p.hotPotatoTimerMs = Math.max(0, p.hotPotatoTimerMs - dtMs);
      if (p.hotPotatoTimerMs <= 0) {
        p.hasHotPotato = false;
        this.callbacks.onExplosion?.({
          x: p.x,
          y: p.y,
          radius: 145,
          kind: "potato",
        });
        this.eliminatePlayer(p, "", "Papa Caliente 💣");
        any = false;
      }
    }
    if (!any) {
      const candidates = Object.values(this.players).filter(
        (p) => p.alive && !p.isDowned
      );
      if (candidates.length >= 2) {
        const next = candidates[Math.floor(Math.random() * candidates.length)];
        next.hasHotPotato = true;
        next.hotPotatoTimerMs = 12000;
      }
    }
  }

  private stepStealth(now: number): void {
    for (const p of Object.values(this.players)) {
      const rt = this.runtime.get(p.id);
      if (!p.alive || p.isDowned) {
        p.isInvisible = false;
        continue;
      }
      const shotRecently = rt ? now - rt.lastShoot < 550 : false;
      const inFire = this.inHazard(p.x, p.y, "fire") !== null;
      const inOil = this.inHazard(p.x, p.y, "oil") !== null;
      if (shotRecently || inFire || p.hasHotPotato) {
        p.isInvisible = false;
        continue;
      }
      if (this.modifier === "all_invisible") {
        p.isInvisible = !inOil;
        continue;
      }
      const inSmoke = this.inHazard(p.x, p.y, "smoke") !== null;
      const inBush = Object.values(this.obstacles).some(
        (o) => o.type === "bush" && Math.hypot(p.x - o.x, p.y - o.y) <= o.radius - 4
      );
      p.isInvisible = inSmoke || inBush;
    }
  }

  private inHazard(
    x: number,
    y: number,
    type: HazardZoneState["type"]
  ): HazardZoneState | null {
    for (const hz of Object.values(this.hazardZones)) {
      if (hz.type === type && Math.hypot(x - hz.x, y - hz.y) <= hz.radius) {
        return hz;
      }
    }
    return null;
  }

  private applyDamage(
    victim: PlayerState,
    dmg: number,
    attackerId: string,
    weaponLabel: string,
    hx: number,
    hy: number,
    fromDowned: boolean
  ): void {
    const rt = this.runtime.get(victim.id);
    if (!victim.alive || (rt && rt.invulnMs > 0)) return;

    if (rt && attackerId && attackerId !== victim.id) {
      rt.lastAttackerId = attackerId;
      rt.lastAttackerWeapon = weaponLabel;
    }

    this.callbacks.onBulletHit?.(
      {
        x: hx,
        y: hy,
        targetType: "player",
        damage: Math.max(1, Math.round(dmg)),
      },
      victim.id
    );

    if (fromDowned && attackerId && attackerId !== victim.id) {
      const shooter = this.players[attackerId];
      if (shooter && shooter.alive && shooter.isDowned) {
        shooter.isDowned = false;
        shooter.downedTimerMs = 0;
        shooter.hp = 30;
      }
    }

    if (victim.isDowned) {
      if (rt) {
        rt.downedBodyHp -= dmg;
        if (rt.downedBodyHp <= 0) {
          this.eliminatePlayer(victim, attackerId, weaponLabel);
        }
      }
      return;
    }

    let rem = dmg;
    if (victim.shield > 0) {
      const abs = Math.min(victim.shield, rem);
      victim.shield = Math.round(victim.shield - abs);
      rem -= abs;
    }
    if (rem > 0) {
      victim.hp = Math.max(0, Math.round(victim.hp - rem));
    }

    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.shield = 0;
      victim.isDowned = true;
      victim.downedTimerMs = 4000;
      victim.shieldActive = false;
      if (rt) rt.downedBodyHp = 40;
    }
  }

  private eliminatePlayer(
    victim: PlayerState,
    killerId: string,
    weaponLabel: string
  ): void {
    if (!victim.alive) return;
    victim.alive = false;
    victim.isDowned = false;
    victim.downedTimerMs = 0;
    victim.hp = 0;
    victim.shield = 0;

    const hadBounty = victim.hasBounty;
    victim.streak = 0;
    victim.hasBounty = false;

    const killer = killerId ? this.players[killerId] : undefined;
    if (killer && killer.id !== victim.id && killer.alive) {
      killer.score += 1;
      killer.streak += 1;
      killer.hasBounty = killer.streak >= 2;
      if (this.modifier === "vampire") {
        killer.hp = Math.min(killer.maxHp, killer.hp + 25);
      }
      if (hadBounty) {
        killer.shield = killer.maxShield;
        killer.weapon =
          SPECIAL_WEAPONS[Math.floor(Math.random() * SPECIAL_WEAPONS.length)];
      }
    }

    const botBrain = this.bots.get(victim.id);
    if (botBrain) {
      botBrain.respawnTimer = 2.6;
    }

    this.callbacks.onEliminated?.(
      {
        victimId: victim.id,
        killerId: killer?.id ?? "",
        x: victim.x,
        y: victim.y,
      },
      {
        killerName: killer && killer.id !== victim.id ? killer.name : "La Arena",
        victimName: victim.name,
        weapon: weaponLabel,
      }
    );
  }

  private checkLootForPlayer(p: PlayerState, interactEdge: boolean): void {
    if (!p.alive || p.isDowned || p.isAirborne) return;

    if (interactEdge) {
      let closest: LootItemState | null = null;
      let best = 58 * 58;
      for (const item of Object.values(this.lootItems)) {
        const dSq = (p.x - item.x) ** 2 + (p.y - item.y) ** 2;
        if (dSq <= best) {
          best = dSq;
          closest = item;
        }
      }
      if (closest) {
        this.consumeLoot(p, closest);
        return;
      }
    }

    for (const item of Object.values(this.lootItems)) {
      const dSq = (p.x - item.x) ** 2 + (p.y - item.y) ** 2;
      if (dSq > 38 * 38) continue;
      if (item.kind === "medkit" && p.hp < p.maxHp) {
        this.consumeLoot(p, item);
        break;
      }
      if (item.kind === "shield" && p.shield < p.maxShield) {
        this.consumeLoot(p, item);
        break;
      }
      if (item.kind === "weapon" && item.weaponType && p.weapon === "pistol") {
        this.consumeLoot(p, item);
        break;
      }
    }
  }

  private consumeLoot(p: PlayerState, item: LootItemState): void {
    delete this.lootItems[item.id];
    if (item.kind === "medkit") {
      p.hp = Math.min(p.maxHp, p.hp + (item.amount ?? 35));
    } else if (item.kind === "shield") {
      p.shield = Math.min(p.maxShield, p.shield + (item.amount ?? 25));
    } else if (item.kind === "weapon" && item.weaponType) {
      const prev = p.weapon;
      p.weapon = item.weaponType;
      if (prev !== "pistol" && prev !== item.weaponType) {
        this.spawnWeaponLoot(prev, item.x, item.y);
      }
    }
    this.callbacks.onPickup?.();
  }
}
