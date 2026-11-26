import { Container, Graphics } from "pixi.js";
import type { BulletState } from "@shared/types";
import { lerp } from "./Interpolation";

interface BulletVisual {
  gfx: Graphics;
  x: number;
  y: number;
  trail: Array<{ x: number; y: number }>;
}

const MAX_TRAIL_POINTS = 8;

export class BulletRenderer {
  public readonly container = new Container();
  private visuals = new Map<string, BulletVisual>();

  public sync(bullets: Record<string, BulletState>, dtSeconds: number): void {
    const activeIds = new Set(Object.keys(bullets));

    for (const [id, visual] of this.visuals.entries()) {
      if (!activeIds.has(id)) {
        this.container.removeChild(visual.gfx);
        visual.gfx.destroy();
        this.visuals.delete(id);
      }
    }

    for (const [id, bullet] of Object.entries(bullets)) {
      let visual = this.visuals.get(id);
      if (!visual) {
        const gfx = new Graphics();
        visual = {
          gfx,
          x: bullet.x,
          y: bullet.y,
          trail: [{ x: bullet.x, y: bullet.y }],
        };
        this.visuals.set(id, visual);
        this.container.addChild(gfx);
      } else {
        // Extrapolate slightly with velocity then blend toward authoritative position
        const predictedX = visual.x + bullet.vx * dtSeconds;
        const predictedY = visual.y + bullet.vy * dtSeconds;

        const distSq = (bullet.x - visual.x) ** 2 + (bullet.y - visual.y) ** 2;
        if (distSq > 90 * 90) {
          visual.x = bullet.x;
          visual.y = bullet.y;
          visual.trail = [{ x: bullet.x, y: bullet.y }];
        } else {
          visual.x = lerp(predictedX, bullet.x, 0.45);
          visual.y = lerp(predictedY, bullet.y, 0.45);
          visual.trail.push({ x: visual.x, y: visual.y });
          if (visual.trail.length > MAX_TRAIL_POINTS) {
            visual.trail.shift();
          }
        }
      }

      this.drawBullet(visual);
    }
  }

  private drawBullet(visual: BulletVisual): void {
    const { gfx, x, y, trail } = visual;
    gfx.clear();

    // Trail
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const progress = i / trail.length;
      gfx
        .moveTo(p0.x, p0.y)
        .lineTo(p1.x, p1.y)
        .stroke({
          width: 1.5 + progress * 3.5,
          color: 0x38bdf8,
          alpha: progress * 0.45,
          cap: "round",
        });
    }

    // Outer glow
    gfx.circle(x, y, 7.5).fill({ color: 0x22d3ee, alpha: 0.28 });
    // Mid halo
    gfx.circle(x, y, 4.8).fill({ color: 0x67e8f9, alpha: 0.75 });
    // White-hot core
    gfx.circle(x, y, 2.6).fill({ color: 0xffffff, alpha: 1 });
  }

  public clear(): void {
    for (const visual of this.visuals.values()) {
      this.container.removeChild(visual.gfx);
      visual.gfx.destroy();
    }
    this.visuals.clear();
  }
}
