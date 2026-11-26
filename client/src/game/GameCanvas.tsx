import React, { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import type {
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
import { ArenaRenderer } from "./ArenaRenderer";
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
  modifier: RoundModifier;
  obstacles: Record<string, ObstacleState>;
  lootItems: Record<string, LootItemState>;
  players: Record<string, PlayerState>;
  bullets: Record<string, BulletState>;
  localSessionId: string;
  isPlaying: boolean;
  localArenaRef?: React.MutableRefObject<LocalArena | null>;
  onLocalStateSync?: (
    players: Record<string, PlayerState>,
    modifier: RoundModifier
  ) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  mapWidth,
  mapHeight,
  modifier,
  obstacles,
  lootItems,
  players,
  bullets,
  localSessionId,
  isPlaying,
  localArenaRef,
  onLocalStateSync,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    mapWidth,
    mapHeight,
    modifier,
    obstacles,
    lootItems,
    players,
    bullets,
    localSessionId,
    isPlaying,
  });
  stateRef.current = {
    mapWidth,
    mapHeight,
    modifier,
    obstacles,
    lootItems,
    players,
    bullets,
    localSessionId,
    isPlaying,
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
    const soldierRenderer = new TankRenderer();
    const bulletRenderer = new BulletRenderer();
    const effectsManager = new EffectsManager();

    worldContainer.addChild(
      arenaRenderer.groundContainer,
      arenaRenderer.lootContainer,
      arenaRenderer.obstacleContainer,
      soldierRenderer.container,
      bulletRenderer.container,
      effectsManager.container,
      arenaRenderer.canopyContainer
    );

    const prevBulletIds = new Set<string>();
    const prevLootIds = new Set<string>();
    let camX = mapWidth / 2;
    let camY = mapHeight / 2;

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
      activeObstacles: Record<string, ObstacleState>,
      activeLoot: Record<string, LootItemState>,
      activePlayers: Record<string, PlayerState>,
      meId: string
    ) => {
      const miniW = 164;
      const miniH = Math.round(miniW * (mH / mW));
      minimapContainer.position.set(viewW - miniW - 16, 68);

      minimapGfx.clear();
      minimapGfx
        .roundRect(0, 0, miniW, miniH, 8)
        .fill({ color: 0x0f172a, alpha: 0.72 });
      minimapGfx
        .roundRect(0, 0, miniW, miniH, 8)
        .stroke({ width: 2, color: 0x334155, alpha: 0.9 });

      const sx = miniW / mW;
      const sy = miniH / mH;

      for (const obs of Object.values(activeObstacles)) {
        const color =
          obs.type === "rock"
            ? 0x94a3b8
            : obs.type === "crate"
            ? 0xd97706
            : 0x22c55e;
        minimapGfx
          .circle(obs.x * sx, obs.y * sy, Math.max(1.8, obs.radius * sx))
          .fill({ color, alpha: 0.75 });
      }

      for (const item of Object.values(activeLoot)) {
        minimapGfx
          .circle(item.x * sx, item.y * sy, 2.3)
          .fill({ color: item.kind === "medkit" ? 0x4ade80 : 0x38bdf8, alpha: 0.95 });
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
        background: "#2a4218",
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

      pixiApp.stage.addChild(worldContainer, minimapContainer);
      inputManager = new InputManager(pixiApp.canvas);

      if (mode === "local" && localArenaRef && !localArenaRef.current) {
        const localPlayer = Object.values(stateRef.current.players)[0];
        localArenaRef.current = new LocalArena(
          localPlayer?.name || "Piloto",
          localPlayer?.color || "#22D3EE",
          {
            onShoot: (x, y, angle, color) => {
              effectsManager.spawnMuzzleFlash(x, y, angle, color);
              soundManager.playShoot();
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
          }
        );
        onLocalSyncRef.current?.(
          { ...localArenaRef.current.players },
          localArenaRef.current.modifier
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
        let activeObstacles = stateRef.current.obstacles;
        let activeLoot = stateRef.current.lootItems;
        let activePlayers = stateRef.current.players;
        let activeBullets = stateRef.current.bullets;
        let activeSessionId = stateRef.current.localSessionId;
        const playing = stateRef.current.isPlaying;

        if (mode === "local" && localArenaRef?.current) {
          const arena = localArenaRef.current;
          activeMapW = arena.mapWidth;
          activeMapH = arena.mapHeight;
          activeSessionId = arena.localId;

          const meVisual =
            soldierRenderer.getVisualPosition(activeSessionId) ||
            arena.players[activeSessionId] || { x: 800, y: 600 };

          const worldScale = Math.max(0.75, Math.min(viewW / 1280, 1.15));
          const offsetX = viewW / 2 - camX * worldScale;
          const offsetY = viewH / 2 - camY * worldScale;

          let localAimAngle: number | undefined;
          if (playing && inputManager) {
            const input = inputManager.pollInput(
              meVisual.x,
              meVisual.y,
              offsetX,
              offsetY,
              worldScale
            );
            localAimAngle = input.angle;
            arena.step(input, dtSeconds);
          }

          activeObstacles = arena.obstacles;
          activeLoot = arena.lootItems;
          activePlayers = arena.players;
          activeBullets = arena.bullets;

          hudSyncAccum += dtSeconds;
          if (hudSyncAccum >= 0.1) {
            hudSyncAccum = 0;
            onLocalSyncRef.current?.({ ...arena.players }, arena.modifier);
          }

          arenaRenderer.renderMapBase(activeMapW, activeMapH);
          const me = activePlayers[activeSessionId];
          arenaRenderer.syncObstacles(activeObstacles, me?.x, me?.y);
          arenaRenderer.syncLoot(activeLoot, dtSeconds);

          if (me && me.alive) {
            camX = lerp(camX, me.x, 0.14);
            camY = lerp(camY, me.y, 0.14);
          }

          worldContainer.scale.set(worldScale);
          const finalBaseX = viewW / 2 - camX * worldScale;
          const finalBaseY = viewH / 2 - camY * worldScale;

          const lerpAlpha = Math.min(1, 0.35 * (ticker.deltaTime || 1));
          soldierRenderer.sync(
            activePlayers,
            activeSessionId,
            lerpAlpha,
            localAimAngle
          );
          bulletRenderer.sync(activeBullets, dtSeconds);
          effectsManager.update(dtSeconds, worldContainer, finalBaseX, finalBaseY);
          drawMinimap(
            viewW,
            activeMapW,
            activeMapH,
            activeObstacles,
            activeLoot,
            activePlayers,
            activeSessionId
          );
          return;
        }

        // Modo Online Autoritativo
        const worldScale = Math.max(0.75, Math.min(viewW / 1280, 1.15));
        const me = activePlayers[activeSessionId];
        const meVisual =
          soldierRenderer.getVisualPosition(activeSessionId) ||
          me || { x: activeMapW / 2, y: activeMapH / 2 };

        if (me && me.alive) {
          camX = lerp(camX, meVisual.x, 0.14);
          camY = lerp(camY, meVisual.y, 0.14);
        } else {
          // Seguir a un sobreviviente si fuimos eliminados
          const aliveOther = Object.values(activePlayers).find((p) => p.alive);
          const targetX = aliveOther ? aliveOther.x : activeMapW / 2;
          const targetY = aliveOther ? aliveOther.y : activeMapH / 2;
          camX = lerp(camX, targetX, 0.08);
          camY = lerp(camY, targetY, 0.08);
        }

        const baseOffsetX = viewW / 2 - camX * worldScale;
        const baseOffsetY = viewH / 2 - camY * worldScale;
        worldContainer.scale.set(worldScale);

        let localAimAngle: number | undefined;
        if (playing && inputManager && me && me.alive) {
          const input = inputManager.pollInput(
            meVisual.x,
            meVisual.y,
            baseOffsetX,
            baseOffsetY,
            worldScale
          );
          localAimAngle = input.angle;
          colyseusClient.sendInput(input);
        }

        // Sonido y destello al detectar nuevos proyectiles en línea
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
            soundManager.playShoot();
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

        arenaRenderer.renderMapBase(activeMapW, activeMapH);
        arenaRenderer.syncObstacles(activeObstacles, meVisual.x, meVisual.y);
        arenaRenderer.syncLoot(activeLoot, dtSeconds);

        const lerpAlpha = Math.min(1, 0.32 * (ticker.deltaTime || 1));
        soldierRenderer.sync(
          activePlayers,
          activeSessionId,
          lerpAlpha,
          localAimAngle
        );
        bulletRenderer.sync(activeBullets, dtSeconds);
        effectsManager.update(dtSeconds, worldContainer, baseOffsetX, baseOffsetY);
        drawMinimap(
          viewW,
          activeMapW,
          activeMapH,
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
      soldierRenderer.clear();
      bulletRenderer.clear();
      effectsManager.clear();
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
