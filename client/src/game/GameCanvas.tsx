import React, { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import type {
  ArenaTheme,
  BulletHitEvent,
  BulletState,
  CrateDestroyedEvent,
  LootItemState,
  ObstacleState,
  PlayerEliminatedEvent,
  PlayerState,
  RoundModifier,
} from "@shared/types";
import { colyseusClient } from "../network/ColyseusClient";
import { soundManager } from "../audio/SoundManager";
import { ArenaRenderer, THEME_STYLE } from "./ArenaRenderer";
import { AmbientFx } from "./AmbientFx";
import { TankRenderer } from "./TankRenderer";
import { BulletRenderer } from "./BulletRenderer";
import { EffectsManager } from "./EffectsManager";
import { InputManager } from "./InputManager";
import { LocalArena } from "./LocalArena";
import { hexToNumber, lerp } from "./Interpolation";

interface GameCanvasProps {
  mode: "online" | "local";
  mapWidth: number;
  mapHeight: number;
  theme: ArenaTheme;
  modifier: RoundModifier;
  obstacles: Record<string, ObstacleState>;
  lootItems: Record<string, LootItemState>;
  players: Record<string, PlayerState>;
  bullets: Record<string, BulletState>;
  localSessionId: string;
  isPlaying: boolean;
  localTheme?: string;
  localArenaRef?: React.MutableRefObject<LocalArena | null>;
  onLocalStateSync?: (
    players: Record<string, PlayerState>,
    modifier: RoundModifier,
    theme: ArenaTheme,
    lootItems: Record<string, LootItemState>
  ) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  mapWidth,
  mapHeight,
  theme,
  modifier,
  obstacles,
  lootItems,
  players,
  bullets,
  localSessionId,
  isPlaying,
  localTheme = "random",
  localArenaRef,
  onLocalStateSync,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    mapWidth,
    mapHeight,
    theme,
    modifier,
    obstacles,
    lootItems,
    players,
    bullets,
    localSessionId,
    isPlaying,
    localTheme,
  });
  stateRef.current = {
    mapWidth,
    mapHeight,
    theme,
    modifier,
    obstacles,
    lootItems,
    players,
    bullets,
    localSessionId,
    isPlaying,
    localTheme,
  };

  const onLocalSyncRef = useRef(onLocalStateSync);
  onLocalSyncRef.current = onLocalStateSync;

  useEffect(() => {
    const containerEl = hostRef.current;
    if (!containerEl) return;

    let destroyed = false;
    let app: Application | null = null;
    let inputManager: InputManager | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const worldContainer = new Container();
    const minimapContainer = new Container();
    const minimapGfx = new Graphics();
    minimapContainer.addChild(minimapGfx);

    const arenaRenderer = new ArenaRenderer();
    const agentRenderer = new TankRenderer();
    const bulletRenderer = new BulletRenderer();
    const effectsManager = new EffectsManager();
    const ambientFx = new AmbientFx();

    worldContainer.addChild(
      arenaRenderer.groundContainer,
      arenaRenderer.lootContainer,
      arenaRenderer.obstacleContainer,
      agentRenderer.container,
      bulletRenderer.container,
      effectsManager.container,
      arenaRenderer.canopyContainer
    );

    const prevBulletIds = new Set<string>();
    const prevLootIds = new Set<string>();
    let camX = mapWidth / 2;
    let camY = mapHeight / 2;
    let appliedBackgroundTheme: ArenaTheme | null = null;

    const unsubHit = colyseusClient.onBulletHit((ev: BulletHitEvent) => {
      effectsManager.spawnBulletHit(ev.x, ev.y, ev.targetType);
      soundManager.playHit();
    });

    const unsubCrate = colyseusClient.onCrateDestroyed(
      (ev: CrateDestroyedEvent) => {
        effectsManager.spawnCrateDebris(ev.x, ev.y);
        soundManager.playCrateBreak();
      }
    );

    const unsubEliminated = colyseusClient.onPlayerEliminated(
      (ev: PlayerEliminatedEvent) => {
        const victimColor =
          stateRef.current.players[ev.victimId]?.color || "#EF4444";
        effectsManager.spawnExplosion(ev.x, ev.y, victimColor);
        soundManager.playExplosion();
      }
    );

    const drawMinimap = (
      viewW: number,
      mW: number,
      mH: number,
      activeTheme: ArenaTheme,
      activeObstacles: Record<string, ObstacleState>,
      activeLoot: Record<string, LootItemState>,
      activePlayers: Record<string, PlayerState>,
      meId: string
    ) => {
      const style = THEME_STYLE[activeTheme];
      const miniW = 164;
      const miniH = Math.round(miniW * (mH / mW));
      minimapContainer.position.set(viewW - miniW - 16, 68);

      minimapGfx.clear();
      minimapGfx
        .roundRect(0, 0, miniW, miniH, 8)
        .fill({ color: style.minimapBg, alpha: 0.82 });
      minimapGfx
        .roundRect(0, 0, miniW, miniH, 8)
        .stroke({ width: 2, color: 0x475569, alpha: 0.95 });

      const sx = miniW / mW;
      const sy = miniH / mH;

      for (const obs of Object.values(activeObstacles)) {
        const color =
          obs.type === "rock"
            ? style.minimapRock
            : obs.type === "crate"
            ? style.minimapCrate
            : style.minimapFlora;
        minimapGfx
          .circle(obs.x * sx, obs.y * sy, Math.max(1.8, obs.radius * sx))
          .fill({ color, alpha: 0.8 });
      }

      for (const item of Object.values(activeLoot)) {
        minimapGfx
          .circle(item.x * sx, item.y * sy, 2.4)
          .fill({
            color: item.kind === "medkit" ? 0x4ade80 : 0xffffff,
            alpha: 0.95,
          });
      }

      for (const p of Object.values(activePlayers)) {
        if (!p.alive) continue;
        const isMe = p.id === meId;
        minimapGfx
          .circle(p.x * sx, p.y * sy, isMe ? 4.2 : 3.2)
          .fill({ color: isMe ? 0xfef08a : hexToNumber(p.color) });
      }
    };

    const initPixi = async () => {
      const pixiApp = new Application();
      await pixiApp.init({
        background: THEME_STYLE[stateRef.current.theme]?.background ?? "#0a1220",
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        width: containerEl.clientWidth || 1280,
        height: containerEl.clientHeight || 720,
      });

      if (destroyed) {
        pixiApp.destroy(true, { children: true });
        return;
      }

      app = pixiApp;
      containerEl.innerHTML = "";
      containerEl.appendChild(pixiApp.canvas);
      pixiApp.canvas.style.display = "block";
      pixiApp.canvas.style.width = "100%";
      pixiApp.canvas.style.height = "100%";

      pixiApp.stage.addChild(
        worldContainer,
        ambientFx.container,
        minimapContainer
      );
      inputManager = new InputManager(pixiApp.canvas);

      if (mode === "local" && localArenaRef && !localArenaRef.current) {
        const localPlayer = Object.values(stateRef.current.players)[0];
        localArenaRef.current = new LocalArena(
          localPlayer?.name || "Agente",
          localPlayer?.color || "#22D3EE",
          {
            onShoot: (x, y, angle, color, weapon) => {
              effectsManager.spawnMuzzleFlash(x, y, angle, color);
              soundManager.playShoot(weapon);
            },
            onBulletHit: (ev) => {
              effectsManager.spawnBulletHit(ev.x, ev.y, ev.targetType);
              soundManager.playHit();
            },
            onCrateDestroyed: (ev) => {
              effectsManager.spawnCrateDebris(ev.x, ev.y);
              soundManager.playCrateBreak();
            },
            onPickup: () => {
              soundManager.playPickup();
            },
            onEliminated: (ev) => {
              const victimColor =
                localArenaRef.current?.players[ev.victimId]?.color || "#EF4444";
              effectsManager.spawnExplosion(ev.x, ev.y, victimColor);
              soundManager.playExplosion();
            },
          },
          stateRef.current.localTheme
        );
        onLocalSyncRef.current?.(
          { ...localArenaRef.current.players },
          localArenaRef.current.modifier,
          localArenaRef.current.theme,
          { ...localArenaRef.current.lootItems }
        );
      }

      resizeObserver = new ResizeObserver(() => {
        if (!app || destroyed) return;
        const viewW = containerEl.clientWidth || window.innerWidth;
        const viewH = containerEl.clientHeight || window.innerHeight;
        app.renderer.resize(viewW, viewH);
      });
      resizeObserver.observe(containerEl);

      let hudSyncAccum = 0;

      pixiApp.ticker.add((ticker) => {
        const dtSeconds = ticker.deltaMS / 1000;
        const viewW = pixiApp.renderer.width;
        const viewH = pixiApp.renderer.height;

        let activeMapW = stateRef.current.mapWidth || 1600;
        let activeMapH = stateRef.current.mapHeight || 1200;
        let activeTheme = stateRef.current.theme;
        let activeObstacles = stateRef.current.obstacles;
        let activeLoot = stateRef.current.lootItems;
        let activePlayers = stateRef.current.players;
        let activeBullets = stateRef.current.bullets;
        let activeSessionId = stateRef.current.localSessionId;
        const playing = stateRef.current.isPlaying;

        const worldScale = Math.max(0.75, Math.min(viewW / 1280, 1.15));
        let localAimAngle: number | undefined;

        if (mode === "local" && localArenaRef?.current) {
          const arena = localArenaRef.current;
          activeMapW = arena.mapWidth;
          activeMapH = arena.mapHeight;
          activeTheme = arena.theme;
          activeSessionId = arena.localId;

          const meVisual =
            agentRenderer.getVisualPosition(activeSessionId) ||
            arena.players[activeSessionId] || { x: 800, y: 600 };

          const offsetX = viewW / 2 - camX * worldScale;
          const offsetY = viewH / 2 - camY * worldScale;

          if (playing && inputManager) {
            const meState = arena.players[activeSessionId];
            const invLen = meState?.inventory.length ?? 1;
            const prevSlot = meState?.activeSlot ?? 0;
            inputManager.setInventoryContext(invLen, prevSlot);
            const input = inputManager.pollInput(
              meVisual.x,
              meVisual.y,
              offsetX,
              offsetY,
              worldScale
            );
            if (
              input.weaponSlot !== undefined &&
              input.weaponSlot >= 0 &&
              input.weaponSlot < invLen &&
              input.weaponSlot !== prevSlot
            ) {
              soundManager.playSwitchWeapon();
            }
            localAimAngle = input.angle;
            arena.step(input, dtSeconds);
          }

          activeObstacles = arena.obstacles;
          activeLoot = arena.lootItems;
          activePlayers = arena.players;
          activeBullets = arena.bullets;

          hudSyncAccum += dtSeconds;
          if (hudSyncAccum >= 0.08) {
            hudSyncAccum = 0;
            onLocalSyncRef.current?.(
              { ...arena.players },
              arena.modifier,
              arena.theme,
              { ...arena.lootItems }
            );
          }
        } else {
          const me = activePlayers[activeSessionId];

          if (playing && inputManager && me && me.alive) {
            inputManager.setInventoryContext(me.inventory.length, me.activeSlot);
            const meVisual =
              agentRenderer.getVisualPosition(activeSessionId) || me;
            const offsetX = viewW / 2 - camX * worldScale;
            const offsetY = viewH / 2 - camY * worldScale;
            const input = inputManager.pollInput(
              meVisual.x,
              meVisual.y,
              offsetX,
              offsetY,
              worldScale
            );
            if (
              input.weaponSlot !== undefined &&
              input.weaponSlot >= 0 &&
              input.weaponSlot < me.inventory.length &&
              input.weaponSlot !== me.activeSlot
            ) {
              soundManager.playSwitchWeapon();
            }
            localAimAngle = input.angle;
            colyseusClient.sendInput(input);
          }

          // Destello y sonido al detectar nuevos proyectiles en línea
          let playedShotThisFrame = false;
          for (const [bid, bullet] of Object.entries(activeBullets)) {
            if (!prevBulletIds.has(bid)) {
              const owner = activePlayers[bullet.ownerId];
              if (owner) {
                effectsManager.spawnMuzzleFlash(
                  bullet.x,
                  bullet.y,
                  owner.angle,
                  owner.color
                );
              }
              if (!playedShotThisFrame) {
                soundManager.playShoot(bullet.weaponType);
                playedShotThisFrame = true;
              }
            }
          }
          prevBulletIds.clear();
          for (const bid of Object.keys(activeBullets)) {
            prevBulletIds.add(bid);
          }

          // Sonido al recoger botín
          for (const oldLootId of prevLootIds) {
            if (!activeLoot[oldLootId]) {
              soundManager.playPickup();
              break;
            }
          }
          prevLootIds.clear();
          for (const lid of Object.keys(activeLoot)) {
            prevLootIds.add(lid);
          }
        }

        // Fondo del renderizador según tema
        if (appliedBackgroundTheme !== activeTheme) {
          appliedBackgroundTheme = activeTheme;
          pixiApp.renderer.background.color =
            THEME_STYLE[activeTheme]?.outside ?? 0x0a1220;
        }

        // Cámara
        const me = activePlayers[activeSessionId];
        const meVisualPos =
          agentRenderer.getVisualPosition(activeSessionId) || me || {
            x: activeMapW / 2,
            y: activeMapH / 2,
          };

        if (me && me.alive) {
          camX = lerp(camX, meVisualPos.x, 0.14);
          camY = lerp(camY, meVisualPos.y, 0.14);
        } else {
          const aliveOther = Object.values(activePlayers).find((p) => p.alive);
          const targetX = aliveOther ? aliveOther.x : activeMapW / 2;
          const targetY = aliveOther ? aliveOther.y : activeMapH / 2;
          camX = lerp(camX, targetX, 0.08);
          camY = lerp(camY, targetY, 0.08);
        }

        worldContainer.scale.set(worldScale);
        const baseOffsetX = viewW / 2 - camX * worldScale;
        const baseOffsetY = viewH / 2 - camY * worldScale;

        arenaRenderer.renderMapBase(activeMapW, activeMapH, activeTheme);
        arenaRenderer.syncObstacles(
          activeObstacles,
          meVisualPos.x,
          meVisualPos.y
        );
        arenaRenderer.syncLoot(
          activeLoot,
          dtSeconds,
          me?.x,
          me?.y,
          Boolean(me && me.alive)
        );

        const lerpAlpha = Math.min(1, 0.33 * (ticker.deltaTime || 1));
        agentRenderer.sync(
          activePlayers,
          activeSessionId,
          lerpAlpha,
          localAimAngle
        );
        bulletRenderer.sync(activeBullets, dtSeconds);
        effectsManager.update(dtSeconds, worldContainer, baseOffsetX, baseOffsetY);

        // Ambiente y luz nocturna (posición en pantalla del jugador local)
        ambientFx.setTheme(activeTheme, viewW, viewH);
        ambientFx.update(
          dtSeconds,
          baseOffsetX + meVisualPos.x * worldScale,
          baseOffsetY + meVisualPos.y * worldScale
        );

        drawMinimap(
          viewW,
          activeMapW,
          activeMapH,
          activeTheme,
          activeObstacles,
          activeLoot,
          activePlayers,
          activeSessionId
        );
      });
    };

    void initPixi();

    return () => {
      destroyed = true;
      unsubHit();
      unsubCrate();
      unsubEliminated();
      resizeObserver?.disconnect();
      inputManager?.destroy();
      arenaRenderer.reset();
      agentRenderer.clear();
      bulletRenderer.clear();
      effectsManager.clear();
      ambientFx.clear();
      minimapGfx.destroy();
      if (app) {
        app.destroy(true, { children: true });
      }
    };
  }, [mode, localArenaRef]);

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full overflow-hidden bg-slate-950 cursor-crosshair select-none"
    />
  );
};
