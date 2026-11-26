import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type {
  HazardZoneState,
  LootItemState,
  ObstacleState,
  PlayerState,
  WeaponType,
} from "@shared/types";
import { WEAPON_META } from "../constants";
import { hexToNumber } from "./Interpolation";

interface ObstacleNode {
  type: ObstacleState["type"];
  base: Container;
  hpBar?: Graphics;
  bodyGfx?: Graphics;
  canopy?: Container;
  renderedAwake: boolean;
  renderedCrackStage: number;
}

interface LootNode {
  root: Container;
  prompt: Container;
  phase: number;
  signature: string;
}

export const LOOT_PICKUP_RADIUS = 58;

const lootLabelStyle = new TextStyle({
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 10,
  fontWeight: "900",
  fill: "#f8fafc",
  stroke: { color: "#020617", width: 3 },
});

const keycapStyle = new TextStyle({
  fontFamily: "monospace",
  fontSize: 11,
  fontWeight: "900",
  fill: "#0f172a",
});

export class ArenaRenderer {
  public readonly groundContainer = new Container();
  public readonly hazardGroundContainer = new Container();
  public readonly padContainer = new Container();
  public readonly lootContainer = new Container();
  public readonly obstacleContainer = new Container();
  public readonly canopyContainer = new Container();
  public readonly smokeContainer = new Container();
  public readonly stormContainer = new Container();

  private groundGfx = new Graphics();
  private hazardGroundGfx = new Graphics();
  private smokeGfx = new Graphics();
  private stormGfx = new Graphics();

  private obstacleNodes = new Map<string, ObstacleNode>();
  private lootNodes = new Map<string, LootNode>();

  private renderedWidth = 0;
  private renderedHeight = 0;
  private animClock = 0;

  constructor() {
    this.groundContainer.addChild(this.groundGfx);
    this.hazardGroundContainer.addChild(this.hazardGroundGfx);
    this.smokeContainer.addChild(this.smokeGfx);
    this.stormContainer.addChild(this.stormGfx);
  }

  public renderMapBase(mapWidth: number, mapHeight: number): void {
    if (this.renderedWidth === mapWidth && this.renderedHeight === mapHeight) {
      return;
    }
    this.renderedWidth = mapWidth;
    this.renderedHeight = mapHeight;

    const g = this.groundGfx;
    g.clear();

    // Exterior oscuro
    g.rect(-700, -700, mapWidth + 1400, mapHeight + 1400).fill({
      color: 0x0f1f17,
    });

    // Césped vibrante estilo ZombsRoyale
    g.rect(0, 0, mapWidth, mapHeight).fill({ color: 0x2f6f44 });

    // Manchas orgánicas de pasto claro y tierra
    const patches = 26;
    for (let i = 0; i < patches; i++) {
      const px = ((i * 197 + 91) % (mapWidth - 160)) + 80;
      const py = ((i * 263 + 73) % (mapHeight - 160)) + 80;
      const r = 42 + (i % 4) * 18;
      g.circle(px, py, r).fill({
        color: i % 3 === 0 ? 0x3b8252 : 0x285e3a,
        alpha: 0.45,
      });
    }

    // Cuadrícula táctica sutil
    const step = 100;
    for (let x = step; x < mapWidth; x += step) {
      g.moveTo(x, 0)
        .lineTo(x, mapHeight)
        .stroke({ width: 1, color: 0x1e462b, alpha: 0.32 });
    }
    for (let y = step; y < mapHeight; y += step) {
      g.moveTo(0, y)
        .lineTo(mapWidth, y)
        .stroke({ width: 1, color: 0x1e462b, alpha: 0.32 });
    }

    // Plataforma central destacada para la Caja Dorada
    g.circle(mapWidth / 2, mapHeight / 2, 74).fill({
      color: 0x1e293b,
      alpha: 0.45,
    });
    g.circle(mapWidth / 2, mapHeight / 2, 74).stroke({
      width: 3,
      color: 0xfacc15,
      alpha: 0.55,
    });

    // Plataformas de aparición en las 4 esquinas
    const margin = Math.min(170, Math.round(mapWidth * 0.16));
    const spawns = [
      { x: margin, y: margin },
      { x: mapWidth - margin, y: margin },
      { x: margin, y: mapHeight - margin },
      { x: mapWidth - margin, y: mapHeight - margin },
    ];
    for (const sp of spawns) {
      g.circle(sp.x, sp.y, 44).fill({ color: 0x1e3a2a, alpha: 0.55 });
      g.circle(sp.x, sp.y, 44).stroke({
        width: 2,
        color: 0x86efac,
        alpha: 0.35,
      });
    }

    // Muro perimetral grueso
    g.rect(0, 0, mapWidth, mapHeight).stroke({
      width: 12,
      color: 0x1e293b,
    });
    g.rect(-6, -6, mapWidth + 12, mapHeight + 12).stroke({
      width: 3,
      color: 0x475569,
    });
  }

  public syncObstacles(
    obstacles: Record<string, ObstacleState>,
    players: Record<string, PlayerState>,
    localSessionId: string,
    dtSeconds: number
  ): void {
    this.animClock += dtSeconds;
    const activeIds = new Set(Object.keys(obstacles));
    const localPlayer = players[localSessionId];

    for (const [id, node] of this.obstacleNodes.entries()) {
      if (!activeIds.has(id)) {
        node.base.parent?.removeChild(node.base);
        node.base.destroy({ children: true });
        if (node.canopy) {
          this.canopyContainer.removeChild(node.canopy);
          node.canopy.destroy({ children: true });
        }
        this.obstacleNodes.delete(id);
      }
    }

    for (const [id, obs] of Object.entries(obstacles)) {
      let node = this.obstacleNodes.get(id);
      if (!node) {
        node = this.createObstacleNode(obs);
        this.obstacleNodes.set(id, node);
      }

      // Actualizar posición (importante para mimic_crate cuando persigue)
      if (obs.type === "mimic_crate" && obs.awake) {
        const jitterX = Math.sin(this.animClock * 38) * 2.5;
        const jitterY = Math.cos(this.animClock * 34) * 2.5;
        node.base.position.set(obs.x + jitterX, obs.y + jitterY);
      } else {
        node.base.position.set(obs.x, obs.y);
      }

      // Animación de pulso en trampolines
      if (obs.type === "jump_pad" && node.bodyGfx) {
        const pulse = 1 + Math.sin(this.animClock * 6) * 0.06;
        node.bodyGfx.scale.set(pulse);
      }

      // Redibujar cajas con grietas o mimics al despertar
      const ratio = obs.maxHp > 0 ? obs.hp / obs.maxHp : 1;
      const crackStage = ratio < 0.38 ? 2 : ratio < 0.72 ? 1 : 0;
      const isAwake = Boolean(obs.awake);

      if (
        (obs.type === "crate" ||
          obs.type === "golden_crate" ||
          obs.type === "mimic_crate") &&
        (node.renderedCrackStage !== crackStage ||
          node.renderedAwake !== isAwake)
      ) {
        if (node.bodyGfx) {
          this.drawCrateOrMimicVisual(
            node.bodyGfx,
            obs.type,
            obs.radius,
            crackStage,
            isAwake
          );
        }
        node.renderedCrackStage = crackStage;
        node.renderedAwake = isAwake;
      }

      // Barra de vida para obstáculos destructibles dañados
      if (node.hpBar) {
        node.hpBar.clear();
        if (obs.hp < obs.maxHp && obs.maxHp < 1000) {
          const w = obs.radius * 1.6;
          const pct = Math.max(0, Math.min(1, obs.hp / obs.maxHp));
          node.hpBar
            .roundRect(-w / 2, -obs.radius - 13, w, 6, 3)
            .fill({ color: 0x020617, alpha: 0.85 });
          node.hpBar
            .roundRect(-w / 2 + 1, -obs.radius - 12, (w - 2) * pct, 4, 2)
            .fill({
              color:
                obs.type === "golden_crate"
                  ? 0xfacc15
                  : obs.type === "explosive_barrel"
                  ? 0xef4444
                  : 0xf97316,
            });
        }
      }

      // Copa de árbol o arbusto en canopyContainer
      if (node.canopy) {
        if (obs.type === "tree") {
          node.canopy.position.set(obs.x, obs.y);
          const canopyR = obs.radius * 2.5;
          const distLocal = localPlayer
            ? Math.hypot(localPlayer.x - obs.x, localPlayer.y - obs.y)
            : Infinity;
          node.canopy.alpha = distLocal < canopyR + 14 ? 0.34 : 0.96;
        } else if (obs.type === "bush") {
          // Temblor del arbusto si alguien se mueve dentro
          let someoneInside = false;
          for (const p of Object.values(players)) {
            if (!p.alive) continue;
            if (Math.hypot(p.x - obs.x, p.y - obs.y) <= obs.radius) {
              someoneInside = true;
              break;
            }
          }
          const shake = someoneInside
            ? Math.sin(this.animClock * 28 + obs.x) * 3
            : 0;
          node.canopy.position.set(obs.x + shake, obs.y);

          const distLocal = localPlayer
            ? Math.hypot(localPlayer.x - obs.x, localPlayer.y - obs.y)
            : Infinity;
          node.canopy.alpha = distLocal <= obs.radius + 8 ? 0.42 : 0.95;
        }
      }
    }
  }

  private createObstacleNode(obs: ObstacleState): ObstacleNode {
    const base = new Container();
    base.position.set(obs.x, obs.y);
    const bodyGfx = new Graphics();
    base.addChild(bodyGfx);

    let hpBar: Graphics | undefined;
    let canopy: Container | undefined;

    if (obs.type === "rock") {
      bodyGfx
        .circle(4, 5, obs.radius)
        .fill({ color: 0x000000, alpha: 0.28 });
      const pts: number[] = [];
      const sides = 8;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const r = obs.radius * (i % 2 === 0 ? 1 : 0.86);
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      bodyGfx.poly(pts, true).fill({ color: 0x64748b });
      bodyGfx.poly(pts, true).stroke({ width: 3.5, color: 0x1e293b });
      bodyGfx
        .circle(-obs.radius * 0.25, -obs.radius * 0.25, obs.radius * 0.38)
        .fill({ color: 0x94a3b8, alpha: 0.65 });
      this.obstacleContainer.addChild(base);
    } else if (obs.type === "tree") {
      bodyGfx
        .circle(3, 4, obs.radius)
        .fill({ color: 0x000000, alpha: 0.3 });
      bodyGfx.circle(0, 0, obs.radius).fill({ color: 0x78350f });
      bodyGfx
        .circle(0, 0, obs.radius)
        .stroke({ width: 3, color: 0x451a03 });
      this.obstacleContainer.addChild(base);

      canopy = new Container();
      canopy.position.set(obs.x, obs.y);
      const cg = new Graphics();
      const cr = obs.radius * 2.45;
      cg.circle(4, 6, cr).fill({ color: 0x000000, alpha: 0.22 });
      cg.circle(0, 0, cr).fill({ color: 0x15803d });
      cg.circle(-cr * 0.24, -cr * 0.2, cr * 0.65).fill({ color: 0x22c55e, alpha: 0.55 });
      cg.circle(cr * 0.26, cr * 0.18, cr * 0.5).fill({ color: 0x166534, alpha: 0.65 });
      cg.circle(0, 0, cr).stroke({ width: 3.5, color: 0x052e16 });
      canopy.addChild(cg);
      this.canopyContainer.addChild(canopy);
    } else if (obs.type === "bush") {
      canopy = new Container();
      canopy.position.set(obs.x, obs.y);
      const bg = new Graphics();
      const r = obs.radius;
      bg.circle(2, 4, r).fill({ color: 0x000000, alpha: 0.2 });
      bg.circle(-r * 0.35, 0, r * 0.68).fill({ color: 0x16a34a });
      bg.circle(r * 0.35, 2, r * 0.65).fill({ color: 0x15803d });
      bg.circle(0, -r * 0.3, r * 0.7).fill({ color: 0x22c55e });
      bg.circle(0, 0, r * 0.85).stroke({
        width: 3,
        color: 0x14532d,
        alpha: 0.8,
      });
      canopy.addChild(bg);
      this.canopyContainer.addChild(canopy);
    } else if (obs.type === "jump_pad") {
      bodyGfx.circle(0, 0, obs.radius).fill({ color: 0x0f172a });
      bodyGfx
        .circle(0, 0, obs.radius)
        .stroke({ width: 3.5, color: 0x22d3ee });
      bodyGfx.circle(0, 0, obs.radius * 0.68).fill({ color: 0x0891b2 });
      bodyGfx.circle(0, 0, obs.radius * 0.36).fill({ color: 0xa3e635 });
      this.padContainer.addChild(base);
    } else if (obs.type === "explosive_barrel") {
      bodyGfx
        .circle(3, 4, obs.radius)
        .fill({ color: 0x000000, alpha: 0.32 });
      bodyGfx.circle(0, 0, obs.radius).fill({ color: 0xdc2626 });
      bodyGfx
        .circle(0, 0, obs.radius)
        .stroke({ width: 3.5, color: 0x450a0a });
      bodyGfx
        .circle(0, 0, obs.radius * 0.68)
        .stroke({ width: 3, color: 0xfacc15 });
      bodyGfx
        .poly([0, -9, 9, 7, -9, 7], true)
        .fill({ color: 0xfef08a });
      hpBar = new Graphics();
      base.addChild(hpBar);
      this.obstacleContainer.addChild(base);
    } else if (obs.type === "oil_barrel") {
      bodyGfx
        .circle(3, 4, obs.radius)
        .fill({ color: 0x000000, alpha: 0.32 });
      bodyGfx.circle(0, 0, obs.radius).fill({ color: 0x1e293b });
      bodyGfx
        .circle(0, 0, obs.radius)
        .stroke({ width: 3.5, color: 0x020617 });
      bodyGfx
        .circle(0, 0, obs.radius * 0.62)
        .stroke({ width: 2.5, color: 0xa855f7 });
      bodyGfx.circle(0, 2, 6).fill({ color: 0x0f172a });
      bodyGfx.poly([0, -7, 5, 2, -5, 2], true).fill({ color: 0xa855f7 });
      hpBar = new Graphics();
      base.addChild(hpBar);
      this.obstacleContainer.addChild(base);
    } else {
      // crate, golden_crate, mimic_crate
      this.drawCrateOrMimicVisual(
        bodyGfx,
        obs.type,
        obs.radius,
        0,
        Boolean(obs.awake)
      );
      hpBar = new Graphics();
      base.addChild(hpBar);
      this.obstacleContainer.addChild(base);
    }

    return {
      type: obs.type,
      base,
      hpBar,
      bodyGfx,
      canopy,
      renderedAwake: Boolean(obs.awake),
      renderedCrackStage: 0,
    };
  }

  private drawCrateOrMimicVisual(
    gfx: Graphics,
    type: ObstacleState["type"],
    radius: number,
    crackStage: number,
    awake: boolean
  ): void {
    gfx.clear();
    const s = radius * 1.72;
    const half = s / 2;

    gfx
      .roundRect(-half + 3, -half + 4, s, s, 7)
      .fill({ color: 0x000000, alpha: 0.32 });

    if (type === "golden_crate") {
      gfx.circle(0, 0, radius * 1.35).fill({ color: 0xfacc15, alpha: 0.22 });
      gfx.roundRect(-half, -half, s, s, 8).fill({ color: 0xeab308 });
      gfx
        .roundRect(-half + 4, -half + 4, s - 8, s - 8, 5)
        .fill({ color: 0xfacc15 });
      gfx.roundRect(-half, -half, s, s, 8).stroke({
        width: 3.5,
        color: 0x713f12,
      });
      gfx
        .moveTo(-half, 0)
        .lineTo(half, 0)
        .moveTo(0, -half)
        .lineTo(0, half)
        .stroke({ width: 4, color: 0xfef08a });
      gfx.circle(0, 0, 8).fill({ color: 0xffffff });
    } else if (type === "mimic_crate" && awake) {
      // Caja trampa despierta mostrando ojos rojos y colmillos
      gfx.roundRect(-half, -half, s, s, 7).fill({ color: 0x7c2d12 });
      gfx.roundRect(-half, -half, s, s, 7).stroke({
        width: 3.5,
        color: 0xef4444,
      });
      // Boca oscura abierta
      gfx.roundRect(-half + 5, -2, s - 10, half - 3, 4).fill({
        color: 0x090d16,
      });
      // Dientes afilados blancos
      for (let tx = -half + 8; tx <= half - 12; tx += 9) {
        gfx
          .poly([tx, -2, tx + 4, 6, tx + 8, -2], true)
          .fill({ color: 0xf8fafc });
      }
      // Ojos brillantes furiosos
      gfx.circle(-9, -10, 4.5).fill({ color: 0xef4444 });
      gfx.circle(9, -10, 4.5).fill({ color: 0xef4444 });
      gfx.circle(-9, -10, 2).fill({ color: 0xfef08a });
      gfx.circle(9, -10, 2).fill({ color: 0xfef08a });
    } else {
      // Caja normal (o mimic dormido idéntico)
      gfx.roundRect(-half, -half, s, s, 6).fill({ color: 0xb45309 });
      gfx
        .roundRect(-half + 4, -half + 4, s - 8, s - 8, 4)
        .fill({ color: 0xd97706 });
      gfx
        .moveTo(-half + 5, -half + 5)
        .lineTo(half - 5, half - 5)
        .stroke({ width: 4, color: 0x92400e });
      gfx.roundRect(-half, -half, s, s, 6).stroke({
        width: 3,
        color: 0x451a03,
      });
    }

    // Grietas progresivas por daño
    if (crackStage >= 1) {
      gfx
        .moveTo(-half * 0.6, -half * 0.4)
        .lineTo(-2, 1)
        .lineTo(half * 0.4, -half * 0.2)
        .stroke({ width: 2.2, color: 0x1c1917 });
    }
    if (crackStage >= 2) {
      gfx
        .moveTo(half * 0.5, half * 0.55)
        .lineTo(1, 2)
        .lineTo(-half * 0.45, half * 0.4)
        .stroke({ width: 2.5, color: 0x090d16 });
    }
  }

  public syncHazards(
    hazardZones: Record<string, HazardZoneState>,
    localSessionId: string
  ): void {
    this.hazardGroundGfx.clear();
    this.smokeGfx.clear();

    for (const hz of Object.values(hazardZones)) {
      if (hz.type === "oil") {
        this.hazardGroundGfx
          .circle(hz.x, hz.y, hz.radius)
          .fill({ color: 0x0f172a, alpha: 0.78 });
        this.hazardGroundGfx
          .circle(hz.x - hz.radius * 0.22, hz.y - hz.radius * 0.18, hz.radius * 0.45)
          .fill({ color: 0x581c87, alpha: 0.32 });
        this.hazardGroundGfx
          .circle(hz.x, hz.y, hz.radius)
          .stroke({ width: 2, color: 0x334155, alpha: 0.7 });
      } else if (hz.type === "fire") {
        const flicker = 0.92 + Math.sin(this.animClock * 20 + hz.x) * 0.08;
        this.hazardGroundGfx
          .circle(hz.x, hz.y, hz.radius * flicker)
          .fill({ color: 0xea580c, alpha: 0.62 });
        this.hazardGroundGfx
          .circle(hz.x, hz.y, hz.radius * 0.68 * flicker)
          .fill({ color: 0xfacc15, alpha: 0.68 });
        this.hazardGroundGfx
          .circle(hz.x, hz.y, hz.radius)
          .stroke({ width: 2.5, color: 0xef4444, alpha: 0.85 });
      } else if (hz.type === "mine") {
        const isMine = hz.ownerId === localSessionId;
        const alpha = isMine || !hz.armed ? 0.92 : 0.36;
        const blink = Math.sin(this.animClock * 10 + hz.x) > 0;
        this.hazardGroundGfx
          .circle(hz.x, hz.y, 13)
          .fill({ color: 0x1e293b, alpha });
        this.hazardGroundGfx
          .circle(hz.x, hz.y, 13)
          .stroke({ width: 2, color: isMine ? 0x38bdf8 : 0xef4444, alpha });
        this.hazardGroundGfx
          .circle(hz.x, hz.y, 4.5)
          .fill({ color: blink ? 0xef4444 : 0x7f1d1d, alpha });
      } else if (hz.type === "smoke") {
        this.smokeGfx
          .circle(hz.x, hz.y, hz.radius)
          .fill({ color: 0x94a3b8, alpha: 0.55 });
        this.smokeGfx
          .circle(hz.x - hz.radius * 0.3, hz.y - hz.radius * 0.2, hz.radius * 0.68)
          .fill({ color: 0xcbd5e1, alpha: 0.45 });
        this.smokeGfx
          .circle(hz.x + hz.radius * 0.28, hz.y + hz.radius * 0.22, hz.radius * 0.62)
          .fill({ color: 0x64748b, alpha: 0.45 });
      }
    }
  }

  public renderStorm(
    stormX: number,
    stormY: number,
    stormRadius: number
  ): void {
    this.stormGfx.clear();
    const outerThickness = 2600;
    this.stormGfx
      .circle(stormX, stormY, stormRadius + outerThickness / 2)
      .stroke({
        width: outerThickness,
        color: 0xdc2626,
        alpha: 0.24,
      });

    const pulseAlpha = 0.65 + Math.sin(this.animClock * 5) * 0.2;
    this.stormGfx.circle(stormX, stormY, stormRadius).stroke({
      width: 5,
      color: 0xf87171,
      alpha: pulseAlpha,
    });
  }

  public syncLoot(
    lootItems: Record<string, LootItemState>,
    dtSeconds: number,
    playerX?: number,
    playerY?: number,
    playerAlive = false
  ): void {
    const activeIds = new Set(Object.keys(lootItems));

    for (const [id, node] of this.lootNodes.entries()) {
      if (!activeIds.has(id)) {
        this.lootContainer.removeChild(node.root);
        node.root.destroy({ children: true });
        this.lootNodes.delete(id);
      }
    }

    let closestId: string | null = null;
    let closestDistSq = LOOT_PICKUP_RADIUS * LOOT_PICKUP_RADIUS;

    if (
      playerAlive &&
      typeof playerX === "number" &&
      typeof playerY === "number"
    ) {
      for (const [id, item] of Object.entries(lootItems)) {
        const dSq = (playerX - item.x) ** 2 + (playerY - item.y) ** 2;
        if (dSq <= closestDistSq) {
          closestDistSq = dSq;
          closestId = id;
        }
      }
    }

    for (const [id, item] of Object.entries(lootItems)) {
      const sig = `${item.kind}:${item.weaponType ?? ""}:${item.amount ?? 0}`;
      let node = this.lootNodes.get(id);
      if (node && node.signature !== sig) {
        this.lootContainer.removeChild(node.root);
        node.root.destroy({ children: true });
        this.lootNodes.delete(id);
        node = undefined;
      }

      if (!node) {
        node = this.createLootNode(item, sig);
        this.lootNodes.set(id, node);
        this.lootContainer.addChild(node.root);
      }

      node.phase += dtSeconds * 3.8;
      const bobY = Math.sin(node.phase) * 3.2;
      node.root.position.set(item.x, item.y + bobY);
      node.prompt.visible = id === closestId;
    }
  }

  private createLootNode(item: LootItemState, signature: string): LootNode {
    const root = new Container();
    root.position.set(item.x, item.y);
    const gfx = new Graphics();

    if (item.kind === "medkit") {
      gfx.circle(0, 0, 20).fill({ color: 0x22c55e, alpha: 0.25 });
      gfx.roundRect(-13, -11, 26, 22, 6).fill({ color: 0xf8fafc });
      gfx
        .roundRect(-13, -11, 26, 22, 6)
        .stroke({ width: 2.5, color: 0x16a34a });
      gfx.roundRect(-3, -7, 6, 14, 1.5).fill({ color: 0x16a34a });
      gfx.roundRect(-7, -3, 14, 6, 1.5).fill({ color: 0x16a34a });
      root.addChild(gfx);
    } else if (item.kind === "shield") {
      const isBig = (item.amount ?? 25) >= 50;
      gfx.circle(0, 0, isBig ? 23 : 19).fill({ color: 0x38bdf8, alpha: 0.3 });
      gfx.circle(0, 2, isBig ? 12 : 10).fill({ color: 0x0284c7 });
      gfx
        .circle(0, 2, isBig ? 12 : 10)
        .stroke({ width: 2.5, color: 0xe0f2fe });
      gfx.roundRect(-4, -12, 8, 5, 2).fill({ color: 0xbae6fd });
      const label = new Text({
        text: isBig ? "+50 ESCUDO" : "+25 ESCUDO",
        style: lootLabelStyle,
      });
      label.anchor.set(0.5, 0);
      label.position.set(0, 16);
      root.addChild(gfx, label);
    } else {
      const wType: WeaponType = item.weaponType || "rifle";
      const meta = WEAPON_META[wType] || WEAPON_META.rifle;
      const color = hexToNumber(meta.badgeHex, 0x38bdf8);

      if (meta.isSpecial) {
        gfx.circle(0, 0, 25).fill({ color: 0xfacc15, alpha: 0.28 });
        gfx
          .circle(0, 0, 22)
          .stroke({ width: 2, color: 0xfef08a, alpha: 0.8 });
      } else {
        gfx.circle(0, 0, 21).fill({ color, alpha: 0.25 });
      }

      gfx.roundRect(-16, -9, 32, 18, 6).fill({ color: 0x0f172a, alpha: 0.92 });
      gfx.roundRect(-16, -9, 32, 18, 6).stroke({ width: 2.2, color });
      gfx.roundRect(-10, -3, 20, 6, 2).fill({ color });

      const label = new Text({ text: meta.label, style: lootLabelStyle });
      label.anchor.set(0.5, 0);
      label.position.set(0, 13);
      root.addChild(gfx, label);
    }

    const prompt = new Container();
    const keyBg = new Graphics();
    keyBg.roundRect(-12, -37, 24, 20, 5).fill({ color: 0xfacc15 });
    keyBg
      .roundRect(-12, -37, 24, 20, 5)
      .stroke({ width: 2, color: 0x0f172a });
    const keyTxt = new Text({ text: "E", style: keycapStyle });
    keyTxt.anchor.set(0.5);
    keyTxt.position.set(0, -27);
    prompt.addChild(keyBg, keyTxt);
    prompt.visible = false;
    root.addChild(prompt);

    return {
      root,
      prompt,
      phase: Math.random() * Math.PI * 2,
      signature,
    };
  }

  public reset(): void {
    for (const node of this.obstacleNodes.values()) {
      node.base.destroy({ children: true });
      node.canopy?.destroy({ children: true });
    }
    this.obstacleNodes.clear();

    for (const node of this.lootNodes.values()) {
      node.root.destroy({ children: true });
    }
    this.lootNodes.clear();

    this.groundGfx.clear();
    this.hazardGroundGfx.clear();
    this.smokeGfx.clear();
    this.stormGfx.clear();
    this.renderedWidth = 0;
    this.renderedHeight = 0;
  }
}
