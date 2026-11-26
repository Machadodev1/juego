import { Container, Graphics } from "pixi.js";
import type { MazeGrid } from "@shared/types";

export class MazeRenderer {
  public readonly container = new Container();
  private floorGfx = new Graphics();
  private gridGfx = new Graphics();
  private wallsGfx = new Graphics();
  private lastMazeRef: MazeGrid | null = null;

  constructor() {
    this.container.addChild(this.floorGfx, this.gridGfx, this.wallsGfx);
  }

  public render(maze: MazeGrid | null): void {
    if (!maze || maze === this.lastMazeRef) return;
    this.lastMazeRef = maze;

    const width = maze.cols * maze.cellSize;
    const height = maze.rows * maze.cellSize;

    // 1. Dark floor
    this.floorGfx.clear();
    this.floorGfx
      .roundRect(0, 0, width, height, 6)
      .fill({ color: 0x0f172a, alpha: 1 });

    // 2. Subtle grid
    this.gridGfx.clear();
    for (let r = 1; r < maze.rows; r++) {
      const y = r * maze.cellSize;
      this.gridGfx
        .moveTo(0, y)
        .lineTo(width, y)
        .stroke({ width: 1, color: 0x1e293b, alpha: 0.7 });
    }
    for (let c = 1; c < maze.cols; c++) {
      const x = c * maze.cellSize;
      this.gridGfx
        .moveTo(x, 0)
        .lineTo(x, height)
        .stroke({ width: 1, color: 0x1e293b, alpha: 0.7 });
    }

    // 3. Collect unique wall segments so shared edges aren't overdrawn
    const segments: Array<[number, number, number, number]> = [];
    const seen = new Set<string>();

    const addSeg = (x1: number, y1: number, x2: number, y2: number) => {
      const key =
        x1 < x2 || (x1 === x2 && y1 < y2)
          ? `${x1},${y1}-${x2},${y2}`
          : `${x2},${y2}-${x1},${y1}`;
      if (!seen.has(key)) {
        seen.add(key);
        segments.push([x1, y1, x2, y2]);
      }
    };

    const s = maze.cellSize;
    for (let r = 0; r < maze.rows; r++) {
      const row = maze.cells[r];
      if (!row) continue;
      for (let c = 0; c < maze.cols; c++) {
        const cell = row[c];
        if (!cell) continue;
        const x = c * s;
        const y = r * s;
        if (cell.walls.top) addSeg(x, y, x + s, y);
        if (cell.walls.right) addSeg(x + s, y, x + s, y + s);
        if (cell.walls.bottom) addSeg(x, y + s, x + s, y + s);
        if (cell.walls.left) addSeg(x, y, x, y + s);
      }
    }

    this.wallsGfx.clear();

    // Outer neon glow
    for (const [x1, y1, x2, y2] of segments) {
      this.wallsGfx.moveTo(x1, y1).lineTo(x2, y2);
    }
    this.wallsGfx.stroke({ width: 10, color: 0x06b6d4, alpha: 0.2, cap: "round" });

    // Mid neon glow
    for (const [x1, y1, x2, y2] of segments) {
      this.wallsGfx.moveTo(x1, y1).lineTo(x2, y2);
    }
    this.wallsGfx.stroke({ width: 5, color: 0x22d3ee, alpha: 0.55, cap: "round" });

    // Bright core
    for (const [x1, y1, x2, y2] of segments) {
      this.wallsGfx.moveTo(x1, y1).lineTo(x2, y2);
    }
    this.wallsGfx.stroke({ width: 2.5, color: 0xcffafe, alpha: 0.98, cap: "round" });
  }

  public reset(): void {
    this.lastMazeRef = null;
    this.floorGfx.clear();
    this.gridGfx.clear();
    this.wallsGfx.clear();
  }
}
