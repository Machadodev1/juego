import { Container, Graphics, Text } from "pixi.js";
import type { PlayerState, WeaponType } from "@shared/types";
import { hexToNumber, lerp, shortestAngleLerp } from "./Interpolation";

interface AgentVisual {
  root: Container;
  bodyContainer: Container;
  characterGfx: Graphics;
  eliminatedGfx: Graphics;
  hpBarGfx: Graphics;
  label: Text;
  currentX: number;
  currentY: number;
  currentAngle: number;
  color: string;
  name: string;
  alive: boolean;
  weapon: WeaponType;
  hp: number;
  maxHp: number;
}

function hexPoints(r: number, rot = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * Math.PI * 2;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

/**
 * Agentes: robots de combate con chasis hexagonal, visor luminoso y arma
 * montada al frente (diseño propio, no usa personajes circulares con manos).
 */
export class TankRenderer {
  public readonly container = new Container();
  private visuals = new Map<string, AgentVisual>();

  public sync(
    players: Record<string, PlayerState>,
    localSessionId: string,
    alpha = 0.3,
    localAimAngle?: number
  ): void {
    const activeIds = new Set(Object.keys(players));

    for (const [id, visual] of Array.from(this.visuals.entries())) {
      if (!activeIds.has(id)) {
        this.container.removeChild(visual.root);
        visual.root.destroy({ children: true });
        this.visuals.delete(id);
      }
    }

    for (const [id, player] of Object.entries(players)) {
      const isLocal = id === localSessionId;
      let visual = this.visuals.get(id);

      if (!visual) {
        visual = this.createVisual(player, isLocal);
        this.visuals.set(id, visual);
        this.container.addChild(visual.root);
      } else {
        if (visual.color !== player.color || visual.weapon !== player.weapon) {
          visual.color = player.color;
          visual.weapon = player.weapon;
          this.drawAgent(
            visual.characterGfx,
            player.color,
            player.weapon,
            isLocal
          );
        }

        if (visual.name !== player.name) {
          visual.name = player.name;
          visual.label.text = player.name || "Agente";
        }

        if (visual.alive !== player.alive) {
          visual.alive = player.alive;
          visual.characterGfx.visible = player.alive;
          visual.hpBarGfx.visible = player.alive;
          visual.eliminatedGfx.visible = !player.alive;
          visual.label.alpha = player.alive ? 1 : 0.45;
        }

        if (visual.hp !== player.hp || visual.maxHp !== player.maxHp) {
          visual.hp = player.hp;
          visual.maxHp = player.maxHp;
          this.drawHpBar(visual.hpBarGfx, player.hp, player.maxHp, isLocal);
        }

        const distSq =
          (player.x - visual.currentX) ** 2 + (player.y - visual.currentY) ** 2;
        if (distSq > 220 * 220) {
          visual.currentX = player.x;
          visual.currentY = player.y;
          visual.currentAngle = player.angle;
        } else {
          visual.currentX = lerp(visual.currentX, player.x, alpha);
          visual.currentY = lerp(visual.currentY, player.y, alpha);
          if (isLocal && localAimAngle !== undefined) {
            visual.currentAngle = localAimAngle;
          } else {
            visual.currentAngle = shortestAngleLerp(
              visual.currentAngle,
              player.angle,
              Math.min(1, alpha * 1.25)
            );
          }
        }
      }

      visual.root.position.set(visual.currentX, visual.currentY);
      visual.bodyContainer.rotation = visual.currentAngle;
    }
  }

  private createVisual(player: PlayerState, isLocal: boolean): AgentVisual {
    const root = new Container();
    const bodyContainer = new Container();
    const characterGfx = new Graphics();
    const eliminatedGfx = new Graphics();
    const hpBarGfx = new Graphics();

    this.drawAgent(characterGfx, player.color, player.weapon, isLocal);
    this.drawEliminated(eliminatedGfx);
    this.drawHpBar(hpBarGfx, player.hp, player.maxHp, isLocal);

    characterGfx.visible = player.alive;
    hpBarGfx.visible = player.alive;
    eliminatedGfx.visible = !player.alive;

    bodyContainer.addChild(eliminatedGfx, characterGfx);

    const label = new Text({
      text: player.name || "Agente",
      style: {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 12,
        fontWeight: "800",
        fill: isLocal ? "#fef08a" : "#f8fafc",
        stroke: { color: "#0f172a", width: 3.5 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -40);
    label.alpha = player.alive ? 1 : 0.45;

    root.addChild(bodyContainer, hpBarGfx, label);

    return {
      root,
      bodyContainer,
      characterGfx,
      eliminatedGfx,
      hpBarGfx,
      label,
      currentX: player.x,
      currentY: player.y,
      currentAngle: player.angle,
      color: player.color,
      name: player.name,
      alive: player.alive,
      weapon: player.weapon,
      hp: player.hp,
      maxHp: player.maxHp,
    };
  }

  private drawAgent(
    gfx: Graphics,
    hexColor: string,
    weapon: WeaponType,
    isLocal: boolean
  ): void {
    const color = hexToNumber(hexColor);
    gfx.clear();

    // Halo y láser táctico del jugador local
    if (isLocal) {
      gfx.circle(0, 0, 30).stroke({ width: 2, color: 0xfef08a, alpha: 0.45 });
      const sightLen = weapon === "sniper" ? 260 : weapon === "shotgun" ? 95 : 155;
      const sightColor = weapon === "sniper" ? 0xc084fc : weapon === "plasma" ? 0xf472b6 : 0x67e8f9;
      for (let d = 44; d < sightLen; d += 16) {
        const segAlpha = Math.max(0.06, 0.34 * (1 - d / sightLen));
        gfx
          .moveTo(d, 0)
          .lineTo(d + 8, 0)
          .stroke({ width: 1.6, color: sightColor, alpha: segAlpha, cap: "round" });
      }
    }

    // Sombra
    gfx.ellipse(2, 5, 23, 19).fill({ color: 0x000000, alpha: 0.3 });

    // Arma montada al frente (apunta hacia +X)
    this.drawWeapon(gfx, weapon, color);

    // Propulsores laterales
    gfx.roundRect(-14, -26, 16, 8, 3).fill({ color: 0x1e293b });
    gfx.roundRect(-14, 18, 16, 8, 3).fill({ color: 0x1e293b });
    gfx.roundRect(-14, -26, 16, 8, 3).stroke({ width: 2, color: 0x020617 });
    gfx.roundRect(-14, 18, 16, 8, 3).stroke({ width: 2, color: 0x020617 });
    gfx.rect(-12, -24, 6, 4).fill({ color, alpha: 0.9 });
    gfx.rect(-12, 20, 6, 4).fill({ color, alpha: 0.9 });

    // Chasis hexagonal
    gfx.poly(hexPoints(23, 0)).fill({ color: 0x1b2433 });
    gfx.poly(hexPoints(23, 0)).stroke({ width: 3.5, color: 0x020617 });
    gfx.poly(hexPoints(18, 0)).fill({ color });
    gfx.poly(hexPoints(18, 0)).stroke({ width: 2, color: 0xffffff, alpha: 0.35 });

    // Núcleo y visor luminoso
    gfx.circle(-3, 0, 8).fill({ color: 0x0f172a, alpha: 0.85 });
    gfx.circle(-3, 0, 4).fill({ color: 0xffffff, alpha: 0.9 });
    gfx.roundRect(5, -5, 12, 10, 4).fill({ color: 0x020617 });
    gfx.roundRect(8, -3, 8, 6, 3).fill({ color: 0x67e8f9 });
  }

  private drawWeapon(gfx: Graphics, weapon: WeaponType, color: number): void {
    const dark = 0x0f172a;
    const edge = 0x020617;

    switch (weapon) {
      case "smg":
        gfx.roundRect(14, -5, 22, 10, 3).fill({ color: dark });
        gfx.roundRect(26, -3, 14, 6, 2).fill({ color: 0x475569 });
        gfx.rect(18, 4, 6, 10).fill({ color: 0x334155 });
        gfx.roundRect(14, -5, 26, 10, 3).stroke({ width: 2, color: edge });
        gfx.rect(34, -1.5, 8, 3).fill({ color: 0xfacc15 });
        break;
      case "shotgun":
        gfx.roundRect(14, -8, 30, 6, 2).fill({ color: 0x475569 });
        gfx.roundRect(14, 2, 30, 6, 2).fill({ color: 0x475569 });
        gfx.rect(14, -9, 9, 18).fill({ color: 0x7c2d12 });
        gfx.roundRect(14, -9, 30, 18, 2).stroke({ width: 2, color: edge });
        gfx.rect(40, -8, 5, 4).fill({ color: 0xf97316 });
        gfx.rect(40, 4, 5, 4).fill({ color: 0xf97316 });
        break;
      case "rifle":
        gfx.roundRect(14, -4.5, 32, 9, 2).fill({ color: dark });
        gfx.rect(28, -2.5, 18, 5).fill({ color: 0x38bdf8 });
        gfx.rect(20, -9, 10, 4).fill({ color: 0x334155 });
        gfx.roundRect(14, -4.5, 32, 9, 2).stroke({ width: 2, color: edge });
        break;
      case "burst":
        gfx.roundRect(14, -8, 30, 4, 1.5).fill({ color: 0x2dd4bf });
        gfx.roundRect(14, -2, 30, 4, 1.5).fill({ color: 0x2dd4bf });
        gfx.roundRect(14, 4, 30, 4, 1.5).fill({ color: 0x2dd4bf });
        gfx.roundRect(12, -10, 8, 20, 3).fill({ color: dark });
        gfx.roundRect(12, -10, 8, 20, 3).stroke({ width: 2, color: edge });
        break;
      case "plasma":
        gfx.roundRect(14, -7, 28, 14, 6).fill({ color: dark });
        gfx.circle(22, 0, 9).fill({ color: 0xf472b6, alpha: 0.35 });
        gfx.circle(22, 0, 5).fill({ color: 0xf9a8d4 });
        gfx.roundRect(30, -4, 16, 8, 3).fill({ color: 0xbe185d });
        gfx.roundRect(14, -7, 32, 14, 6).stroke({ width: 2, color: edge });
        break;
      case "sniper":
        gfx.roundRect(14, -3.5, 42, 7, 2).fill({ color: dark });
        gfx.circle(26, -9, 5).fill({ color: 0xc084fc });
        gfx.circle(26, -9, 5).stroke({ width: 2, color: edge });
        gfx.rect(50, -2, 8, 4).fill({ color: 0xe9d5ff });
        gfx.roundRect(14, -3.5, 42, 7, 2).stroke({ width: 2, color: edge });
        break;
      default:
        gfx.roundRect(15, -4, 18, 8, 3).fill({ color: 0x334155 });
        gfx.rect(28, -2.5, 6, 5).fill({ color });
        gfx.roundRect(15, -4, 18, 8, 3).stroke({ width: 2, color: edge });
        break;
    }
  }

  private drawHpBar(
    gfx: Graphics,
    hp: number,
    maxHp: number,
    isLocal: boolean
  ): void {
    gfx.clear();
    const width = 46;
    const height = 7;
    const y = -35;
    const ratio = Math.max(0, Math.min(1, hp / (maxHp || 100)));

    const fillColor =
      ratio > 0.55
        ? isLocal
          ? 0x22c55e
          : 0x4ade80
        : ratio > 0.28
        ? 0xfacc15
        : 0xef4444;

    gfx
      .roundRect(-width / 2, y, width, height, 3.5)
      .fill({ color: 0x0f172a, alpha: 0.88 });
    if (ratio > 0) {
      gfx
        .roundRect(
          -width / 2 + 1.5,
          y + 1.5,
          (width - 3) * ratio,
          height - 3,
          2
        )
        .fill({ color: fillColor });
    }
  }

  private drawEliminated(gfx: Graphics): void {
    gfx.clear();
    gfx.poly(hexPoints(20, 0)).fill({ color: 0x1e293b, alpha: 0.65 });
    gfx.poly(hexPoints(20, 0)).stroke({ width: 3, color: 0x0f172a, alpha: 0.8 });
    gfx
      .moveTo(-8, -8)
      .lineTo(8, 8)
      .moveTo(8, -8)
      .lineTo(-8, 8)
      .stroke({ width: 3.5, color: 0xef4444, alpha: 0.85, cap: "round" });
  }

  public getVisualPosition(id: string): { x: number; y: number } | null {
    const v = this.visuals.get(id);
    return v ? { x: v.currentX, y: v.currentY } : null;
  }

  public clear(): void {
    for (const visual of this.visuals.values()) {
      this.container.removeChild(visual.root);
      visual.root.destroy({ children: true });
    }
    this.visuals.clear();
  }
}
