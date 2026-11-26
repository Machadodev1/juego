import { Container, Graphics, Text } from "pixi.js";
import type { LootItemState, ObstacleState, WeaponType } from "@shared/types";

interface ObstacleVisual {
  id: string;
  type: ObstacleState["type"];
  baseGfx: Graphics;
  hpGfx: Graphics;
  canopyGfx?: Graphics;
  x: number;
  y: number;
  radius: number;
  lastHp: number;
}

interface LootVisual {
  root: Container;
  gfx: Graphics;
  label: Text;
  baseX: number;
  baseY: number;
  phase: number;
}

const WEAPON_LOOT_COLORS: Record<WeaponType, number> = {
  pistol: 0x94a3b8,
  shotgun: 0xf97316,
  rifle: 0x38bdf8,
  sniper: 0xc084fc,
};

const WEAPON_SHORT_NAMES: Record<WeaponType, string> = {
  pistol: "PIS",
  shotgun: "ESCOPETA",
  rifle: "RIFLE",
  sniper: "SNIPER",
};

export class ArenaRenderer {
  public readonly groundContainer = new Container();
  public readonly lootContainer = new Container();
  public readonly obstacleContainer = new Container();
  public readonly canopyContainer = new Container();

  private floorGfx = new Graphics();
  private obstacleVisuals = new Map<string, ObstacleVisual>();
  private lootVisuals = new Map<string, LootVisual>();

  private renderedW = 0;
  private renderedH = 0;
  private animTime = 0;

  constructor() {
    this.groundContainer.addChild(this.floorGfx);
  }

  public renderMapBase(mapWidth: number, mapHeight: number): void {
    if (this.renderedW === mapWidth && this.renderedH === mapHeight) return;
    this.renderedW = mapWidth;
    this.renderedH = mapHeight;

    const pad = 900;
    this.floorGfx.clear();

    // Zona exterior oscura (fuera de límites)
    this.floorGfx
      .rect(-pad, -pad, mapWidth + pad * 2, mapHeight + pad * 2)
      .fill({ color: 0x2a4218, alpha: 1 });

    // Césped principal estilo ZombsRoyale
    this.floorGfx
      .roundRect(0, 0, mapWidth, mapHeight, 8)
      .fill({ color: 0x5c8d2a, alpha: 1 });

    // Cuadrícula táctica sutil (80x80)
    const gridSize = 80;
    for (let x = gridSize; x < mapWidth; x += gridSize) {
      this.floorGfx
        .moveTo(x, 0)
        .lineTo(x, mapHeight)
        .stroke({ width: 1.5, color: 0x4c7821, alpha: 0.65 });
    }
    for (let y = gridSize; y < mapHeight; y += gridSize) {
      this.floorGfx
        .moveTo(0, y)
        .lineTo(mapWidth, y)
        .stroke({ width: 1.5, color: 0x4c7821, alpha: 0.65 });
    }

    // Borde del mapa
    this.floorGfx
      .roundRect(0, 0, mapWidth, mapHeight, 8)
      .stroke({ width: 8, color: 0x1e293b, alpha: 0.95 });
    this.floorGfx
      .roundRect(-4, -4, mapWidth + 8, mapHeight + 8, 10)
      .stroke({ width: 3, color: 0xef4444, alpha: 0.65 });
  }

  public syncObstacles(
    obstacles: Record<string, ObstacleState>,
    localPlayerX?: number,
    localPlayerY?: number
  ): void {
    const activeIds = new Set(Object.keys(obstacles));

    for (const [id, vis] of this.obstacleVisuals.entries()) {
      if (!activeIds.has(id)) {
        this.obstacleContainer.removeChild(vis.baseGfx, vis.hpGfx);
        vis.baseGfx.destroy();
        vis.hpGfx.destroy();
        if (vis.canopyGfx) {
          this.canopyContainer.removeChild(vis.canopyGfx);
          vis.canopyGfx.destroy();
        }
        this.obstacleVisuals.delete(id);
      }
    }

    for (const [id, obs] of Object.entries(obstacles)) {
      let vis = this.obstacleVisuals.get(id);
      if (!vis) {
        vis = this.createObstacleVisual(obs);
        this.obstacleVisuals.set(id, vis);
      }

      if (obs.type === "crate" && vis.lastHp !== obs.hp) {
        vis.lastHp = obs.hp;
        this.drawCrateHp(vis.hpGfx, obs);
      }

      if (
        vis.canopyGfx &&
        localPlayerX !== undefined &&
        localPlayerY !== undefined
      ) {
        const dSq =
          (localPlayerX - obs.x) * (localPlayerX - obs.x) +
          (localPlayerY - obs.y) * (localPlayerY - obs.y);
        vis.canopyGfx.alpha = dSq < 78 * 78 ? 0.45 : 0.94;
      }
    }
  }

  private createObstacleVisual(obs: ObstacleState): ObstacleVisual {
    const baseGfx = new Graphics();
    const hpGfx = new Graphics();
    baseGfx.position.set(obs.x, obs.y);
    hpGfx.position.set(obs.x, obs.y);

    let canopyGfx: Graphics | undefined;

    if (obs.type === "rock") {
      // Sombra
      baseGfx.circle(4, 6, obs.radius).fill({ color: 0x1e293b, alpha: 0.35 });
      // Roca redondeada con relieve estilo ZombsRoyale
      baseGfx.circle(0, 0, obs.radius).fill({ color: 0x64748b });
      baseGfx.circle(-7, -8, obs.radius * 0.62).fill({ color: 0x94a3b8, alpha: 0.7 });
      baseGfx.circle(9, 10, obs.radius * 0.32).fill({ color: 0x475569, alpha: 0.65 });
      baseGfx
        .circle(0, 0, obs.radius)
        .stroke({ width: 4.5, color: 0x1e293b, alpha: 1 });
    } else if (obs.type === "crate") {
      const r = obs.radius;
      // Sombra
      baseGfx
        .roundRect(-r + 3, -r + 5, r * 2, r * 2, 7)
        .fill({ color: 0x1e293b, alpha: 0.38 });
      // Caja de madera ZombsRoyale
      baseGfx.roundRect(-r, -r, r * 2, r * 2, 7).fill({ color: 0xb45309 });
      baseGfx
        .roundRect(-r + 5, -r + 5, (r - 5) * 2, (r - 5) * 2, 4)
        .fill({ color: 0xd97706 });
      // Listones cruzados
      baseGfx
        .moveTo(-r + 5, -r + 5)
        .lineTo(r - 5, r - 5)
        .moveTo(r - 5, -r + 5)
        .lineTo(-r + 5, r - 5)
        .stroke({ width: 4, color: 0x92400e });
      baseGfx
        .moveTo(-r + 4, 0)
        .lineTo(r - 4, 0)
        .stroke({ width: 3, color: 0x78350f, alpha: 0.85 });
      baseGfx
        .roundRect(-r, -r, r * 2, r * 2, 7)
        .stroke({ width: 4.5, color: 0x292524, alpha: 1 });

      this.drawCrateHp(hpGfx, obs);
    } else if (obs.type === "tree") {
      // Tronco sólido
      baseGfx.circle(3, 4, obs.radius).fill({ color: 0x1e293b, alpha: 0.35 });
      baseGfx.circle(0, 0, obs.radius).fill({ color: 0x78350f });
      baseGfx.circle(-3, -3, obs.radius * 0.55).fill({ color: 0x92400e });
      baseGfx
        .circle(0, 0, obs.radius)
        .stroke({ width: 4, color: 0x1c1917, alpha: 1 });

      // Copa frondosa superior estilo ZombsRoyale
      canopyGfx = new Graphics();
      canopyGfx.position.set(obs.x, obs.y);
      const canopyR = 50;
      const lobes = 8;
      for (let i = 0; i < lobes; i++) {
        const ang = (i / lobes) * Math.PI * 2;
        const lx = Math.cos(ang) * 22;
        const ly = Math.sin(ang) * 22;
        canopyGfx.circle(lx, ly, 29).fill({ color: 0x1b4319 });
      }
      canopyGfx.circle(0, 0, canopyR).fill({ color: 0x2d6a27 });
      for (let i = 0; i < lobes; i++) {
        const ang = (i / lobes) * Math.PI * 2;
        const lx = Math.cos(ang) * 20;
        const ly = Math.sin(ang) * 20;
        canopyGfx.circle(lx, ly, 25).fill({ color: 0x2d6a27 });
      }
      canopyGfx.circle(-8, -8, 26).fill({ color: 0x3f8f35, alpha: 0.85 });
      this.canopyContainer.addChild(canopyGfx);
    }

    this.obstacleContainer.addChild(baseGfx, hpGfx);

    return {
      id: obs.id,
      type: obs.type,
      baseGfx,
      hpGfx,
      canopyGfx,
      x: obs.x,
      y: obs.y,
      radius: obs.radius,
      lastHp: obs.hp,
    };
  }

  private drawCrateHp(gfx: Graphics, obs: ObstacleState): void {
    gfx.clear();
    if (obs.hp >= obs.maxHp || obs.hp <= 0) return;

    const w = 44;
    const h = 6;
    const ratio = Math.max(0, Math.min(1, obs.hp / obs.maxHp));
    gfx
      .roundRect(-w / 2, -obs.radius - 14, w, h, 3)
      .fill({ color: 0x0f172a, alpha: 0.85 });
    gfx
      .roundRect(-w / 2 + 1, -obs.radius - 13, (w - 2) * ratio, h - 2, 2)
      .fill({ color: 0xfbbf24, alpha: 1 });
  }

  public syncLoot(lootItems: Record<string, LootItemState>, dtSeconds: number): void {
    this.animTime += dtSeconds;
    const activeIds = new Set(Object.keys(lootItems));

    for (const [id, vis] of this.lootVisuals.entries()) {
      if (!activeIds.has(id)) {
        this.lootContainer.removeChild(vis.root);
        vis.root.destroy({ children: true });
        this.lootVisuals.delete(id);
      }
    }

    for (const [id, item] of Object.entries(lootItems)) {
      let vis = this.lootVisuals.get(id);
      if (!vis) {
        vis = this.createLootVisual(item);
        this.lootVisuals.set(id, vis);
        this.lootContainer.addChild(vis.root);
      }

      const bob = Math.sin(this.animTime * 4 + vis.phase) * 3;
      const pulse = 1 + Math.sin(this.animTime * 5 + vis.phase) * 0.05;
      vis.root.position.set(vis.baseX, vis.baseY + bob);
      vis.gfx.scale.set(pulse);
    }
  }

  private createLootVisual(item: LootItemState): LootVisual {
    const root = new Container();
    const gfx = new Graphics();

    let labelText = "+35 HP";
    let accent = 0x22c55e;

    if (item.kind === "medkit") {
      // Aura verde curativa
      gfx.circle(0, 0, 22).fill({ color: 0x22c55e, alpha: 0.25 });
      gfx.circle(0, 0, 22).stroke({ width: 2, color: 0x4ade80, alpha: 0.85 });
      gfx.roundRect(-13, -11, 26, 22, 5).fill({ color: 0xf8fafc });
      gfx
        .roundRect(-13, -11, 26, 22, 5)
        .stroke({ width: 3, color: 0x1e293b });
      // Cruz médica verde
      gfx.rect(-3, -7, 6, 14).fill({ color: 0x16a34a });
      gfx.rect(-7, -3, 14, 6).fill({ color: 0x16a34a });
    } else {
      const wType = item.weaponType || "rifle";
      accent = WEAPON_LOOT_COLORS[wType];
      labelText = WEAPON_SHORT_NAMES[wType];

      gfx.circle(0, 0, 24).fill({ color: accent, alpha: 0.28 });
      gfx.circle(0, 0, 24).stroke({ width: 2.5, color: accent, alpha: 0.95 });
      gfx.roundRect(-15, -8, 30, 16, 5).fill({ color: 0x0f172a, alpha: 0.92 });
      gfx
        .roundRect(-15, -8, 30, 16, 5)
        .stroke({ width: 2.5, color: accent });
      // Silueta estilizada del arma
      gfx.roundRect(-10, -2.5, 20, 5, 2).fill({ color: accent });
      gfx.rect(-6, 1, 5, 5).fill({ color: 0xe2e8f0 });
    }

    const label = new Text({
      text: labelText,
      style: {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 10,
        fontWeight: "800",
        fill: "#ffffff",
        stroke: { color: "#0f172a", width: 3 },
      },
    });
    label.anchor.set(0.5, 0);
    label.position.set(0, 20);

    root.addChild(gfx, label);
    root.position.set(item.x, item.y);

    return {
      root,
      gfx,
      label,
      baseX: item.x,
      baseY: item.y,
      phase: Math.random() * Math.PI * 2,
    };
  }

  public reset(): void {
    for (const vis of this.obstacleVisuals.values()) {
      this.obstacleContainer.removeChild(vis.baseGfx, vis.hpGfx);
      vis.baseGfx.destroy();
      vis.hpGfx.destroy();
      if (vis.canopyGfx) {
        this.canopyContainer.removeChild(vis.canopyGfx);
        vis.canopyGfx.destroy();
      }
    }
    this.obstacleVisuals.clear();

    for (const vis of this.lootVisuals.values()) {
      this.lootContainer.removeChild(vis.root);
      vis.root.destroy({ children: true });
    }
    this.lootVisuals.clear();

    this.floorGfx.clear();
    this.renderedW = 0;
    this.renderedH = 0;
  }
}
