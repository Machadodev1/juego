import React, { useEffect, useRef } from "react";
import { Application, Container } from "pixi.js";
import type {
  BulletBounceEvent,
  BulletState,
  MazeGrid,
  PlayerState,
  TankDestroyedEvent,
} from "@shared/types";
import { colyseusClient } from "../network/ColyseusClient";
import { soundManager } from "../audio/SoundManager";
import { MazeRenderer } from "./MazeRenderer";
import { TankRenderer } from "./TankRenderer";
import { BulletRenderer } from "./BulletRenderer";
import { EffectsManager } from "./EffectsManager";
import { InputManager } from "./InputManager";
import { LocalArena } from "./LocalArena";

interface GameCanvasProps {
  mode: "online" | "local";
  maze: MazeGrid | null;
  players: Record<string, PlayerState>;
  bullets: Record<string, BulletState>;
  localSessionId: string;
  isPlaying: boolean;
  localArenaRef?: React.MutableRefObject<LocalArena | null>;
  onLocalScoreChange?: (players: Record<string, PlayerState>) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  maze,
  players,
  bullets,
  localSessionId,
  isPlaying,
  localArenaRef,
  onLocalScoreChange,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Keep latest props in refs so PixiJS ticker reads them without re-mounting
  const stateRef = useRef({
    maze,
    players,
    bullets,
    localSessionId,
    isPlaying,
  });
  stateRef.current = { maze, players, bullets, localSessionId, isPlaying };

  const onLocalScoreRef = useRef(onLocalScoreChange);
  onLocalScoreRef.current = onLocalScoreChange;

  useEffect(() => {
    const containerEl = hostRef.current;
    if (!containerEl) return;

    let destroyed = false;
    let app: Application | null = null;
    let inputManager: InputManager | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const worldContainer = new Container();
    const mazeRenderer = new MazeRenderer();
    const tankRenderer = new TankRenderer();
    const bulletRenderer = new BulletRenderer();
    const effectsManager = new EffectsManager();

    worldContainer.addChild(
      mazeRenderer.container,
      tankRenderer.container,
      bulletRenderer.container,
      effectsManager.container
    );

    const prevBulletIds = new Set<string>();
    let baseOffsetX = 0;
    let baseOffsetY = 0;

    const updateLayout = (currentApp: Application, currentMaze: MazeGrid | null) => {
      const viewW = containerEl.clientWidth || window.innerWidth;
      const viewH = containerEl.clientHeight || window.innerHeight;
      currentApp.renderer.resize(viewW, viewH);

      if (!currentMaze) return;
      const mazeW = currentMaze.cols * currentMaze.cellSize;
      const mazeH = currentMaze.rows * currentMaze.cellSize;
      const pad = 28;
      const scale = Math.max(
        0.25,
        Math.min((viewW - pad * 2) / mazeW, (viewH - pad * 2) / mazeH, 1.35)
      );

      worldContainer.scale.set(scale);
      baseOffsetX = (viewW - mazeW * scale) / 2;
      baseOffsetY = (viewH - mazeH * scale) / 2;
      worldContainer.position.set(baseOffsetX, baseOffsetY);
    };

    const unsubBounce = colyseusClient.onBulletBounce((ev: BulletBounceEvent) => {
      effectsManager.spawnBounceSparks(ev.x, ev.y);
      soundManager.playBounce();
    });

    const unsubDestroyed = colyseusClient.onTankDestroyed((ev: TankDestroyedEvent) => {
      const victimColor = stateRef.current.players[ev.victimId]?.color || "#EF4444";
      effectsManager.spawnExplosion(ev.x, ev.y, victimColor);
      soundManager.playExplosion();
    });

    const initPixi = async () => {
      const pixiApp = new Application();
      await pixiApp.init({
        background: "#020617",
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        width: containerEl.clientWidth || 960,
        height: containerEl.clientHeight || 640,
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

      pixiApp.stage.addChild(worldContainer);
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
            onBounce: (ev) => {
              effectsManager.spawnBounceSparks(ev.x, ev.y);
              soundManager.playBounce();
            },
            onDestroyed: (ev) => {
              const victimColor =
                localArenaRef.current?.players[ev.victimId]?.color || "#EF4444";
              effectsManager.spawnExplosion(ev.x, ev.y, victimColor);
              soundManager.playExplosion();
              if (localArenaRef.current && onLocalScoreRef.current) {
                onLocalScoreRef.current({ ...localArenaRef.current.players });
              }
            },
          }
        );
      }

      resizeObserver = new ResizeObserver(() => {
        if (!app || destroyed) return;
        const activeMaze =
          mode === "local" && localArenaRef?.current
            ? localArenaRef.current.maze
            : stateRef.current.maze;
        updateLayout(app, activeMaze);
      });
      resizeObserver.observe(containerEl);

      let lastMazeRendered: MazeGrid | null = null;
      let prevLocalScore = -1;

      pixiApp.ticker.add((ticker) => {
        const dtSeconds = ticker.deltaMS / 1000;
        const {
          maze: curMaze,
          players: curPlayers,
          bullets: curBullets,
          localSessionId: curSessionId,
          isPlaying: playing,
        } = stateRef.current;

        let activeMaze = curMaze;
        let activePlayers = curPlayers;
        let activeBullets = curBullets;
        let activeSessionId = curSessionId;

        if (mode === "local" && localArenaRef?.current) {
          const arena = localArenaRef.current;
          if (playing && inputManager) {
            const input = inputManager.pollInput();
            arena.step(input, dtSeconds);
          }
          activeMaze = arena.maze;
          activePlayers = arena.players;
          activeBullets = arena.bullets;
          activeSessionId = arena.localId;

          const score = activePlayers[arena.localId]?.score ?? 0;
          if (score !== prevLocalScore) {
            prevLocalScore = score;
            onLocalScoreRef.current?.({ ...activePlayers });
          }
        } else if (playing && inputManager) {
          const input = inputManager.pollInput();
          colyseusClient.sendInput(input);

          // Detect newly spawned bullets for muzzle flash + shoot sound
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
        }

        if (activeMaze && activeMaze !== lastMazeRendered) {
          lastMazeRendered = activeMaze;
          mazeRenderer.render(activeMaze);
          updateLayout(pixiApp, activeMaze);
        }

        const lerpAlpha = Math.min(1, 0.28 * (ticker.deltaTime || 1));
        tankRenderer.sync(activePlayers, activeSessionId, lerpAlpha);
        bulletRenderer.sync(activeBullets, dtSeconds);
        effectsManager.update(dtSeconds, worldContainer, baseOffsetX, baseOffsetY);
      });
    };

    void initPixi();

    return () => {
      destroyed = true;
      unsubBounce();
      unsubDestroyed();
      resizeObserver?.disconnect();
      inputManager?.destroy();
      mazeRenderer.reset();
      tankRenderer.clear();
      bulletRenderer.clear();
      effectsManager.clear();
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
