import { Container, Graphics } from "pixi.js";
import type { BulletHitEvent } from "@shared/types";
import { hexToNumber } from "./Interpolation";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: number;
}

export class EffectsManager {
  public readonly container = new Container();
  private gfx = new Graphics();
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeIntensity = 0;

  constructor() {
    this.container.addChild(this.gfx);
  }

  public spawnBulletHit(
    x: number,
    y: number,
    targetType: BulletHitEvent["targetType"]
  ): void {
    const count = targetType === "player" ? 12 : 9;
    const palette =
      targetType === "player"
        ? [0xef4444, 0xf97316, 0xfef08a]
        : targetType === "crate"
        ? [0xd97706, 0xb45309, 0xfef08a]
        : [0xe2e8f0, 0x94a3b8, 0xfef08a];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      const maxLife = 0.16 + Math.random() * 0.15;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife,
        size: 2 + Math.random() * 2,
        color: palette[i % palette.length],
      });
    }
  }

  public spawnCrateDebris(x: number, y: number): void {
    const palette = [0xb45309, 0xd97706, 0x78350f, 0xfbbf24];
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 190;
      const maxLife = 0.25 + Math.random() * 0.28;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife,
        size: 3 + Math.random() * 3.5,
        color: palette[i % palette.length],
      });
    }
    this.shockwaves.push({
      x,
      y,
      radius: 8,
      maxRadius: 46,
      life: 0.26,
      maxLife: 0.26,
      color: 0xfbbf24,
    });
    this.triggerShake(4.5, 0.18);
  }

  public spawnMuzzleFlash(
    x: number,
    y: number,
    angle: number,
    hexColor = "#FEF08A"
  ): void {
    const color = hexToNumber(hexColor, 0xfef08a);
    for (let i = 0; i < 5; i++) {
      const spread = (Math.random() - 0.5) * 0.65;
      const speed = 90 + Math.random() * 100;
      const maxLife = 0.08 + Math.random() * 0.07;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        life: maxLife,
        maxLife,
        size: 2 + Math.random() * 1.5,
        color: i % 2 === 0 ? 0xffffff : color,
      });
    }
  }

  public spawnExplosion(x: number, y: number, hexColor = "#EF4444"): void {
    const baseColor = hexToNumber(hexColor, 0xef4444);
    const palette = [baseColor, 0xf97316, 0xfacc15, 0xffffff];

    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 240;
      const maxLife = 0.3 + Math.random() * 0.32;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife,
        size: 2.5 + Math.random() * 3.5,
        color: palette[i % palette.length],
      });
    }

    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius: 62,
      life: 0.34,
      maxLife: 0.34,
      color: baseColor,
    });

    this.triggerShake(8, 0.28);
  }

  public triggerShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  public update(
    dtSeconds: number,
    worldContainer: Container,
    baseX: number,
    baseY: number
  ): void {
    this.gfx.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dtSeconds;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.vx *= 0.93;
      p.vy *= 0.93;

      const alpha = Math.max(0, p.life / p.maxLife);
      this.gfx.circle(p.x, p.y, p.size * (0.5 + alpha * 0.5)).fill({
        color: p.color,
        alpha,
      });
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dtSeconds;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const progress = 1 - sw.life / sw.maxLife;
      const radius = sw.radius + (sw.maxRadius - sw.radius) * progress;
      const alpha = (1 - progress) * 0.85;
      this.gfx.circle(sw.x, sw.y, radius).stroke({
        width: 3 * (1 - progress) + 1,
        color: sw.color,
        alpha,
      });
    }

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dtSeconds);
      const decay =
        this.shakeDuration > 0 ? this.shakeTime / this.shakeDuration : 0;
      const mag = this.shakeIntensity * decay;
      const ox = (Math.random() * 2 - 1) * mag;
      const oy = (Math.random() * 2 - 1) * mag;
      worldContainer.position.set(baseX + ox, baseY + oy);
      if (this.shakeTime === 0) {
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
      }
    } else {
      worldContainer.position.set(baseX, baseY);
    }
  }

  public clear(): void {
    this.particles = [];
    this.shockwaves = [];
    this.shakeTime = 0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.gfx.clear();
  }
}
