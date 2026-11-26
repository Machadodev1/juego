import type {
  BulletBounceEvent,
  BulletState,
  MazeCell,
  MazeGrid,
  PlayerInput,
  PlayerState,
  TankDestroyedEvent,
} from "@shared/types";

interface LocalBullet extends BulletState {
  life: number;
  bouncesLeft: number;
}

interface LocalCallbacks {
  onShoot?: (x: number, y: number, angle: number, color: string) => void;
  onBounce?: (event: BulletBounceEvent) => void;
  onDestroyed?: (event: TankDestroyedEvent) => void;
}

export function generateLocalMaze(rows = 8, cols = 12, cellSize = 80): MazeGrid {
  const cells: MazeCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: MazeCell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        row: r,
        col: c,
        walls: { top: true, right: true, bottom: true, left: true },
      });
    }
    cells.push(row);
  }

  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack: Array<[number, number]> = [[0, 0]];
  visited[0][0] = true;

  const dirs: Array<{ dr: number; dc: number; a: keyof MazeCell["walls"]; b: keyof MazeCell["walls"] }> = [
    { dr: -1, dc: 0, a: "top", b: "bottom" },
    { dr: 0, dc: 1, a: "right", b: "left" },
    { dr: 1, dc: 0, a: "bottom", b: "top" },
    { dr: 0, dc: -1, a: "left", b: "right" },
  ];

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const neighbors = dirs
      .map((d) => ({ ...d, nr: r + d.dr, nc: c + d.dc }))
      .filter((n) => n.nr >= 0 && n.nr < rows && n.nc >= 0 && n.nc < cols && !visited[n.nr][n.nc]);

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
    cells[r][c].walls[chosen.a] = false;
    cells[chosen.nr][chosen.nc].walls[chosen.b] = false;
    visited[chosen.nr][chosen.nc] = true;
    stack.push([chosen.nr, chosen.nc]);
  }

  // Open a few extra walls for arcade Tank Trouble loops
  for (let i = 0; i < Math.floor((rows * cols) / 7); i++) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    const d = dirs[Math.floor(Math.random() * dirs.length)];
    const nr = r + d.dr;
    const nc = c + d.dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      cells[r][c].walls[d.a] = false;
      cells[nr][nc].walls[d.b] = false;
    }
  }

  return { rows, cols, cellSize, cells };
}

export class LocalArena {
  public maze: MazeGrid;
  public players: Record<string, PlayerState> = {};
  public bullets: Record<string, BulletState> = {};
  public readonly localId = "local-player";

  private internalBullets = new Map<string, LocalBullet>();
  private shootCooldown = 0;
  private bulletCounter = 0;
  private respawnTimers = new Map<string, number>();
  private callbacks: LocalCallbacks;
  private playerName: string;
  private playerColor: string;

  constructor(playerName: string, playerColor: string, callbacks: LocalCallbacks = {}) {
    this.playerName = playerName || "Piloto";
    this.playerColor = playerColor;
    this.callbacks = callbacks;
    this.maze = generateLocalMaze();
    this.resetEntities();
  }

  public resetMaze(): void {
    this.maze = generateLocalMaze();
    this.internalBullets.clear();
    this.bullets = {};
    this.respawnTimers.clear();
    this.resetEntities();
  }

  private resetEntities(): void {
    const s = this.maze.cellSize;
    this.players = {
      [this.localId]: {
        id: this.localId,
        name: this.playerName,
        x: s * 1.5,
        y: s * 1.5,
        angle: 0,
        color: this.playerColor,
        alive: true,
        score: 0,
        ready: true,
      },
      "dummy-1": {
        id: "dummy-1",
        name: "Objetivo Alfa",
        x: (this.maze.cols - 1.5) * s,
        y: (this.maze.rows - 1.5) * s,
        angle: Math.PI,
        color: "#EC4899",
        alive: true,
        score: 0,
        ready: true,
      },
      "dummy-2": {
        id: "dummy-2",
        name: "Objetivo Beta",
        x: (this.maze.cols - 1.5) * s,
        y: s * 1.5,
        angle: Math.PI * 0.5,
        color: "#F59E0B",
        alive: true,
        score: 0,
        ready: true,
      },
    };
  }

  public step(input: PlayerInput, dtSeconds: number): void {
    const dt = Math.min(dtSeconds, 0.05);
    const player = this.players[this.localId];

    // Respawn timers
    for (const [id, timer] of this.respawnTimers.entries()) {
      const next = timer - dt;
      if (next <= 0) {
        this.respawnTimers.delete(id);
        const target = this.players[id];
        if (target) {
          target.alive = true;
        }
      } else {
        this.respawnTimers.set(id, next);
      }
    }

    // Move local player
    if (player && player.alive) {
      const turnSpeed = 3.4;
      const moveSpeed = 195;

      if (input.left) player.angle -= turnSpeed * dt;
      if (input.right) player.angle += turnSpeed * dt;

      let dir = 0;
      if (input.up) dir += 1;
      if (input.down) dir -= 0.72;

      if (dir !== 0) {
        const nextX = player.x + Math.cos(player.angle) * moveSpeed * dir * dt;
        const nextY = player.y + Math.sin(player.angle) * moveSpeed * dir * dt;
        const resolved = this.resolveTankWallCollision(nextX, nextY, 15);
        player.x = resolved.x;
        player.y = resolved.y;
      }

      if (this.shootCooldown > 0) {
        this.shootCooldown = Math.max(0, this.shootCooldown - dt);
      }

      if (input.shoot && this.shootCooldown <= 0 && this.internalBullets.size < 6) {
        this.shootCooldown = 0.32;
        const muzzleDist = 23;
        const bx = player.x + Math.cos(player.angle) * muzzleDist;
        const by = player.y + Math.sin(player.angle) * muzzleDist;
        const speed = 340;
        const id = `lb-${++this.bulletCounter}`;

        this.internalBullets.set(id, {
          id,
          ownerId: this.localId,
          x: bx,
          y: by,
          vx: Math.cos(player.angle) * speed,
          vy: Math.sin(player.angle) * speed,
          life: 6,
          bouncesLeft: 7,
        });

        this.callbacks.onShoot?.(bx, by, player.angle, player.color);
      }
    }

    // Step bullets
    for (const [id, b] of this.internalBullets.entries()) {
      b.life -= dt;
      if (b.life <= 0) {
        this.internalBullets.delete(id);
        continue;
      }

      const steps = 3;
      const subDt = dt / steps;
      let destroyed = false;

      for (let i = 0; i < steps; i++) {
        const prevX = b.x;
        const prevY = b.y;
        b.x += b.vx * subDt;
        b.y += b.vy * subDt;

        const bounced = this.resolveBulletBounce(b, prevX, prevY, 4);
        if (bounced) {
          b.bouncesLeft -= 1;
          this.callbacks.onBounce?.({ x: b.x, y: b.y });
          if (b.bouncesLeft < 0) {
            this.internalBullets.delete(id);
            destroyed = true;
            break;
          }
        }

        // Hit check against tanks (ignore owner for first 0.15s)
        for (const tank of Object.values(this.players)) {
          if (!tank.alive) continue;
          if (tank.id === b.ownerId && b.life > 5.82) continue;

          const dx = b.x - tank.x;
          const dy = b.y - tank.y;
          if (dx * dx + dy * dy <= 18 * 18) {
            tank.alive = false;
            if (tank.id !== this.localId) {
              this.players[this.localId].score += 1;
            }
            this.respawnTimers.set(tank.id, 2.2);
            this.internalBullets.delete(id);
            this.callbacks.onDestroyed?.({
              victimId: tank.id,
              killerId: b.ownerId,
              x: tank.x,
              y: tank.y,
            });
            destroyed = true;
            break;
          }
        }
        if (destroyed) break;
      }
    }

    const nextBullets: Record<string, BulletState> = {};
    for (const [id, b] of this.internalBullets.entries()) {
      nextBullets[id] = {
        id: b.id,
        ownerId: b.ownerId,
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
      };
    }
    this.bullets = nextBullets;
  }

  private resolveTankWallCollision(x: number, y: number, radius: number): { x: number; y: number } {
    const s = this.maze.cellSize;
    const maxW = this.maze.cols * s;
    const maxH = this.maze.rows * s;

    let nx = Math.max(radius, Math.min(maxW - radius, x));
    let ny = Math.max(radius, Math.min(maxH - radius, y));

    const col = Math.max(0, Math.min(this.maze.cols - 1, Math.floor(nx / s)));
    const row = Math.max(0, Math.min(this.maze.rows - 1, Math.floor(ny / s)));
    const cell = this.maze.cells[row]?.[col];
    if (!cell) return { x: nx, y: ny };

    const left = col * s;
    const right = left + s;
    const top = row * s;
    const bottom = top + s;

    if (cell.walls.left && nx - radius < left) nx = left + radius;
    if (cell.walls.right && nx + radius > right) nx = right - radius;
    if (cell.walls.top && ny - radius < top) ny = top + radius;
    if (cell.walls.bottom && ny + radius > bottom) ny = bottom - radius;

    return { x: nx, y: ny };
  }

  private resolveBulletBounce(b: LocalBullet, prevX: number, prevY: number, radius: number): boolean {
    const s = this.maze.cellSize;
    const col = Math.max(0, Math.min(this.maze.cols - 1, Math.floor(prevX / s)));
    const row = Math.max(0, Math.min(this.maze.rows - 1, Math.floor(prevY / s)));
    const cell = this.maze.cells[row]?.[col];
    if (!cell) return false;

    const left = col * s;
    const right = left + s;
    const top = row * s;
    const bottom = top + s;

    let bounced = false;

    if (cell.walls.left && b.x - radius <= left) {
      b.x = left + radius;
      b.vx = Math.abs(b.vx);
      bounced = true;
    } else if (cell.walls.right && b.x + radius >= right) {
      b.x = right - radius;
      b.vx = -Math.abs(b.vx);
      bounced = true;
    }

    if (cell.walls.top && b.y - radius <= top) {
      b.y = top + radius;
      b.vy = Math.abs(b.vy);
      bounced = true;
    } else if (cell.walls.bottom && b.y + radius >= bottom) {
      b.y = bottom - radius;
      b.vy = -Math.abs(b.vy);
      bounced = true;
    }

    return bounced;
  }
}
