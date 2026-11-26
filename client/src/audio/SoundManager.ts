import { Howl, Howler } from "howler";
import type {
  AbilityType,
  EmoteType,
  ExplosionEvent,
  WeaponType,
} from "@shared/types";

const MUTE_STORAGE_KEY = "bala_perdida_muted";

/**
 * Genera un data URI WAV PCM de 16-bit mono en memoria para reproducir con Howler.js
 * sin depender de archivos externos.
 */
function buildProceduralWavUri(
  durationSec: number,
  sampleFn: (t: number, progress: number) => number,
  sampleRate = 22050
): string {
  const numSamples = Math.max(1, Math.floor(durationSec * sampleRate));
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;
    const raw = Math.max(-1, Math.min(1, sampleFn(t, progress)));
    view.setInt16(44 + i * 2, Math.round(raw * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

class SoundService {
  private muted: boolean;
  private howls: Record<string, Howl> = {};
  private initialized = false;
  private lastFlameSoundMs = 0;

  constructor() {
    this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === "1";
    Howler.mute(this.muted);
  }

  private ensureBank(): void {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    // 1. Disparos de armas
    this.howls.pistol = new Howl({
      src: [
        buildProceduralWavUri(0.09, (t, p) => {
          const env = Math.pow(1 - p, 2.2);
          return Math.sin(2 * Math.PI * (520 - p * 360) * t) * env * 0.55;
        }),
      ],
      volume: 0.42,
    });

    this.howls.shotgun = new Howl({
      src: [
        buildProceduralWavUri(0.18, (t, p) => {
          const env = Math.pow(1 - p, 1.8);
          const noise = Math.random() * 2 - 1;
          const punch = Math.sin(2 * Math.PI * (190 - p * 140) * t);
          return (noise * 0.55 + punch * 0.45) * env * 0.7;
        }),
      ],
      volume: 0.5,
    });

    this.howls.rifle = new Howl({
      src: [
        buildProceduralWavUri(0.075, (t, p) => {
          const env = Math.pow(1 - p, 2.4);
          const wave = Math.sign(Math.sin(2 * Math.PI * (620 - p * 420) * t));
          return wave * env * 0.35;
        }),
      ],
      volume: 0.38,
    });

    this.howls.sniper = new Howl({
      src: [
        buildProceduralWavUri(0.24, (t, p) => {
          const env = Math.pow(1 - p, 1.5);
          const crack = (Math.random() * 2 - 1) * Math.pow(1 - p, 3.5);
          const boom = Math.sin(2 * Math.PI * (280 - p * 220) * t);
          return (crack * 0.6 + boom * 0.6) * env * 0.7;
        }),
      ],
      volume: 0.55,
    });

    this.howls.impulse_gun = new Howl({
      src: [
        buildProceduralWavUri(0.16, (t, p) => {
          const env = Math.pow(1 - p, 1.6);
          return Math.sin(2 * Math.PI * (220 + p * 680) * t) * env * 0.6;
        }),
      ],
      volume: 0.48,
    });

    this.howls.flamethrower = new Howl({
      src: [
        buildProceduralWavUri(0.11, (_t, p) => {
          const env = Math.sin(p * Math.PI);
          return (Math.random() * 2 - 1) * env * 0.35;
        }),
      ],
      volume: 0.34,
    });

    this.howls.saw_disc = new Howl({
      src: [
        buildProceduralWavUri(0.15, (t, p) => {
          const env = Math.pow(1 - p, 1.5);
          return (
            Math.sin(2 * Math.PI * 880 * t) *
            Math.sin(2 * Math.PI * 55 * t) *
            env *
            0.55
          );
        }),
      ],
      volume: 0.45,
    });

    this.howls.bee_cannon = new Howl({
      src: [
        buildProceduralWavUri(0.14, (t, p) => {
          const env = Math.sin(p * Math.PI);
          const buzz = Math.sign(Math.sin(2 * Math.PI * (310 + Math.sin(t * 90) * 40) * t));
          return buzz * env * 0.3;
        }),
      ],
      volume: 0.4,
    });

    this.howls.grappling_hook = new Howl({
      src: [
        buildProceduralWavUri(0.15, (t, p) => {
          const env = Math.pow(1 - p, 1.7);
          return Math.sin(2 * Math.PI * (420 + p * 540) * t) * env * 0.5;
        }),
      ],
      volume: 0.46,
    });

    // 2. Impactos, Escudo, Explosiones, Habilidades y Emotes
    this.howls.hit = new Howl({
      src: [
        buildProceduralWavUri(0.06, (t, p) => {
          return Math.sin(2 * Math.PI * (340 - p * 200) * t) * (1 - p) * 0.5;
        }),
      ],
      volume: 0.42,
    });

    this.howls.shield_reflect = new Howl({
      src: [
        buildProceduralWavUri(0.13, (t, p) => {
          return Math.sin(2 * Math.PI * (760 + p * 520) * t) * (1 - p) * 0.55;
        }),
      ],
      volume: 0.5,
    });

    this.howls.crate = new Howl({
      src: [
        buildProceduralWavUri(0.15, (_t, p) => {
          return (Math.random() * 2 - 1) * Math.pow(1 - p, 2) * 0.55;
        }),
      ],
      volume: 0.45,
    });

    this.howls.explosion = new Howl({
      src: [
        buildProceduralWavUri(0.38, (t, p) => {
          const env = Math.pow(1 - p, 1.5);
          const noise = Math.random() * 2 - 1;
          const sub = Math.sin(2 * Math.PI * (120 - p * 90) * t);
          return (noise * 0.55 + sub * 0.55) * env * 0.8;
        }),
      ],
      volume: 0.6,
    });

    this.howls.pickup = new Howl({
      src: [
        buildProceduralWavUri(0.14, (t, p) => {
          const freq = p < 0.5 ? 587 : 880;
          return Math.sin(2 * Math.PI * freq * t) * (1 - p * 0.6) * 0.45;
        }),
      ],
      volume: 0.45,
    });

    this.howls.ability = new Howl({
      src: [
        buildProceduralWavUri(0.16, (t, p) => {
          return Math.sin(2 * Math.PI * (320 + p * 480) * t) * (1 - p) * 0.48;
        }),
      ],
      volume: 0.46,
    });

    this.howls.emote = new Howl({
      src: [
        buildProceduralWavUri(0.18, (t, p) => {
          const freq = p < 0.35 ? 523 : p < 0.7 ? 659 : 784;
          return Math.sin(2 * Math.PI * freq * t) * (1 - p * 0.5) * 0.42;
        }),
      ],
      volume: 0.45,
    });

    this.howls.round_win = new Howl({
      src: [
        buildProceduralWavUri(0.42, (t, p) => {
          const freq = p < 0.33 ? 523 : p < 0.66 ? 659 : 1046;
          return Math.sin(2 * Math.PI * freq * t) * (1 - p * 0.4) * 0.48;
        }),
      ],
      volume: 0.5,
    });
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    Howler.mute(this.muted);
    localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? "1" : "0");
    return this.muted;
  }

  private playKey(key: string, rate = 1): void {
    if (this.muted) return;
    this.ensureBank();
    const howl = this.howls[key];
    if (!howl) return;
    const id = howl.play();
    if (rate !== 1) {
      howl.rate(rate, id);
    }
  }

  public playShoot(weapon: WeaponType = "pistol"): void {
    if (weapon === "flamethrower") {
      const now = performance.now();
      if (now - this.lastFlameSoundMs < 95) return;
      this.lastFlameSoundMs = now;
    }
    this.playKey(weapon, 0.96 + Math.random() * 0.08);
  }

  public playHit(targetType?: string): void {
    if (targetType === "shield") {
      this.playKey("shield_reflect", 1);
      return;
    }
    this.playKey("hit", 0.95 + Math.random() * 0.12);
  }

  public playCrateBreak(isGolden = false): void {
    this.playKey("crate", isGolden ? 1.25 : 1);
    if (isGolden) {
      this.playKey("pickup", 1.15);
    }
  }

  public playExplosion(kind: ExplosionEvent["kind"] = "barrel"): void {
    const rate = kind === "jump_land" ? 1.35 : kind === "potato" ? 0.85 : 1;
    this.playKey("explosion", rate);
  }

  public playPickup(): void {
    this.playKey("pickup", 1);
  }

  public playAbility(ability: AbilityType): void {
    const rate =
      ability === "dash"
        ? 1.25
        : ability === "energy_shield"
        ? 0.95
        : ability === "proximity_mine"
        ? 1.1
        : 0.82;
    this.playKey("ability", rate);
  }

  public playEmote(emote: EmoteType): void {
    const rate =
      emote === "laugh"
        ? 1.18
        : emote === "skull"
        ? 0.78
        : emote === "gg"
        ? 1.05
        : 1.32;
    this.playKey("emote", rate);
  }

  public playRoundWin(): void {
    this.playKey("round_win", 1);
  }
}

export const soundManager = new SoundService();
