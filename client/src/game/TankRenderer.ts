import { Container, Graphics, Text } from "pixi.js";
import type { PlayerState, WeaponType } from "@shared/types";
import { hexToNumber, lerp, shortestAngleLerp } from "./Interpolation";

interface SoldierVisual {
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

export class TankRenderer {
  public readonly container = new Container();
  private visuals = new Map<string, SoldierVisual>();

  public sync(
    players: Record<string, PlayerState>,
    localSessionId: string,
    alpha = 0.3,
    localAimAngle?: number
  ): void {
    const activeIds = new Set(Object.keys(players));

    for (const [id, visual] of this.visuals.entries()) {
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
          this.drawSoldier(
            visual.characterGfx,
            player.color,
            player.weapon,
            isLocal
          );
        }

        if (visual.name !== player.name) {
          visual.name = player.name;
          visual.label.text = player.name || "Jugador";
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

  private createVisual(player: PlayerState, isLocal: boolean): SoldierVisual {
    const root = new Container();
    const bodyContainer = new Container();
    const characterGfx = new Graphics();
    const eliminatedGfx = new Graphics();
    const hpBarGfx = new Graphics();

    this.drawSoldier(characterGfx, player.color, player.weapon, isLocal);
    this.drawEliminated(eliminatedGfx);
    this.drawHpBar(hpBarGfx, player.hp, player.maxHp, isLocal);

    characterGfx.visible = player.alive;
    hpBarGfx.visible = player.alive;
    eliminatedGfx.visible = !player.alive;

    bodyContainer.addChild(eliminatedGfx, characterGfx);

    const label = new Text({
      text: player.name || "Jugador",
      style: {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 12,
        fontWeight: "800",
        fill: isLocal ? "#fef08a" : "#f8fafc",
        stroke: { color: "#0f172a", width: 3.5 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -38);
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

  private drawSoldier(
    gfx: Graphics,
    hexColor: string,
    weapon: WeaponType,
    isLocal: boolean
  ): void {
    const color = hexToNumber(hexColor);
    gfx.clear();

    // Anillo indicador del jugador local
    if (isLocal) {
      gfx.circle(0, 0, 29).stroke({ width: 2, color: 0xfef08a, alpha: 0.45 });
    }

    // Sombra bajo el personaje
    gfx.circle(2, 4, 22).fill({ color: 0x0f172a, alpha: 0.35 });

    // Arma equipada apuntando hacia +X
    if (weapon === "pistol") {
      gfx.roundRect(16, -3.5, 16, 7, 2).fill({ color: 0x334155 });
      gfx
        .roundRect(16, -3.5, 16, 7, 2)
        .stroke({ width: 2.5, color: 0x0f172a });
    } else if (weapon === "shotgun") {
      gfx.roundRect(12, -5, 24, 10, 3).fill({ color: 0x7c2d12 });
      gfx.roundRect(20, -4, 18, 8, 2).fill({ color: 0x475569 });
      gfx
        .roundRect(12, -5, 26, 10, 3)
        .stroke({ width: 2.5, color: 0x0f172a });
    } else if (weapon === "rifle") {
      gfx.roundRect(12, -4, 29, 8, 2).fill({ color: 0x1e293b });
      gfx.rect(22, -2.5, 18, 5).fill({ color: 0x38bdf8 });
      gfx
        .roundRect(12, -4, 29, 8, 2)
        .stroke({ width: 2.5, color: 0x0f172a });
    } else if (weapon === "sniper") {
      gfx.roundRect(12, -3.5, 36, 7, 2).fill({ color: 0x1e293b });
      gfx.circle(22, 0, 4.5).fill({ color: 0xc084fc });
      gfx
        .roundRect(12, -3.5, 36, 7, 2)
        .stroke({ width: 2.5, color: 0x0f172a });
    }

    // Manos redondas estilo ZombsRoyale sosteniendo el arma
    gfx.circle(17, 10, 7.5).fill({ color });
    gfx.circle(17, 10, 7.5).stroke({ width: 3, color: 0x0f172a });

    gfx.circle(22, -6, 7.5).fill({ color });
    gfx.circle(22, -6, 7.5).stroke({ width: 3, color: 0x0f172a });

    // Cuerpo circular principal (radius = 22)
    gfx.circle(0, 0, 22).fill({ color });
    gfx.circle(-5, -5, 13).fill({ color: 0xffffff, alpha: 0.18 });
    gfx.circle(0, 0, 22).stroke({ width: 4, color: 0x0f172a });
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
    const y = -34;
    const ratio = Math.max(0, Math.min(1, hp / (maxHp || 100)));

    const fillColor =
      ratio > 0.55 ? (isLocal ? 0x22c55e : 0x4ade80) : ratio > 0.28 ? 0xfacc15 : 0xef4444;

    gfx
      .roundRect(-width / 2, y, width, height, 3.5)
      .fill({ color: 0x0f172a, alpha: 0.88 });
    if (ratio > 0) {
      gfx
        .roundRect(-width / 2 + 1.5, y + 1.5, (width - 3) * ratio, height - 3, 2)
        .fill({ color: fillColor });
    }
  }

  private drawEliminated(gfx: Graphics): void {
    gfx.clear();
    gfx.circle(0, 0, 20).fill({ color: 0x1e293b, alpha: 0.65 });
    gfx.circle(0, 0, 20).stroke({ width: 3, color: 0x0f172a, alpha: 0.8 });
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
