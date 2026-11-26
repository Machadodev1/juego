import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { PlayerState, WeaponType } from "@shared/types";
import { hexToNumber, lerp, shortestAngleLerp } from "./Interpolation";

interface AgentNode {
  root: Container;
  shadowGfx: Graphics;
  shieldArcGfx: Graphics;
  turret: Container;
  handsAndWeaponGfx: Graphics;
  bodyGfx: Graphics;
  crownGfx: Graphics;
  potatoContainer: Container;
  potatoGfx: Graphics;
  potatoText: Text;
  hudGfx: Graphics;
  nameText: Text;
  renderedColor: string;
  renderedWeapon: WeaponType | "";
  renderedDowned: boolean;
  visualX: number;
  visualY: number;
  visualAngle: number;
  recoilOffset: number;
  hitFlashTimer: number;
  animTime: number;
}

const nameStyle = new TextStyle({
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 12,
  fontWeight: "800",
  fill: "#f8fafc",
  stroke: { color: "#020617", width: 3.5 },
});

const potatoTimerStyle = new TextStyle({
  fontFamily: "monospace",
  fontSize: 11,
  fontWeight: "900",
  fill: "#fef08a",
  stroke: { color: "#7f1d1d", width: 3 },
});

export class TankRenderer {
  public readonly container = new Container();
  private nodes = new Map<string, AgentNode>();

  public triggerRecoil(playerId: string, amount = 7): void {
    const node = this.nodes.get(playerId);
    if (node) {
      node.recoilOffset = Math.max(node.recoilOffset, amount);
    }
  }

  public triggerHitFlash(playerId: string): void {
    const node = this.nodes.get(playerId);
    if (node) {
      node.hitFlashTimer = 0.12;
    }
  }

  public sync(
    players: Record<string, PlayerState>,
    localSessionId: string,
    lerpFactor: number,
    dtSeconds: number,
    localAimAngle?: number
  ): void {
    const activeIds = new Set(Object.keys(players));

    for (const [id, node] of this.nodes.entries()) {
      if (!activeIds.has(id)) {
        this.container.removeChild(node.root);
        node.root.destroy({ children: true });
        this.nodes.delete(id);
      }
    }

    for (const [id, player] of Object.entries(players)) {
      let node = this.nodes.get(id);
      const isLocal = id === localSessionId;

      if (!node) {
        node = this.createNode(player);
        this.nodes.set(id, node);
        this.container.addChild(node.root);
      }

      if (!player.alive) {
        node.root.visible = false;
        node.visualX = player.x;
        node.visualY = player.y;
        continue;
      }

      // Enemigos invisibles quedan ocultos por completo; el jugador local se ve fantasmal
      if (player.isInvisible && !isLocal) {
        node.root.visible = false;
        node.visualX = player.x;
        node.visualY = player.y;
        continue;
      }

      node.root.visible = true;
      node.root.alpha = player.isInvisible ? 0.34 : 1;
      node.animTime += dtSeconds;

      if (node.recoilOffset > 0) {
        node.recoilOffset = Math.max(0, node.recoilOffset - dtSeconds * 42);
      }
      if (node.hitFlashTimer > 0) {
        node.hitFlashTimer = Math.max(0, node.hitFlashTimer - dtSeconds);
      }

      const posAlpha = isLocal ? Math.min(1, lerpFactor * 1.45) : lerpFactor;
      node.visualX = lerp(node.visualX, player.x, posAlpha);
      node.visualY = lerp(node.visualY, player.y, posAlpha);

      const targetAngle =
        isLocal && localAimAngle !== undefined ? localAimAngle : player.angle;
      node.visualAngle = isLocal
        ? targetAngle
        : shortestAngleLerp(node.visualAngle, targetAngle, lerpFactor * 1.3);

      node.root.position.set(node.visualX, node.visualY);
      node.turret.rotation = node.visualAngle;
      node.handsAndWeaponGfx.position.set(-node.recoilOffset, 0);

      // Animación de salto en trampolín (isAirborne) o gateo en Último Aliento (isDowned)
      if (player.isAirborne) {
        const jumpScale = 1.36 + Math.sin(node.animTime * 12) * 0.05;
        node.turret.scale.set(jumpScale);
        node.bodyGfx.scale.set(jumpScale);
        node.shadowGfx.scale.set(0.75);
        node.shadowGfx.position.set(0, 18);
      } else if (player.isDowned) {
        const crawlWobble = Math.sin(node.animTime * 9) * 0.08;
        node.turret.scale.set(0.88 + crawlWobble, 0.88 - crawlWobble);
        node.bodyGfx.scale.set(0.9 + crawlWobble, 0.86 - crawlWobble);
        node.shadowGfx.scale.set(1);
        node.shadowGfx.position.set(0, 4);
      } else {
        node.turret.scale.set(1);
        node.bodyGfx.scale.set(1);
        node.shadowGfx.scale.set(1);
        node.shadowGfx.position.set(0, 4);
      }

      if (node.nameText.text !== player.name) {
        node.nameText.text = player.name;
      }

      const effectiveWeapon: WeaponType = player.isDowned
        ? "pistol"
        : player.weapon;

      if (
        node.renderedColor !== player.color ||
        node.renderedWeapon !== effectiveWeapon ||
        node.renderedDowned !== player.isDowned
      ) {
        this.drawCircularCharacter(
          node,
          player.color,
          effectiveWeapon,
          isLocal,
          player.isDowned
        );
        node.renderedColor = player.color;
        node.renderedWeapon = effectiveWeapon;
        node.renderedDowned = player.isDowned;
      }

      // Parpadeo blanco al recibir impacto (hit flash)
      node.bodyGfx.tint = node.hitFlashTimer > 0 ? 0xffffff : 0xffffff;
      if (node.hitFlashTimer > 0) {
        this.drawHitFlashOverlay(node.bodyGfx);
      } else if (node.bodyGfx. alpha !== 1) {
        node.bodyGfx.alpha = 1;
      }
      // Redibujar cuerpo limpio cuando acaba el hit flash
      if (node.hitFlashTimer > 0) {
        node.renderedColor = "";
      }

      // Escudo de Energía Frontal activo
      node.shieldArcGfx.clear();
      if (player.shieldActive) {
        const start = node.visualAngle - (76 * Math.PI) / 180;
        const end = node.visualAngle + (76 * Math.PI) / 180;
        node.shieldArcGfx
          .arc(0, 0, 34, start, end)
          .stroke({ width: 7, color: 0x38bdf8, alpha: 0.42 });
        node.shieldArcGfx
          .arc(0, 0, 34, start, end)
          .stroke({ width: 3, color: 0xe0f2fe, alpha: 0.95 });
      }

      // Corona dorada de Bounty (2+ victorias seguidas)
      node.crownGfx.visible = player.hasBounty;

      // Bomba parpadeante de Papa Caliente
      if (player.hasHotPotato) {
        node.potatoContainer.visible = true;
        const secs = Math.max(0, player.hotPotatoTimerMs / 1000);
        node.potatoText.text = `${secs.toFixed(1)}s`;
        const blink = Math.sin(node.animTime * (secs < 4 ? 26 : 12)) > 0;
        node.potatoGfx.clear();
        node.potatoGfx
          .circle(0, 0, 10)
          .fill({ color: blink ? 0xef4444 : 0x1e293b });
        node.potatoGfx
          .circle(0, 0, 10)
          .stroke({ width: 2, color: 0xfacc15 });
        node.potatoGfx
          .moveTo(4, -8)
          .lineTo(9, -13)
          .stroke({ width: 2, color: 0xfbbf24 });
        node.potatoGfx.circle(9, -13, 3).fill({ color: 0xfef08a });
      } else {
        node.potatoContainer.visible = false;
      }

      this.drawStatusBars(node.hudGfx, player);
    }
  }

  public getVisualPosition(id: string): { x: number; y: number } | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    return { x: node.visualX, y: node.visualY };
  }

  private createNode(player: PlayerState): AgentNode {
    const root = new Container();
    root.position.set(player.x, player.y);

    const shadowGfx = new Graphics();
    shadowGfx.ellipse(0, 0, 22, 15).fill({ color: 0x000000, alpha: 0.28 });
    shadowGfx.position.set(0, 4);

    const shieldArcGfx = new Graphics();
    const turret = new Container();
    const handsAndWeaponGfx = new Graphics();
    turret.addChild(handsAndWeaponGfx);

    const bodyGfx = new Graphics();

    const crownGfx = new Graphics();
    crownGfx
      .poly([-11, -24, -13, -35, -5, -29, 0, -37, 5, -29, 13, -35, 11, -24], true)
      .fill({ color: 0xfacc15 });
    crownGfx
      .poly([-11, -24, -13, -35, -5, -29, 0, -37, 5, -29, 13, -35, 11, -24], true)
      .stroke({ width: 2, color: 0x78350f });
    crownGfx.visible = false;

    const potatoContainer = new Container();
    potatoContainer.position.set(0, -54);
    const potatoGfx = new Graphics();
    const potatoText = new Text({ text: "12.0s", style: potatoTimerStyle });
    potatoText.anchor.set(0, 0.5);
    potatoText.position.set(14, 0);
    potatoContainer.addChild(potatoGfx, potatoText);
    potatoContainer.visible = false;

    const hudGfx = new Graphics();

    const nameText = new Text({ text: player.name, style: nameStyle });
    nameText.anchor.set(0.5, 1);
    nameText.position.set(0, -30);

    root.addChild(
      shadowGfx,
      bodyGfx,
      turret,
      shieldArcGfx,
      hudGfx,
      crownGfx,
      nameText,
      potatoContainer
    );

    return {
      root,
      shadowGfx,
      shieldArcGfx,
      turret,
      handsAndWeaponGfx,
      bodyGfx,
      crownGfx,
      potatoContainer,
      potatoGfx,
      potatoText,
      hudGfx,
      nameText,
      renderedColor: "",
      renderedWeapon: "",
      renderedDowned: false,
      visualX: player.x,
      visualY: player.y,
      visualAngle: player.angle,
      recoilOffset: 0,
      hitFlashTimer: 0,
      animTime: 0,
    };
  }

  private drawHitFlashOverlay(bodyGfx: Graphics): void {
    bodyGfx.circle(0, 0, 21).fill({ color: 0xffffff, alpha: 0.85 });
  }

  private drawCircularCharacter(
    node: AgentNode,
    hexColor: string,
    weapon: WeaponType,
    isLocal: boolean,
    isDowned: boolean
  ): void {
    const color = hexToNumber(hexColor, 0x22d3ee);
    const { bodyGfx, handsAndWeaponGfx } = node;

    bodyGfx.clear();
    // Cuerpo circular estilo ZombsRoyale con contorno oscuro grueso
    bodyGfx.circle(0, 0, 21).fill({ color });
    bodyGfx
      .circle(-5, -5, 11)
      .fill({ color: 0xffffff, alpha: 0.22 });
    bodyGfx
      .circle(0, 0, 21)
      .stroke({ width: 4, color: isDowned ? 0xef4444 : 0x0f172a });

    if (isLocal) {
      bodyGfx
        .circle(0, 0, 25)
        .stroke({ width: 1.8, color: 0xffffff, alpha: 0.4 });
    }

    // Manitas circulares + Sprite vectorial de cada una de las 9 armas
    handsAndWeaponGfx.clear();

    if (isLocal && !isDowned) {
      const sightLen = weapon === "sniper" ? 210 : 125;
      for (let d = 38; d < sightLen; d += 16) {
        handsAndWeaponGfx
          .circle(d, 0, 1.5)
          .fill({ color, alpha: Math.max(0.08, 0.35 * (1 - d / sightLen)) });
      }
    }

    const drawHand = (hx: number, hy: number) => {
      handsAndWeaponGfx.circle(hx, hy, 6.5).fill({ color });
      handsAndWeaponGfx
        .circle(hx, hy, 6.5)
        .stroke({ width: 3, color: 0x0f172a });
    };

    switch (weapon) {
      case "shotgun":
        drawHand(15, -10);
        handsAndWeaponGfx
          .roundRect(12, -5.5, 25, 11, 3)
          .fill({ color: 0x334155 });
        handsAndWeaponGfx
          .roundRect(12, -5.5, 25, 11, 3)
          .stroke({ width: 2.5, color: 0x0f172a });
        handsAndWeaponGfx
          .roundRect(18, -6.5, 10, 13, 2)
          .fill({ color: 0xea580c });
        drawHand(22, 7);
        break;

      case "rifle":
        drawHand(14, -9);
        handsAndWeaponGfx
          .roundRect(10, -4.5, 30, 9, 2.5)
          .fill({ color: 0x1e293b });
        handsAndWeaponGfx
          .roundRect(10, -4.5, 30, 9, 2.5)
          .stroke({ width: 2.5, color: 0x0f172a });
        handsAndWeaponGfx
          .roundRect(20, -2.5, 11, 5, 1.5)
          .fill({ color: 0x38bdf8 });
        drawHand(24, 6.5);
        break;

      case "sniper":
        drawHand(14, -9);
        handsAndWeaponGfx
          .roundRect(10, -3.5, 39, 7, 2)
          .fill({ color: 0x0f172a });
        handsAndWeaponGfx
          .roundRect(10, -3.5, 39, 7, 2)
          .stroke({ width: 2, color: 0xf43f5e });
        handsAndWeaponGfx.circle(22, -6, 4).fill({ color: 0xf43f5e });
        drawHand(25, 6);
        break;

      case "impulse_gun":
        drawHand(14, -10);
        handsAndWeaponGfx
          .roundRect(11, -7, 23, 14, 5)
          .fill({ color: 0x0e7490 });
        handsAndWeaponGfx
          .roundRect(11, -7, 23, 14, 5)
          .stroke({ width: 2.5, color: 0x0f172a });
        handsAndWeaponGfx
          .arc(35, 0, 8, -0.9, 0.9)
          .stroke({ width: 3.5, color: 0x22d3ee });
        drawHand(19, 9);
        break;

      case "flamethrower":
        drawHand(13, -11);
        handsAndWeaponGfx
          .roundRect(10, -6.5, 26, 13, 4)
          .fill({ color: 0x9a3412 });
        handsAndWeaponGfx
          .roundRect(10, -6.5, 26, 13, 4)
          .stroke({ width: 2.5, color: 0x0f172a });
        handsAndWeaponGfx.circle(17, -9, 5).fill({ color: 0xf97316 });
        handsAndWeaponGfx.circle(38, 0, 3.5).fill({ color: 0xfacc15 });
        drawHand(22, 8);
        break;

      case "saw_disc":
        drawHand(14, -11);
        handsAndWeaponGfx
          .roundRect(11, -6, 20, 12, 3)
          .fill({ color: 0xca8a04 });
        handsAndWeaponGfx
          .roundRect(11, -6, 20, 12, 3)
          .stroke({ width: 2.5, color: 0x0f172a });
        handsAndWeaponGfx.circle(33, 0, 9).fill({ color: 0xf8fafc });
        handsAndWeaponGfx
          .circle(33, 0, 9)
          .stroke({ width: 2, color: 0x475569 });
        handsAndWeaponGfx.circle(33, 0, 3).fill({ color: 0xef4444 });
        drawHand(18, 9);
        break;

      case "bee_cannon":
        drawHand(13, -11);
        handsAndWeaponGfx
          .ellipse(24, 0, 14, 9)
          .fill({ color: 0xfacc15 });
        handsAndWeaponGfx
          .ellipse(24, 0, 14, 9)
          .stroke({ width: 2.5, color: 0x0f172a });
        handsAndWeaponGfx.roundRect(20, -8, 3, 16, 1).fill({ color: 0x0f172a });
        handsAndWeaponGfx.roundRect(27, -7, 3, 14, 1).fill({ color: 0x0f172a });
        drawHand(19, 9);
        break;

      case "grappling_hook":
        drawHand(14, -10);
        handsAndWeaponGfx
          .roundRect(11, -4.5, 22, 9, 3)
          .fill({ color: 0x581c87 });
        handsAndWeaponGfx
          .roundRect(11, -4.5, 22, 9, 3)
          .stroke({ width: 2.5, color: 0x0f172a });
        handsAndWeaponGfx
          .poly([33, -9, 41, 0, 33, 9, 36, 0], true)
          .fill({ color: 0xe9d5ff });
        drawHand(20, 8);
        break;

      default:
        // pistol
        drawHand(15, -9);
        handsAndWeaponGfx
          .roundRect(15, 2, 18, 7, 2.5)
          .fill({ color: 0x475569 });
        handsAndWeaponGfx
          .roundRect(15, 2, 18, 7, 2.5)
          .stroke({ width: 2.2, color: 0x0f172a });
        drawHand(16, 8);
        break;
    }
  }

  private drawStatusBars(gfx: Graphics, player: PlayerState): void {
    gfx.clear();
    const barW = 46;
    const x = -barW / 2;
    let y = 28;

    if (player.isDowned) {
      const ratio = Math.max(0, Math.min(1, player.downedTimerMs / 4000));
      gfx.roundRect(x, y, barW, 6, 3).fill({ color: 0x450a0a, alpha: 0.9 });
      if (ratio > 0) {
        gfx.roundRect(x + 1, y + 1, (barW - 2) * ratio, 4, 2).fill({
          color: 0xef4444,
        });
      }
      return;
    }

    // Barra de Escudo (50) azul arriba si tiene shield > 0
    if (player.shield > 0) {
      const sRatio = Math.max(
        0,
        Math.min(1, player.shield / (player.maxShield || 50))
      );
      gfx.roundRect(x, y, barW, 5, 2.5).fill({ color: 0x0f172a, alpha: 0.88 });
      gfx
        .roundRect(x + 1, y + 1, (barW - 2) * sRatio, 3, 1.5)
        .fill({ color: 0x38bdf8 });
      y += 6.5;
    }

    // Barra de Salud (100)
    const ratio = Math.max(0, Math.min(1, player.hp / (player.maxHp || 100)));
    const fillColor =
      ratio > 0.55 ? 0x22c55e : ratio > 0.28 ? 0xeab308 : 0xef4444;

    gfx.roundRect(x, y, barW, 6, 3).fill({ color: 0x020617, alpha: 0.88 });
    if (ratio > 0) {
      gfx
        .roundRect(x + 1, y + 1, (barW - 2) * ratio, 4, 2)
        .fill({ color: fillColor });
    }
  }

  public clear(): void {
    for (const node of this.nodes.values()) {
      node.root.destroy({ children: true });
    }
    this.nodes.clear();
  }
}
