import { Container, Graphics, Text } from "pixi.js";
import type { PlayerState } from "@shared/types";
import { hexToNumber, lerp, shortestAngleLerp } from "./Interpolation";

interface TankVisual {
  root: Container;
  bodyContainer: Container;
  tankGfx: Graphics;
  wreckageGfx: Graphics;
  label: Text;
  currentX: number;
  currentY: number;
  currentAngle: number;
  color: string;
  name: string;
  alive: boolean;
}

export class TankRenderer {
  public readonly container = new Container();
  private visuals = new Map<string, TankVisual>();

  public sync(
    players: Record<string, PlayerState>,
    localSessionId: string,
    alpha = 0.28
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
      let visual = this.visuals.get(id);
      if (!visual) {
        visual = this.createVisual(player, id === localSessionId);
        this.visuals.set(id, visual);
        this.container.addChild(visual.root);
      } else {
        if (visual.color !== player.color) {
          visual.color = player.color;
          this.drawTank(visual.tankGfx, player.color, id === localSessionId);
        }
        if (visual.name !== player.name) {
          visual.name = player.name;
          visual.label.text = player.name || "Tanque";
        }
        if (visual.alive !== player.alive) {
          visual.alive = player.alive;
          visual.tankGfx.visible = player.alive;
          visual.wreckageGfx.visible = !player.alive;
          visual.label.alpha = player.alive ? 1 : 0.4;
        }

        // Snap if teleported across the map (e.g. new round respawn)
        const distSq =
          (player.x - visual.currentX) ** 2 + (player.y - visual.currentY) ** 2;
        if (distSq > 160 * 160) {
          visual.currentX = player.x;
          visual.currentY = player.y;
          visual.currentAngle = player.angle;
        } else {
          visual.currentX = lerp(visual.currentX, player.x, alpha);
          visual.currentY = lerp(visual.currentY, player.y, alpha);
          visual.currentAngle = shortestAngleLerp(
            visual.currentAngle,
            player.angle,
            Math.min(1, alpha * 1.15)
          );
        }
      }

      visual.root.position.set(visual.currentX, visual.currentY);
      visual.bodyContainer.rotation = visual.currentAngle;
    }
  }

  private createVisual(player: PlayerState, isLocal: boolean): TankVisual {
    const root = new Container();
    const bodyContainer = new Container();
    const tankGfx = new Graphics();
    const wreckageGfx = new Graphics();

    this.drawTank(tankGfx, player.color, isLocal);
    this.drawWreckage(wreckageGfx);

    tankGfx.visible = player.alive;
    wreckageGfx.visible = !player.alive;

    bodyContainer.addChild(wreckageGfx, tankGfx);

    const label = new Text({
      text: player.name || "Tanque",
      style: {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11,
        fontWeight: "700",
        fill: isLocal ? "#f8fafc" : "#cbd5e1",
        stroke: { color: "#020617", width: 3 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -22);
    label.alpha = player.alive ? 1 : 0.4;

    root.addChild(bodyContainer, label);

    return {
      root,
      bodyContainer,
      tankGfx,
      wreckageGfx,
      label,
      currentX: player.x,
      currentY: player.y,
      currentAngle: player.angle,
      color: player.color,
      name: player.name,
      alive: player.alive,
    };
  }

  private drawTank(gfx: Graphics, hexColor: string, isLocal: boolean): void {
    const color = hexToNumber(hexColor);
    gfx.clear();

    // Subtle local-player ring
    if (isLocal) {
      gfx.circle(0, 0, 23).stroke({ width: 1.5, color, alpha: 0.35 });
    }

    // Left & right tracks (orugas) — tank faces +X (angle = 0)
    gfx.roundRect(-17, -14, 34, 6, 2).fill({ color: 0x1e293b });
    gfx.roundRect(-17, 8, 34, 6, 2).fill({ color: 0x1e293b });
    gfx.roundRect(-17, -14, 34, 6, 2).stroke({ width: 1, color: 0x475569, alpha: 0.9 });
    gfx.roundRect(-17, 8, 34, 6, 2).stroke({ width: 1, color: 0x475569, alpha: 0.9 });

    // Track treads detail
    for (let x = -13; x <= 13; x += 6) {
      gfx.moveTo(x, -14).lineTo(x, -8).stroke({ width: 1, color: 0x0f172a, alpha: 0.8 });
      gfx.moveTo(x, 8).lineTo(x, 14).stroke({ width: 1, color: 0x0f172a, alpha: 0.8 });
    }

    // Tank chassis glow + body
    gfx.roundRect(-16, -11, 32, 22, 4).fill({ color, alpha: 0.25 });
    gfx.roundRect(-15, -10, 30, 20, 4).fill({ color: 0x0f172a });
    gfx.roundRect(-15, -10, 30, 20, 4).stroke({ width: 2.2, color, alpha: 0.95 });

    // Inner accent plate
    gfx.roundRect(-10, -6, 16, 12, 2).fill({ color, alpha: 0.28 });

    // Directional cannon barrel
    gfx.roundRect(4, -3, 18, 6, 2).fill({ color: 0x0f172a });
    gfx.roundRect(4, -3, 18, 6, 2).stroke({ width: 2, color, alpha: 1 });

    // Muzzle tip
    gfx.rect(20, -2.5, 3, 5).fill({ color: 0xf8fafc, alpha: 0.95 });

    // Turret dome
    gfx.circle(0, 0, 7.5).fill({ color: 0x0f172a });
    gfx.circle(0, 0, 7.5).stroke({ width: 2, color, alpha: 1 });
    gfx.circle(0, 0, 3).fill({ color, alpha: 0.9 });
  }

  private drawWreckage(gfx: Graphics): void {
    gfx.clear();
    // Scorch mark
    gfx.circle(0, 0, 18).fill({ color: 0x020617, alpha: 0.65 });
    // Broken hull
    gfx.roundRect(-14, -9, 28, 18, 3).fill({ color: 0x1e293b, alpha: 0.8 });
    gfx.roundRect(-14, -9, 28, 18, 3).stroke({ width: 1.5, color: 0x475569, alpha: 0.7 });
    // X mark
    gfx
      .moveTo(-7, -5)
      .lineTo(7, 5)
      .moveTo(7, -5)
      .lineTo(-7, 5)
      .stroke({ width: 2, color: 0xef4444, alpha: 0.65 });
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
