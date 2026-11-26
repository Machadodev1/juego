import { Container, Graphics } from "pixi.js";
import type { BulletState, WeaponType } from "@shared/types";
import { lerp } from "./Interpolation";

interface BulletVisual {
  gfx: Graphics;
  x: number;
  y: number;
  weaponType: WeaponType;
  trail: Array<{ x: number; y: number }>;
}

const BULLET_STYLE: Record<
  WeaponType,
  { color: number; core: number; radius: number; trailLen: number }
> = {
  pistol: { color: 0xfef08a, core: 0xffffff, radius: 4.5, trailLen: 6 },
  smg: { color: 0xfacc15, core: 0xfffbeb, radius: 3.5, trailLen: 5 },
  shotgun: { color: 0xfb923c, core: 0xffedd5, radius: 4, trailLen: 5 },
  rifle: { color: 0x38bdf8, core: 0xe0f2fe, radius: 4.5, trailLen: 8 },
  burst: { color: 0x2dd4bf, core: 0xccfbf1, radius: 4, trailLen: 9 },
  plasma: { color: 0xf472b6, core: 0xfdf2f8, radius: 8, trailLen: 10 },
  sniper: { color: 0xc084fc, core: 0xf3e8ff, radius: 5.5, trailLen: 13 },
};

export class BulletRenderer {
  public readonly container = new Container();
  private visuals = new Map<string, BulletVisual>();

  public sync(bullets: Record<string, BulletState>, dtSeconds: number): void {
    const activeIds = new Set(Object.keys(bullets));

    for (const [id, visual] of Array.from(this.visuals.entries())) {
      if (!activeIds.has(id)) {
        this.container.removeChild(visual.gfx);
        visual.gfx.destroy();
        this.visuals.delete(id);
      }
    }

    for (const [id, bullet] of Object.entries(bullets)) {
      const style = BULLET_STYLE[bullet.weaponType] || BULLET_STYLE.pistol;
      let visual = this.visuals.get(id);

      if (!visual) {
        const gfx = new Graphics();
        visual = {
          gfx,
          x: bullet.x,
          y: bullet.y,
          weaponType: bullet.weaponType,
          trail: [{ x: bullet.x, y: bullet.y }],
        };
        this.visuals.set(id, visual);
        this.container.addChild(gfx);
      } else {
        const predictedX = visual.x + bullet.vx * dtSeconds;
        const predictedY = visual.y + bullet.vy * dtSeconds;

        const distSq = (bullet.x - visual.x) ** 2 + (bullet.y - visual.y) ** 2;
        if (distSq > 140 * 140) {
          visual.x = bullet.x;
          visual.y = bullet.y;
          visual.trail = [{ x: bullet.x, y: bullet.y }];
        } else {
          visual.x = lerp(predictedX, bullet.x, 0.5);
          visual.y = lerp(predictedY, bullet.y, 0.5);
          visual.trail.push({ x: visual.x, y: visual.y });
          if (visual.trail.length > style.trailLen) {
            visual.trail.shift();
          }
        }
      }

      this.drawBullet(visual, style);
    }
  }

  private drawBullet(
    visual: BulletVisual,
    style: { color: number; core: number; radius: number; trailLen: number }
  ): void {
    const { gfx, x, y, trail } = visual;
    gfx.clear();

    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const progress = i / trail.length;
      gfx
        .moveTo(p0.x, p0.y)
        .lineTo(p1.x, p1.y)
        .stroke({
          width: 1.5 + progress * style.radius * 0.8,
          color: style.color,
          alpha: progress * 0.55,
          cap: "round",
        });
    }

    gfx.circle(x, y, style.radius + 4).fill({ color: style.color, alpha: 0.28 });
    gfx.circle(x, y, style.radius).fill({ color: style.core, alpha: 1 });
    gfx
      .circle(x, y, style.radius)
      .stroke({ width: 1.5, color: style.color, alpha: 0.95 });
  }

  public clear(): void {
    for (const visual of this.visuals.values()) {
      this.container.removeChild(visual.gfx);
      visual.gfx.destroy();
    }
    this.visuals.clear();
  }
}
