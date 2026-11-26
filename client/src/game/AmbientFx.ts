import { Container, Graphics } from "pixi.js";
import type { ArenaTheme } from "@shared/types";

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  speed: number;
}

const MOTE_COUNT: Record<ArenaTheme, number> = {
  cyber_outpost: 34,
  midnight: 30,
  arctic: 90,
  desert: 46,
};

/**
 * Capa en espacio de pantalla: partículas ambientales por tema y, en el mapa
 * nocturno, una oscuridad con un halo de luz alrededor del jugador local.
 */
export class AmbientFx {
  public readonly container = new Container();

  private particlesGfx = new Graphics();
  private tintGfx = new Graphics();
  private nightGfx = new Graphics();

  private motes: Mote[] = [];
  private theme: ArenaTheme | null = null;
  private time = 0;
  private viewW = 0;
  private viewH = 0;

  constructor() {
    this.container.addChild(this.tintGfx, this.nightGfx, this.particlesGfx);
    this.nightGfx.visible = false;
  }

  public setTheme(theme: ArenaTheme, viewW: number, viewH: number): void {
    if (this.theme === theme && this.viewW === viewW && this.viewH === viewH) {
      return;
    }

    const themeChanged = this.theme !== theme;
    this.theme = theme;
    this.viewW = viewW;
    this.viewH = viewH;

    if (themeChanged) {
      this.motes = [];
      for (let i = 0; i < MOTE_COUNT[theme]; i++) {
        this.motes.push(this.newMote(true));
      }
      this.buildNightOverlay(theme === "midnight");
    }

    // Tintes suaves por tema
    this.tintGfx.clear();
    if (theme === "desert") {
      this.tintGfx
        .rect(0, 0, viewW, viewH)
        .fill({ color: 0xff9a3c, alpha: 0.07 });
    } else if (theme === "arctic") {
      this.tintGfx
        .rect(0, 0, viewW, viewH)
        .fill({ color: 0xbfe6ff, alpha: 0.06 });
    }
  }

  private newMote(randomY: boolean): Mote {
    const theme = this.theme;
    const x = Math.random() * this.viewW;
    const y = randomY ? Math.random() * this.viewH : -10;
    switch (theme) {
      case "arctic":
        return {
          x,
          y,
          vx: -12 + Math.random() * 10,
          vy: 38 + Math.random() * 46,
          size: 1.4 + Math.random() * 2.4,
          phase: Math.random() * Math.PI * 2,
          speed: 0.8 + Math.random() * 1.4,
        };
      case "desert":
        return {
          x: randomY ? x : -20,
          y: Math.random() * this.viewH,
          vx: 70 + Math.random() * 90,
          vy: 6 + Math.random() * 12,
          size: 1.2 + Math.random() * 1.8,
          phase: Math.random() * Math.PI * 2,
          speed: 1 + Math.random(),
        };
      case "midnight":
        return {
          x,
          y: Math.random() * this.viewH,
          vx: (Math.random() - 0.5) * 24,
          vy: (Math.random() - 0.5) * 24,
          size: 1.6 + Math.random() * 1.6,
          phase: Math.random() * Math.PI * 2,
          speed: 1.2 + Math.random() * 1.8,
        };
      default:
        return {
          x,
          y: randomY ? y : this.viewH + 10,
          vx: (Math.random() - 0.5) * 8,
          vy: -(14 + Math.random() * 26),
          size: 1.6 + Math.random() * 2,
          phase: Math.random() * Math.PI * 2,
          speed: 1 + Math.random(),
        };
    }
  }

  private buildNightOverlay(enabled: boolean): void {
    const g = this.nightGfx;
    g.clear();
    g.visible = enabled;
    if (!enabled) return;

    // Anillos concéntricos centrados en (0,0); se reposicionan sobre el jugador
    const innerR = 190;
    const outerR = 640;
    const step = 20;
    const maxAlpha = 0.76;
    const color = 0x040814;

    for (let r = innerR; r < outerR; r += step) {
      const t = (r - innerR) / (outerR - innerR);
      const eased = t * t * (3 - 2 * t);
      g.circle(0, 0, r + step / 2).stroke({
        width: step + 0.8,
        color,
        alpha: maxAlpha * eased,
      });
    }
    g.circle(0, 0, outerR + 1500).stroke({
      width: 3000,
      color,
      alpha: maxAlpha,
    });
  }

  /**
   * @param focusX/focusY posición en pantalla del jugador local (centro de la luz)
   */
  public update(
    dtSeconds: number,
    focusX: number,
    focusY: number
  ): void {
    if (!this.theme) return;
    this.time += dtSeconds;

    if (this.nightGfx.visible) {
      this.nightGfx.position.set(focusX, focusY);
    }

    const g = this.particlesGfx;
    g.clear();

    for (const m of this.motes) {
      m.x += m.vx * dtSeconds;
      m.y += m.vy * dtSeconds;

      if (this.theme === "arctic") {
        m.x += Math.sin(this.time * m.speed + m.phase) * 14 * dtSeconds;
        if (m.y > this.viewH + 8 || m.x < -20) {
          Object.assign(m, this.newMote(false));
        }
        g.circle(m.x, m.y, m.size).fill({ color: 0xffffff, alpha: 0.85 });
      } else if (this.theme === "desert") {
        if (m.x > this.viewW + 30) {
          Object.assign(m, this.newMote(false));
        }
        g.moveTo(m.x, m.y)
          .lineTo(m.x - 14 - m.size * 4, m.y - 1.2)
          .stroke({ width: m.size, color: 0xf3d9a4, alpha: 0.4 });
      } else if (this.theme === "midnight") {
        if (m.x < -10) m.x = this.viewW + 10;
        if (m.x > this.viewW + 10) m.x = -10;
        if (m.y < -10) m.y = this.viewH + 10;
        if (m.y > this.viewH + 10) m.y = -10;
        const glow = 0.35 + 0.65 * Math.abs(Math.sin(this.time * m.speed + m.phase));
        g.circle(m.x, m.y, m.size * 3.4).fill({ color: 0x5eead4, alpha: 0.12 * glow });
        g.circle(m.x, m.y, m.size).fill({ color: 0xccfbf1, alpha: 0.95 * glow });
      } else {
        if (m.y < -12) {
          Object.assign(m, this.newMote(false));
        }
        const flick = 0.4 + 0.6 * Math.abs(Math.sin(this.time * m.speed + m.phase));
        g.rect(m.x, m.y, m.size * 1.6, m.size * 1.6).fill({
          color: 0x67e8f9,
          alpha: 0.5 * flick,
        });
      }
    }
  }

  public clear(): void {
    this.particlesGfx.clear();
    this.tintGfx.clear();
    this.nightGfx.clear();
    this.motes = [];
    this.theme = null;
  }
}
