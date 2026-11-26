import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type {
  BulletHitEvent,
  EmoteType,
  ExplosionEvent,
} from "@shared/types";
import { EMOTE_BY_ID } from "../constants";
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

interface FloatingDamage {
  textObj: Text;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface FloatingEmote {
  bubble: Container;
  playerId: string;
  fallbackX: number;
  fallbackY: number;
  life: number;
  maxLife: number;
}

const dmgCritStyle = new TextStyle({
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 19,
  fontWeight: "900",
  fill: "#fef08a",
  stroke: { color: "#7f1d1d", width: 4 },
});

const dmgNormalStyle = new TextStyle({
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 15,
  fontWeight: "900",
  fill: "#ffffff",
  stroke: { color: "#0f172a", width: 3.5 },
});

const emoteTextStyle = new TextStyle({
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 20,
  fontWeight: "900",
  fill: "#0f172a",
});

export class EffectsManager {
  public readonly container = new Container();
  private gfx = new Graphics();
  private textLayer = new Container();
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private floatingDamages: FloatingDamage[] = [];
  private floatingEmotes: FloatingEmote[] = [];

  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeIntensity = 0;

  constructor() {
    this.container.addChild(this.gfx, this.textLayer);
  }

  public spawnBulletHit(
    x: number,
    y: number,
    targetType: BulletHitEvent["targetType"],
    damage?: number
  ): void {
    const count =
      targetType === "shield" ? 14 : targetType === "player" ? 11 : 8;
    const palette =
      targetType === "shield"
        ? [0x38bdf8, 0xbae6fd, 0xffffff]
        : targetType === "player"
        ? [0xef4444, 0xf97316, 0xfef08a]
        : targetType === "crate"
        ? [0xd97706, 0xfbbf24, 0xfef08a]
        : [0xe2e8f0, 0x94a3b8, 0xfef08a];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 65 + Math.random() * 150;
      const maxLife = 0.16 + Math.random() * 0.14;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife,
        size: 2.2 + Math.random() * 2,
        color: palette[i % palette.length],
      });
    }

    if (targetType === "shield") {
      this.shockwaves.push({
        x,
        y,
        radius: 6,
        maxRadius: 34,
        life: 0.18,
        maxLife: 0.18,
        color: 0x38bdf8,
      });
    }

    if (damage && damage > 0 && targetType === "player") {
      this.spawnFloatingDamage(x, y - 18, damage);
    }
  }

  public spawnFloatingDamage(x: number, y: number, damage: number): void {
    const isBig = damage >= 35;
    const label = isBig ? `-${damage}!` : `-${damage}`;
    const txt = new Text({
      text: label,
      style: isBig ? dmgCritStyle : dmgNormalStyle,
    });
    txt.anchor.set(0.5);
    const jitterX = (Math.random() - 0.5) * 20;
    txt.position.set(x + jitterX, y);
    this.textLayer.addChild(txt);

    this.floatingDamages.push({
      textObj: txt,
      x: x + jitterX,
      y,
      vy: -56,
      life: 0.68,
      maxLife: 0.68,
    });
  }

  public spawnEmote(
    playerId: string,
    x: number,
    y: number,
    emote: EmoteType
  ): void {
    const meta = EMOTE_BY_ID[emote];
    if (!meta) return;

    const bubble = new Container();
    const bg = new Graphics();
    bg.roundRect(-22, -20, 44, 34, 12).fill({ color: 0xffffff, alpha: 0.96 });
    bg.roundRect(-22, -20, 44, 34, 12).stroke({ width: 2.5, color: 0x0f172a });
    bg.moveTo(-5, 14)
      .lineTo(0, 21)
      .lineTo(5, 14)
      .closePath()
      .fill({ color: 0xffffff });

    const label = new Text({
      text: meta.icon,
      style: emoteTextStyle,
    });
    label.anchor.set(0.5);
    label.position.set(0, -3);

    bubble.addChild(bg, label);
    bubble.position.set(x, y - 56);
    this.textLayer.addChild(bubble);

    this.floatingEmotes.push({
      bubble,
      playerId,
      fallbackX: x,
      fallbackY: y,
      life: 2.1,
      maxLife: 2.1,
    });
  }

  public spawnCrateDebris(x: number, y: number, isGolden = false): void {
    const palette = isGolden
      ? [0xfacc15, 0xfbbf24, 0xfef08a, 0xffffff]
      : [0xb45309, 0xd97706, 0x78350f, 0xfbbf24];
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 200;
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
      maxRadius: isGolden ? 64 : 46,
      life: 0.28,
      maxLife: 0.28,
      color: isGolden ? 0xfacc15 : 0xfbbf24,
    });
    this.triggerShake(isGolden ? 6.5 : 4.5, 0.2);
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
      const maxLife = 0.08 + Math.random() * 0.06;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        life: maxLife,
        maxLife,
        size: 2 + Math.random() * 1.6,
        color: i % 2 === 0 ? 0xffffff : color,
      });
    }
  }

  public spawnAreaExplosion(ev: ExplosionEvent): void {
    const palette =
      ev.kind === "jump_land"
        ? [0x38bdf8, 0xa3e635, 0xffffff]
        : ev.kind === "mimic"
        ? [0xa855f7, 0xef4444, 0xfacc15]
        : [0xef4444, 0xf97316, 0xfacc15, 0xffffff];

    const count = ev.kind === "jump_land" ? 22 : 38;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * (ev.radius * 1.9);
      const maxLife = 0.28 + Math.random() * 0.32;
      this.particles.push({
        x: ev.x,
        y: ev.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife,
        size: 3 + Math.random() * 4,
        color: palette[i % palette.length],
      });
    }

    this.shockwaves.push({
      x: ev.x,
      y: ev.y,
      radius: 12,
      maxRadius: ev.radius,
      life: 0.34,
      maxLife: 0.34,
      color: palette[0],
    });

    this.triggerShake(
      ev.kind === "jump_land" ? 5.5 : 10,
      ev.kind === "jump_land" ? 0.2 : 0.32
    );
  }

  public spawnPlayerExplosion(x: number, y: number, hexColor = "#EF4444"): void {
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
    baseY: number,
    getPlayerPos?: (id: string) => { x: number; y: number } | null
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
      p.vx *= 0.92;
      p.vy *= 0.92;

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
        width: 4 * (1 - progress) + 1.5,
        color: sw.color,
        alpha,
      });
    }

    for (let i = this.floatingDamages.length - 1; i >= 0; i--) {
      const fd = this.floatingDamages[i];
      fd.life -= dtSeconds;
      if (fd.life <= 0) {
        fd.textObj.destroy();
        this.floatingDamages.splice(i, 1);
        continue;
      }
      fd.y += fd.vy * dtSeconds;
      fd.vy *= 0.94;
      const progress = 1 - fd.life / fd.maxLife;
      const pop = progress < 0.2 ? 0.8 + progress * 2.2 : 1.24 - progress * 0.25;
      fd.textObj.position.set(fd.x, fd.y);
      fd.textObj.scale.set(pop);
      fd.textObj.alpha = Math.min(1, (fd.life / fd.maxLife) * 1.5);
    }

    for (let i = this.floatingEmotes.length - 1; i >= 0; i--) {
      const em = this.floatingEmotes[i];
      em.life -= dtSeconds;
      if (em.life <= 0) {
        em.bubble.destroy({ children: true });
        this.floatingEmotes.splice(i, 1);
        continue;
      }
      const livePos = getPlayerPos?.(em.playerId);
      const px = livePos ? livePos.x : em.fallbackX;
      const py = livePos ? livePos.y : em.fallbackY;
      const progress = 1 - em.life / em.maxLife;
      const floatOffset = Math.sin(progress * Math.PI * 3) * 4;
      const scale = progress < 0.14 ? 0.4 + (progress / 0.14) * 0.75 : 1.05;
      em.bubble.position.set(px, py - 58 - progress * 10 + floatOffset);
      em.bubble.scale.set(scale);
      em.bubble.alpha = em.life < 0.35 ? em.life / 0.35 : 1;
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
    for (const fd of this.floatingDamages) fd.textObj.destroy();
    this.floatingDamages = [];
    for (const em of this.floatingEmotes) em.bubble.destroy({ children: true });
    this.floatingEmotes = [];
    this.shakeTime = 0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.gfx.clear();
  }
}
