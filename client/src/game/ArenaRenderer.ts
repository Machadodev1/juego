import { Container, Graphics, Text } from "pixi.js";
import type {
  ArenaTheme,
  LootItemState,
  ObstacleState,
  WeaponType,
} from "@shared/types";
import { WEAPON_META } from "../constants";

/* ------------------------------------------------------------------ */
/* Paletas por tema                                                    */
/* ------------------------------------------------------------------ */

export interface ThemeStyle {
  background: string;
  outside: number;
  minimapBg: number;
  minimapRock: number;
  minimapFlora: number;
  minimapCrate: number;
}

export const THEME_STYLE: Record<ArenaTheme, ThemeStyle> = {
  cyber_outpost: {
    background: "#0a1220",
    outside: 0x0a1220,
    minimapBg: 0x0b1a2b,
    minimapRock: 0x64748b,
    minimapFlora: 0x22d3ee,
    minimapCrate: 0xfacc15,
  },
  midnight: {
    background: "#050a14",
    outside: 0x050a14,
    minimapBg: 0x0a1426,
    minimapRock: 0x8b5cf6,
    minimapFlora: 0x2dd4bf,
    minimapCrate: 0x5eead4,
  },
  arctic: {
    background: "#8fb4c9",
    outside: 0x8fb4c9,
    minimapBg: 0x1e3a4f,
    minimapRock: 0xa9d6ee,
    minimapFlora: 0x34d399,
    minimapCrate: 0xf97316,
  },
  desert: {
    background: "#7a4e1f",
    outside: 0x7a4e1f,
    minimapBg: 0x3b2a14,
    minimapRock: 0xc98a4b,
    minimapFlora: 0x4ade80,
    minimapCrate: 0xfbbf24,
  },
};

interface CratePalette {
  body: number;
  panel: number;
  accent: number;
  stripe: number;
  edge: number;
}

const CRATE_PALETTE: Record<ArenaTheme, CratePalette> = {
  cyber_outpost: {
    body: 0x334155,
    panel: 0x1e293b,
    accent: 0x22d3ee,
    stripe: 0xfacc15,
    edge: 0x0b1220,
  },
  midnight: {
    body: 0x3b2f55,
    panel: 0x241a3a,
    accent: 0x5eead4,
    stripe: 0x8b5cf6,
    edge: 0x0f0a1f,
  },
  arctic: {
    body: 0xf97316,
    panel: 0xc2410c,
    accent: 0xffffff,
    stripe: 0x1e293b,
    edge: 0x431407,
  },
  desert: {
    body: 0x8b5a2b,
    panel: 0x6b4423,
    accent: 0xfbbf24,
    stripe: 0x1c1917,
    edge: 0x1c1208,
  },
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polygon(
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotation = 0,
  rand?: () => number,
  jitter = 0
): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const ang = rotation + (i / sides) * Math.PI * 2;
    const rr = rand ? r * (1 - jitter + rand() * jitter * 2) : r;
    pts.push(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
  }
  return pts;
}

/* ------------------------------------------------------------------ */
/* Visuales                                                            */
/* ------------------------------------------------------------------ */

interface ObstacleVisual {
  id: string;
  type: ObstacleState["type"];
  theme: ArenaTheme;
  baseGfx: Graphics;
  hpGfx: Graphics;
  canopyGfx?: Graphics;
  canopyBaseAlpha: number;
  x: number;
  y: number;
  radius: number;
  lastHp: number;
}

interface LootVisual {
  root: Container;
  gfx: Graphics;
  label: Text;
  prompt: Container;
  ring: Graphics;
  baseX: number;
  baseY: number;
  phase: number;
}

export const LOOT_PICKUP_RADIUS = 58;

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
  private renderedTheme: ArenaTheme | null = null;
  private theme: ArenaTheme = "cyber_outpost";
  private animTime = 0;

  constructor() {
    this.groundContainer.addChild(this.floorGfx);
  }

  public getTheme(): ArenaTheme {
    return this.theme;
  }

  /* ----------------------------- Suelo ----------------------------- */

  public renderMapBase(
    mapWidth: number,
    mapHeight: number,
    theme: ArenaTheme
  ): void {
    if (
      this.renderedW === mapWidth &&
      this.renderedH === mapHeight &&
      this.renderedTheme === theme
    ) {
      return;
    }
    this.renderedW = mapWidth;
    this.renderedH = mapHeight;
    this.renderedTheme = theme;
    this.theme = theme;

    const g = this.floorGfx;
    g.clear();

    const pad = 1200;
    g.rect(-pad, -pad, mapWidth + pad * 2, mapHeight + pad * 2).fill({
      color: THEME_STYLE[theme].outside,
    });

    switch (theme) {
      case "midnight":
        this.drawMidnightFloor(g, mapWidth, mapHeight);
        break;
      case "arctic":
        this.drawArcticFloor(g, mapWidth, mapHeight);
        break;
      case "desert":
        this.drawDesertFloor(g, mapWidth, mapHeight);
        break;
      default:
        this.drawCyberFloor(g, mapWidth, mapHeight);
        break;
    }
  }

  private drawCyberFloor(g: Graphics, w: number, h: number): void {
    const rand = mulberry32(1337);
    g.roundRect(0, 0, w, h, 10).fill({ color: 0x14212f });

    // Malla hexagonal de placas metálicas
    const s = 46;
    const dx = s * 1.5;
    const dy = Math.sqrt(3) * s;
    const lit: Array<[number, number]> = [];

    for (let col = -1; col * dx < w + s; col++) {
      for (let row = -1; row * dy < h + s; row++) {
        const cx = col * dx;
        const cy = row * dy + (col % 2 === 0 ? 0 : dy / 2);
        if (cx < -s || cy < -s || cx > w + s || cy > h + s) continue;
        const pts = polygon(cx, cy, s - 1.5, 6, 0);
        g.poly(pts).stroke({ width: 1.5, color: 0x203a52, alpha: 0.95 });
        if (rand() < 0.09) lit.push([cx, cy]);
      }
    }

    for (const [cx, cy] of lit) {
      g.poly(polygon(cx, cy, s - 5, 6, 0)).fill({
        color: 0x1d4466,
        alpha: 0.55,
      });
    }

    // Plataformas de aparición en las esquinas
    const pads: Array<[number, number]> = [
      [180, 180],
      [1420, 180],
      [180, 1020],
      [1420, 1020],
    ];
    for (const [px, py] of pads) {
      g.circle(px, py, 74).fill({ color: 0x0b1626, alpha: 0.75 });
      g.circle(px, py, 74).stroke({ width: 3, color: 0x22d3ee, alpha: 0.6 });
      g.circle(px, py, 52).stroke({ width: 2, color: 0x22d3ee, alpha: 0.35 });
      g.poly(polygon(px, py, 28, 6, Math.PI / 6)).stroke({
        width: 2,
        color: 0x22d3ee,
        alpha: 0.5,
      });
    }

    // Bordes luminosos
    g.roundRect(0, 0, w, h, 10).stroke({ width: 10, color: 0x0b1220 });
    g.roundRect(0, 0, w, h, 10).stroke({
      width: 3,
      color: 0x22d3ee,
      alpha: 0.85,
    });
  }

  private drawMidnightFloor(g: Graphics, w: number, h: number): void {
    const rand = mulberry32(777);
    g.roundRect(0, 0, w, h, 12).fill({ color: 0x0c1626 });

    for (let i = 0; i < 70; i++) {
      g.ellipse(
        rand() * w,
        rand() * h,
        40 + rand() * 90,
        28 + rand() * 60
      ).fill({ color: 0x10223c, alpha: 0.8 });
    }
    for (let i = 0; i < 6; i++) {
      g.circle(rand() * w, rand() * h, 120 + rand() * 120).fill({
        color: 0x2b5a8c,
        alpha: 0.07,
      });
    }

    // Hierba oscura
    for (let i = 0; i < 650; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const c = rand() < 0.5 ? 0x1c3b45 : 0x16303a;
      g.moveTo(x, y).lineTo(x - 3, y - 8).stroke({ width: 1.6, color: c, alpha: 0.8 });
      g.moveTo(x, y).lineTo(x + 3, y - 9).stroke({ width: 1.6, color: c, alpha: 0.8 });
    }

    g.roundRect(0, 0, w, h, 12).stroke({ width: 10, color: 0x050a14 });
    g.roundRect(0, 0, w, h, 12).stroke({
      width: 3,
      color: 0x38bdf8,
      alpha: 0.35,
    });
  }

  private drawArcticFloor(g: Graphics, w: number, h: number): void {
    const rand = mulberry32(2024);
    g.roundRect(0, 0, w, h, 12).fill({ color: 0xe6f2f9 });

    // Placas de hielo
    for (let i = 0; i < 34; i++) {
      g.ellipse(
        rand() * w,
        rand() * h,
        50 + rand() * 110,
        30 + rand() * 70
      ).fill({ color: 0xbfe3f2, alpha: 0.7 });
    }

    // Ventisqueros
    for (let i = 0; i < 180; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const rx = 14 + rand() * 30;
      g.ellipse(x + 3, y + 5, rx, rx * 0.45).fill({
        color: 0xcfe3ee,
        alpha: 0.8,
      });
      g.ellipse(x, y, rx, rx * 0.45).fill({ color: 0xffffff, alpha: 0.95 });
    }

    // Grietas
    for (let i = 0; i < 26; i++) {
      let x = rand() * w;
      let y = rand() * h;
      g.moveTo(x, y);
      const segs = 4 + Math.floor(rand() * 4);
      for (let k = 0; k < segs; k++) {
        x += (rand() - 0.5) * 70;
        y += (rand() - 0.5) * 70;
        g.lineTo(x, y);
      }
      g.stroke({ width: 1.6, color: 0x8fbad1, alpha: 0.75 });
    }

    g.roundRect(0, 0, w, h, 12).stroke({ width: 10, color: 0x6b8da3 });
    g.roundRect(0, 0, w, h, 12).stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
  }

  private drawDesertFloor(g: Graphics, w: number, h: number): void {
    const rand = mulberry32(4242);
    g.roundRect(0, 0, w, h, 12).fill({ color: 0xddb06d });

    for (let i = 0; i < 28; i++) {
      g.ellipse(
        rand() * w,
        rand() * h,
        60 + rand() * 130,
        34 + rand() * 80
      ).fill({ color: 0xcf9f5c, alpha: 0.55 });
    }

    // Ondulaciones de dunas
    for (let i = 0; i < 46; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 90 + rand() * 170;
      g.moveTo(x, y)
        .quadraticCurveTo(x + len / 2, y - 18 - rand() * 14, x + len, y)
        .stroke({ width: 3, color: 0xc89a55, alpha: 0.65 });
      g.moveTo(x + 8, y + 10)
        .quadraticCurveTo(x + len / 2 + 8, y - 6, x + len - 10, y + 10)
        .stroke({ width: 2, color: 0xf0cd8f, alpha: 0.55 });
    }

    // Guijarros
    for (let i = 0; i < 220; i++) {
      g.circle(rand() * w, rand() * h, 1.5 + rand() * 2.5).fill({
        color: 0xb98a4a,
        alpha: 0.85,
      });
    }

    g.roundRect(0, 0, w, h, 12).stroke({ width: 10, color: 0x7a4e1f });
    g.roundRect(0, 0, w, h, 12).stroke({ width: 3, color: 0xfbbf24, alpha: 0.55 });
  }

  /* ------------------------- Obstáculos ---------------------------- */

  public syncObstacles(
    obstacles: Record<string, ObstacleState>,
    localPlayerX?: number,
    localPlayerY?: number
  ): void {
    const activeIds = new Set(Object.keys(obstacles));

    for (const [id, vis] of Array.from(this.obstacleVisuals.entries())) {
      const live = obstacles[id];
      const stale =
        !live ||
        live.x !== vis.x ||
        live.y !== vis.y ||
        vis.theme !== this.theme;
      if (stale) {
        this.destroyObstacleVisual(vis);
        this.obstacleVisuals.delete(id);
      }
    }

    for (const [id, obs] of Object.entries(obstacles)) {
      if (!activeIds.has(id)) continue;
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
        vis.canopyGfx.alpha =
          dSq < 78 * 78 ? vis.canopyBaseAlpha * 0.45 : vis.canopyBaseAlpha;
      }
    }
  }

  private destroyObstacleVisual(vis: ObstacleVisual): void {
    this.obstacleContainer.removeChild(vis.baseGfx, vis.hpGfx);
    vis.baseGfx.destroy();
    vis.hpGfx.destroy();
    if (vis.canopyGfx) {
      this.canopyContainer.removeChild(vis.canopyGfx);
      vis.canopyGfx.destroy();
    }
  }

  private createObstacleVisual(obs: ObstacleState): ObstacleVisual {
    const theme = this.theme;
    const baseGfx = new Graphics();
    const hpGfx = new Graphics();
    baseGfx.position.set(obs.x, obs.y);
    hpGfx.position.set(obs.x, obs.y);

    const rand = mulberry32(
      Math.floor(obs.x * 31 + obs.y * 17 + obs.radius * 7)
    );

    let canopyGfx: Graphics | undefined;
    let canopyBaseAlpha = 0.94;

    // Sombra común
    baseGfx
      .ellipse(4, obs.radius * 0.5, obs.radius * 1.05, obs.radius * 0.8)
      .fill({ color: 0x000000, alpha: theme === "arctic" ? 0.16 : 0.28 });

    if (obs.type === "rock") {
      this.drawMineral(baseGfx, obs, theme, rand);
    } else if (obs.type === "crate") {
      this.drawSupplyContainer(baseGfx, obs, theme);
      this.drawCrateHp(hpGfx, obs);
    } else if (obs.type === "tree") {
      const flora = this.drawFlora(baseGfx, obs, theme, rand);
      canopyGfx = flora.canopy;
      canopyBaseAlpha = flora.alpha;
      if (canopyGfx) {
        canopyGfx.position.set(obs.x, obs.y);
        canopyGfx.alpha = canopyBaseAlpha;
        this.canopyContainer.addChild(canopyGfx);
      }
    }

    this.obstacleContainer.addChild(baseGfx, hpGfx);

    return {
      id: obs.id,
      type: obs.type,
      theme,
      baseGfx,
      hpGfx,
      canopyGfx,
      canopyBaseAlpha,
      x: obs.x,
      y: obs.y,
      radius: obs.radius,
      lastHp: obs.hp,
    };
  }

  private drawMineral(
    g: Graphics,
    obs: ObstacleState,
    theme: ArenaTheme,
    rand: () => number
  ): void {
    const r = obs.radius;

    if (theme === "cyber_outpost") {
      // Pilón hexagonal con núcleo energético
      g.poly(polygon(0, 0, r, 6, Math.PI / 6)).fill({ color: 0x2b3f55 });
      g.poly(polygon(0, 0, r * 0.72, 6, Math.PI / 6)).fill({ color: 0x38536f });
      g.poly(polygon(0, 0, r * 0.45, 6, Math.PI / 6)).fill({ color: 0x1b2a3b });
      g.circle(0, 0, r * 0.55).fill({ color: 0x22d3ee, alpha: 0.16 });
      g.circle(0, 0, r * 0.22).fill({ color: 0x67e8f9 });
      g.poly(polygon(0, 0, r, 6, Math.PI / 6)).stroke({
        width: 4,
        color: 0x0b1220,
      });
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
        g.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45)
          .lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9)
          .stroke({ width: 1.5, color: 0x22d3ee, alpha: 0.5 });
      }
      return;
    }

    if (theme === "midnight") {
      // Racimo de cristales violeta
      g.circle(0, 0, r * 1.05).fill({ color: 0x8b5cf6, alpha: 0.12 });
      const shards = 6;
      for (let i = 0; i < shards; i++) {
        const a = (i / shards) * Math.PI * 2 + rand() * 0.4;
        const len = r * (0.75 + rand() * 0.35);
        const wid = r * 0.34;
        const tipX = Math.cos(a) * len;
        const tipY = Math.sin(a) * len;
        const nx = -Math.sin(a) * wid;
        const ny = Math.cos(a) * wid;
        g.poly([
          nx * 0.6,
          ny * 0.6,
          tipX,
          tipY,
          -nx * 0.6,
          -ny * 0.6,
          0,
          0,
        ]).fill({ color: i % 2 === 0 ? 0x5b4b9e : 0x7c6bd0 });
        g.poly([
          nx * 0.6,
          ny * 0.6,
          tipX,
          tipY,
          -nx * 0.6,
          -ny * 0.6,
        ]).stroke({ width: 2.5, color: 0x1e1b4b });
      }
      g.circle(0, 0, r * 0.3).fill({ color: 0xc4b5fd, alpha: 0.9 });
      return;
    }

    if (theme === "arctic") {
      // Bloque de hielo facetado
      const pts = polygon(0, 0, r, 7, rand() * 1, rand, 0.12);
      g.poly(pts).fill({ color: 0xa9d6ee });
      for (let i = 0; i < 7; i++) {
        const j = (i + 1) % 7;
        g.poly([0, 0, pts[i * 2], pts[i * 2 + 1], pts[j * 2], pts[j * 2 + 1]]).fill({
          color: i % 3 === 0 ? 0xe0f4ff : i % 3 === 1 ? 0xbfe3f2 : 0x7fb2cf,
          alpha: 0.85,
        });
      }
      g.poly(pts).stroke({ width: 4, color: 0x3c6a85 });
      g.circle(-r * 0.25, -r * 0.3, r * 0.14).fill({
        color: 0xffffff,
        alpha: 0.8,
      });
      return;
    }

    // desert: mesa de arenisca por capas
    g.circle(0, 0, r).fill({ color: 0xb5733a });
    g.ellipse(-2, -3, r * 0.85, r * 0.78).fill({ color: 0xc98a4b });
    g.ellipse(-4, -6, r * 0.55, r * 0.5).fill({ color: 0xd9a05e });
    for (let i = 1; i <= 3; i++) {
      g.moveTo(-r * 0.8, -r * 0.35 + i * (r * 0.32))
        .quadraticCurveTo(0, -r * 0.2 + i * (r * 0.32), r * 0.8, -r * 0.4 + i * (r * 0.32))
        .stroke({ width: 1.8, color: 0x8b5a2b, alpha: 0.6 });
    }
    g.circle(0, 0, r).stroke({ width: 4, color: 0x5a3416 });
  }

  private drawFlora(
    g: Graphics,
    obs: ObstacleState,
    theme: ArenaTheme,
    rand: () => number
  ): { canopy?: Graphics; alpha: number } {
    const r = obs.radius;

    if (theme === "cyber_outpost") {
      // Torre de antena con cúpula holográfica
      g.poly(polygon(0, 0, r, 6, 0)).fill({ color: 0x1e2f42 });
      g.circle(0, 0, r * 0.55).fill({ color: 0x0f172a });
      g.circle(0, 0, r * 0.22).fill({ color: 0x22d3ee });
      g.poly(polygon(0, 0, r, 6, 0)).stroke({ width: 3.5, color: 0x0b1220 });

      const canopy = new Graphics();
      canopy.poly(polygon(0, 0, 50, 6, Math.PI / 6)).fill({
        color: 0x22d3ee,
        alpha: 0.16,
      });
      canopy.poly(polygon(0, 0, 50, 6, Math.PI / 6)).stroke({
        width: 2.5,
        color: 0x22d3ee,
        alpha: 0.85,
      });
      canopy.poly(polygon(0, 0, 32, 6, Math.PI / 6)).stroke({
        width: 1.8,
        color: 0x67e8f9,
        alpha: 0.6,
      });
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
        canopy
          .moveTo(Math.cos(a) * 14, Math.sin(a) * 14)
          .lineTo(Math.cos(a) * 50, Math.sin(a) * 50)
          .stroke({ width: 1.4, color: 0x22d3ee, alpha: 0.5 });
      }
      return { canopy, alpha: 0.85 };
    }

    if (theme === "midnight") {
      // Árbol retorcido con hongos luminosos
      g.circle(0, 0, r).fill({ color: 0x2a1f3d });
      g.circle(-2, -2, r * 0.58).fill({ color: 0x3b2d56 });
      g.circle(0, 0, r).stroke({ width: 3.5, color: 0x0f0a1f });

      const canopy = new Graphics();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        canopy
          .circle(Math.cos(a) * 24, Math.sin(a) * 24, 26)
          .fill({ color: 0x123340 });
      }
      canopy.circle(0, 0, 40).fill({ color: 0x1a4a55 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        canopy.circle(Math.cos(a) * 20, Math.sin(a) * 20, 18).fill({
          color: 0x1f5a63,
        });
      }
      for (let i = 0; i < 8; i++) {
        const a = rand() * Math.PI * 2;
        const d = 8 + rand() * 38;
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        canopy.circle(x, y, 5.5).fill({ color: 0x5eead4, alpha: 0.2 });
        canopy.circle(x, y, 2.4).fill({ color: 0x99f6e4, alpha: 0.95 });
      }
      return { canopy, alpha: 0.9 };
    }

    if (theme === "arctic") {
      // Pino nevado
      g.circle(0, 0, r).fill({ color: 0x6b4a2b });
      g.circle(-2, -2, r * 0.5).fill({ color: 0x86603a });
      g.circle(0, 0, r).stroke({ width: 3.5, color: 0x2a1b0e });

      const canopy = new Graphics();
      canopy.poly(polygon(0, 0, 52, 10, 0)).fill({ color: 0x2f6f5a });
      canopy.poly(polygon(0, 0, 40, 10, Math.PI / 10)).fill({ color: 0x3b8a70 });
      canopy.poly(polygon(0, 0, 28, 10, 0)).fill({ color: 0x4ba07f });
      canopy.circle(0, 0, 22).fill({ color: 0xf1f8fc, alpha: 0.95 });
      canopy.circle(-5, -5, 11).fill({ color: 0xffffff });
      canopy.poly(polygon(0, 0, 52, 10, 0)).stroke({
        width: 2.5,
        color: 0x1d4a3b,
        alpha: 0.9,
      });
      return { canopy, alpha: 0.93 };
    }

    // desert: cactus (sin copa; no oculta a los jugadores)
    g.circle(0, 0, r).fill({ color: 0x4f9a52 });
    for (let i = -2; i <= 2; i++) {
      g.moveTo(i * 6, -r + 3).lineTo(i * 6, r - 3).stroke({
        width: 1.8,
        color: 0x3b7a3f,
        alpha: 0.9,
      });
    }
    g.circle(-r * 0.95, -4, 9).fill({ color: 0x4f9a52 });
    g.circle(r * 0.9, 5, 9).fill({ color: 0x4f9a52 });
    g.circle(-r * 0.95, -4, 9).stroke({ width: 2.5, color: 0x24502a });
    g.circle(r * 0.9, 5, 9).stroke({ width: 2.5, color: 0x24502a });
    g.circle(0, 0, r).stroke({ width: 3.5, color: 0x24502a });
    g.circle(0, 0, 6).fill({ color: 0xf472b6 });
    return { canopy: undefined, alpha: 1 };
  }

  private drawSupplyContainer(
    g: Graphics,
    obs: ObstacleState,
    theme: ArenaTheme
  ): void {
    const r = obs.radius;
    const p = CRATE_PALETTE[theme];

    g.roundRect(-r, -r, r * 2, r * 2, 6).fill({ color: p.body });
    g.roundRect(-r + 6, -r + 6, (r - 6) * 2, (r - 6) * 2, 4).fill({
      color: p.panel,
    });

    // Franja de advertencia diagonal en la parte inferior
    const bandTop = r - 14;
    const bandBot = r - 5;
    const step = 9;
    for (let x = -r + 5; x < r - 12; x += step * 2) {
      g.poly([
        x,
        bandBot,
        x + step,
        bandBot,
        x + step + 5,
        bandTop,
        x + 5,
        bandTop,
      ]).fill({ color: p.stripe, alpha: 0.95 });
    }

    // Esquineros
    const c = 9;
    const o = r - 3;
    const corner = (sx: number, sy: number) => {
      g.moveTo(sx * o, sy * (o - c))
        .lineTo(sx * o, sy * o)
        .lineTo(sx * (o - c), sy * o)
        .stroke({ width: 3, color: p.accent, alpha: 0.95 });
    };
    corner(-1, -1);
    corner(1, -1);
    corner(-1, 1);
    corner(1, 1);

    // Placa de cierre
    g.roundRect(-7, -9, 14, 11, 3).fill({ color: p.accent });
    g.circle(0, -4, 2).fill({ color: p.edge });

    g.roundRect(-r, -r, r * 2, r * 2, 6).stroke({ width: 4, color: p.edge });
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

  /* ------------------------------ Botín ----------------------------- */

  /**
   * Sincroniza el botín del suelo. Devuelve el botín más cercano dentro del
   * radio de recogida (para mostrar el aviso "E").
   */
  public syncLoot(
    lootItems: Record<string, LootItemState>,
    dtSeconds: number,
    playerX?: number,
    playerY?: number,
    playerAlive = true
  ): LootItemState | null {
    this.animTime += dtSeconds;
    const activeIds = new Set(Object.keys(lootItems));

    for (const [id, vis] of Array.from(this.lootVisuals.entries())) {
      if (!activeIds.has(id)) {
        this.lootContainer.removeChild(vis.root);
        vis.root.destroy({ children: true });
        this.lootVisuals.delete(id);
      }
    }

    let nearest: LootItemState | null = null;
    let nearestDistSq = LOOT_PICKUP_RADIUS * LOOT_PICKUP_RADIUS;

    if (playerAlive && playerX !== undefined && playerY !== undefined) {
      for (const item of Object.values(lootItems)) {
        const dSq = (playerX - item.x) ** 2 + (playerY - item.y) ** 2;
        if (dSq <= nearestDistSq) {
          nearestDistSq = dSq;
          nearest = item;
        }
      }
    }

    for (const [id, item] of Object.entries(lootItems)) {
      let vis = this.lootVisuals.get(id);
      if (!vis) {
        vis = this.createLootVisual(item);
        this.lootVisuals.set(id, vis);
        this.lootContainer.addChild(vis.root);
      }

      const bob = Math.sin(this.animTime * 3.6 + vis.phase) * 3;
      vis.root.position.set(vis.baseX, vis.baseY + bob);
      vis.gfx.rotation = Math.sin(this.animTime * 1.4 + vis.phase) * 0.06;

      const isNearest = nearest !== null && nearest.id === id;
      vis.prompt.visible = isNearest;
      vis.ring.visible = isNearest;
      if (isNearest) {
        const pulse = 1 + Math.sin(this.animTime * 8) * 0.07;
        vis.ring.scale.set(pulse);
        vis.prompt.scale.set(pulse);
      }
    }

    return nearest;
  }

  private createLootVisual(item: LootItemState): LootVisual {
    const root = new Container();
    const gfx = new Graphics();
    const ring = new Graphics();

    let labelText = "BOTIQUÍN";
    let accent = 0x4ade80;

    if (item.kind === "medkit") {
      gfx.circle(0, 0, 25).fill({ color: 0x22c55e, alpha: 0.2 });
      gfx.roundRect(-18, -11, 36, 22, 11).fill({ color: 0xf8fafc });
      gfx.roundRect(-18, -11, 36, 22, 11).stroke({ width: 3, color: 0x14532d });
      gfx.rect(-3, -7, 6, 14).fill({ color: 0x16a34a });
      gfx.rect(-7, -3, 14, 6).fill({ color: 0x16a34a });
    } else {
      const wType: WeaponType = item.weaponType || "rifle";
      const meta = WEAPON_META[wType];
      accent = meta.badgeColor;
      labelText = meta.label.toUpperCase();

      gfx.poly(polygon(0, 0, 27, 6, 0)).fill({ color: accent, alpha: 0.2 });
      gfx.poly(polygon(0, 0, 23, 6, 0)).fill({ color: 0x0f172a, alpha: 0.94 });
      gfx.poly(polygon(0, 0, 23, 6, 0)).stroke({ width: 3, color: accent });
      this.drawWeaponIcon(gfx, wType, accent);
    }

    ring.circle(0, 0, 33).stroke({ width: 2.5, color: 0xffffff, alpha: 0.9 });
    ring.circle(0, 0, 38).stroke({ width: 1.5, color: accent, alpha: 0.7 });
    ring.visible = false;

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
    label.position.set(0, 30);

    // Aviso de tecla "E"
    const prompt = new Container();
    const keyBg = new Graphics();
    keyBg.roundRect(-11, -11, 22, 22, 6).fill({ color: 0xf8fafc });
    keyBg.roundRect(-11, -11, 22, 22, 6).stroke({ width: 2.5, color: 0x0f172a });
    keyBg.roundRect(-11, 8, 22, 4, 2).fill({ color: 0xcbd5e1 });
    const keyText = new Text({
      text: "E",
      style: {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 14,
        fontWeight: "900",
        fill: "#0f172a",
      },
    });
    keyText.anchor.set(0.5);
    keyText.position.set(0, -1);
    prompt.addChild(keyBg, keyText);
    prompt.position.set(0, -44);
    prompt.visible = false;

    root.addChild(ring, gfx, label, prompt);
    root.position.set(item.x, item.y);

    return {
      root,
      gfx,
      label,
      prompt,
      ring,
      baseX: item.x,
      baseY: item.y,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private drawWeaponIcon(g: Graphics, weapon: WeaponType, color: number): void {
    switch (weapon) {
      case "smg":
        g.roundRect(-13, -3, 22, 6, 2).fill({ color });
        g.rect(-3, 2, 5, 9).fill({ color });
        g.rect(-8, 2, 4, 6).fill({ color, alpha: 0.8 });
        break;
      case "shotgun":
        g.roundRect(-14, -4, 28, 4, 1.5).fill({ color });
        g.roundRect(-14, 1, 28, 4, 1.5).fill({ color });
        g.rect(-14, -5, 7, 11).fill({ color: 0xf8fafc, alpha: 0.85 });
        break;
      case "rifle":
        g.roundRect(-15, -2.5, 30, 5, 2).fill({ color });
        g.rect(-4, 2, 6, 8).fill({ color });
        g.rect(4, -6, 8, 3).fill({ color: 0xf8fafc, alpha: 0.85 });
        break;
      case "burst":
        g.roundRect(-14, -6, 28, 3.5, 1.5).fill({ color });
        g.roundRect(-14, -1.8, 28, 3.5, 1.5).fill({ color });
        g.roundRect(-14, 2.4, 28, 3.5, 1.5).fill({ color });
        break;
      case "plasma":
        g.circle(-4, 0, 8).fill({ color });
        g.circle(-4, 0, 4).fill({ color: 0xffffff });
        g.roundRect(2, -3, 12, 6, 2).fill({ color });
        break;
      case "sniper":
        g.roundRect(-16, -2, 32, 4, 1.5).fill({ color });
        g.circle(0, -6, 4).stroke({ width: 2, color: 0xf8fafc });
        g.rect(-8, 2, 5, 8).fill({ color });
        break;
      default:
        g.roundRect(-8, -3, 16, 6, 2).fill({ color });
        g.rect(-6, 2, 5, 8).fill({ color });
        break;
    }
  }

  public reset(): void {
    for (const vis of this.obstacleVisuals.values()) {
      this.destroyObstacleVisual(vis);
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
    this.renderedTheme = null;
  }
}
