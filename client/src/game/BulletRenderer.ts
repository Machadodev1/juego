import { Container, Graphics } from "pixi.js";
import type { BulletState, WeaponType } from "@shared/types";

interface BulletVisual {
  x: number;
  y: number;
  vx: number;
  vy: number;
  weaponType: WeaponType;
  scale: number;
  isHoming: boolean;
  isBoomerang: boolean;
  spin: number;
  trail: Array<{ x: number; y: number }>;
}

const BULLET_STYLE: Record<
  WeaponType,
  { radius: number; core: number; glow: number; trailLen: number }
> = {
  pistol: { radius: 4.5, core: 0xfef08a, glow: 0xf59e0b, trailLen: 5 },
  shotgun: { radius: 4, core: 0xffedd5, glow: 0xf97316, trailLen: 4 },
  rifle: { radius: 4.5, core: 0xe0f2fe, glow: 0x38bdf8, trailLen: 6 },
  sniper: { radius: 5.5, core: 0xffffff, glow: 0xf43f5e, trailLen: 10 },
  impulse_gun: { radius: 8.5, core: 0xe0f2fe, glow: 0x22d3ee, trailLen: 7 },
  flamethrower: { radius: 7.5, core: 0xfef08a, glow: 0xf97316, trailLen: 5 },
  saw_disc: { radius: 11, core: 0xe2e8f0, glow: 0xfacc15, trailLen: 7 },
  bee_cannon: { radius: 6, core: 0xfacc15, glow: 0xca8a04, trailLen: 6 },
  grappling_hook: { radius: 6.5, core: 0xe9d5ff, glow: 0xa855f7, trailLen: 9 },
};

export class BulletRenderer {
  public readonly container = new Container();
  private gfx = new Graphics();
  private visuals = new Map<string, BulletVisual>();

  constructor() {
    this.container.addChild(this.gfx);
  }

  public sync(
    bullets: Record<string, BulletState>,
    dtSeconds: number,
    players?: Record<string, { x: number; y: number }>
  ): void {
    const activeIds = new Set(Object.keys(bullets));

    for (const existingId of this.visuals.keys()) {
      if (!activeIds.has(existingId)) {
        this.visuals.delete(existingId);
      }
    }

    this.gfx.clear();

    for (const [id, b] of Object.entries(bullets)) {
      const style = BULLET_STYLE[b.weaponType] || BULLET_STYLE.pistol;
      let vis = this.visuals.get(id);

      if (!vis) {
        vis = {
          x: b.x,
          y: b.y,
          vx: b.vx,
          vy: b.vy,
          weaponType: b.weaponType,
          scale: b.scale || 1,
          isHoming: b.isHoming,
          isBoomerang: b.isBoomerang,
          spin: 0,
          trail: [{ x: b.x, y: b.y }],
        };
        this.visuals.set(id, vis);
      } else {
        const predX = vis.x + b.vx * dtSeconds;
        const predY = vis.y + b.vy * dtSeconds;
        vis.x = predX + (b.x - predX) * 0.48;
        vis.y = predY + (b.y - predY) * 0.48;
        vis.vx = b.vx;
        vis.vy = b.vy;
        vis.scale = b.scale || 1;
        vis.spin += dtSeconds * 18;
        vis.trail.push({ x: vis.x, y: vis.y });
        if (vis.trail.length > style.trailLen) {
          vis.trail.shift();
        }
      }

      const effRadius = style.radius * vis.scale;

      // Cable para el gancho arpeo
      if (b.weaponType === "grappling_hook" && players?.[b.ownerId]) {
        const owner = players[b.ownerId];
        this.gfx
          .moveTo(owner.x, owner.y)
          .lineTo(vis.x, vis.y)
          .stroke({ width: 2.5, color: 0xc084fc, alpha: 0.78 });
      }

      // Estela del proyectil
      for (let i = 0; i < vis.trail.length - 1; i++) {
        const pt = vis.trail[i];
        const ratio = (i + 1) / vis.trail.length;
        this.gfx
          .circle(pt.x, pt.y, effRadius * 0.62 * ratio)
          .fill({ color: style.glow, alpha: 0.34 * ratio });
      }

      // Renderizado especializado por arma
      if (b.weaponType === "saw_disc") {
        this.gfx
          .circle(vis.x, vis.y, effRadius * 1.35)
          .fill({ color: 0xfacc15, alpha: 0.25 });
        const teeth = 8;
        const pts: number[] = [];
        for (let t = 0; t < teeth * 2; t++) {
          const ang = vis.spin + (t * Math.PI) / teeth;
          const r = t % 2 === 0 ? effRadius * 1.18 : effRadius * 0.78;
          pts.push(vis.x + Math.cos(ang) * r, vis.y + Math.sin(ang) * r);
        }
        this.gfx.poly(pts, true).fill({ color: 0xf8fafc });
        this.gfx.poly(pts, true).stroke({ width: 1.5, color: 0x475569 });
        this.gfx.circle(vis.x, vis.y, effRadius * 0.32).fill({ color: 0xef4444 });
      } else if (b.weaponType === "bee_cannon") {
        const ang = Math.atan2(vis.vy, vis.vx);
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        this.gfx
          .circle(vis.x, vis.y, effRadius * 1.4)
          .fill({ color: 0xfef08a, alpha: 0.35 });
        this.gfx.circle(vis.x, vis.y, effRadius).fill({ color: 0xfacc15 });
        this.gfx
          .circle(vis.x, vis.y, effRadius)
          .stroke({ width: 2, color: 0x1e293b });
        // Franja negra de abeja y alitas
        this.gfx
          .moveTo(vis.x - sin * effRadius * 0.8, vis.y + cos * effRadius * 0.8)
          .lineTo(vis.x + sin * effRadius * 0.8, vis.y - cos * effRadius * 0.8)
          .stroke({ width: 2.2, color: 0x0f172a });
      } else {
        this.gfx
          .circle(vis.x, vis.y, effRadius * 1.6)
          .fill({ color: style.glow, alpha: 0.32 });
        this.gfx.circle(vis.x, vis.y, effRadius).fill({ color: style.core });
        if (vis.scale > 1.5) {
          this.gfx
            .circle(vis.x, vis.y, effRadius)
            .stroke({ width: 2.5, color: style.glow, alpha: 0.9 });
        }
      }
    }
  }

  public clear(): void {
    this.visuals.clear();
    this.gfx.clear();
  }
}
