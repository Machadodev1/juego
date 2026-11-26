import type { MazeCell, MazeGrid } from "@shared/types";

export interface SpawnPoint {
  x: number;
  y: number;
  angle: number;
  row: number;
  col: number;
}

type Direction = "top" | "right" | "bottom" | "left";

interface Neighbor {
  row: number;
  col: number;
  dir: Direction;
  opposite: Direction;
}

const DIRECTIONS: Array<{
  dr: number;
  dc: number;
  dir: Direction;
  opposite: Direction;
}> = [
  { dr: -1, dc: 0, dir: "top", opposite: "bottom" },
  { dr: 0, dc: 1, dir: "right", opposite: "left" },
  { dr: 1, dc: 0, dir: "bottom", opposite: "top" },
  { dr: 0, dc: -1, dir: "left", opposite: "right" },
];

export class MazeGenerator {
  /**
   * Genera un laberinto procedural mediante Recursive Backtracker y abre ~12%
   * de muros internos adicionales para crear rutas tácticas y ciclos.
   */
  public static generate(
    cols: number = 12,
    rows: number = 8,
    cellSize: number = 80,
    extraOpeningRatio: number = 0.12
  ): MazeGrid {
    const cells: MazeCell[][] = [];
    const visited: boolean[][] = [];

    for (let r = 0; r < rows; r++) {
      const rowCells: MazeCell[] = [];
      const rowVisited: boolean[] = [];
      for (let c = 0; c < cols; c++) {
        rowCells.push({
          row: r,
          col: c,
          walls: {
            top: true,
            right: true,
            bottom: true,
            left: true,
          },
        });
        rowVisited.push(false);
      }
      cells.push(rowCells);
      visited.push(rowVisited);
    }

    // 1. Recursive Backtracker (DFS con pila)
    const stack: Array<{ row: number; col: number }> = [];
    const startRow = Math.floor(Math.random() * rows);
    const startCol = Math.floor(Math.random() * cols);

    visited[startRow][startCol] = true;
    stack.push({ row: startRow, col: startCol });

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const unvisitedNeighbors: Neighbor[] = [];

      for (const d of DIRECTIONS) {
        const nr = current.row + d.dr;
        const nc = current.col + d.dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
          unvisitedNeighbors.push({
            row: nr,
            col: nc,
            dir: d.dir,
            opposite: d.opposite,
          });
        }
      }

      if (unvisitedNeighbors.length > 0) {
        const chosen =
          unvisitedNeighbors[
            Math.floor(Math.random() * unvisitedNeighbors.length)
          ];
        cells[current.row][current.col].walls[chosen.dir] = false;
        cells[chosen.row][chosen.col].walls[chosen.opposite] = false;

        visited[chosen.row][chosen.col] = true;
        stack.push({ row: chosen.row, col: chosen.col });
      } else {
        stack.pop();
      }
    }

    // 2. Eliminar aleatoriamente ~12% de los muros internos restantes
    const internalWalls: Array<{
      r1: number;
      c1: number;
      dir: Direction;
      r2: number;
      c2: number;
      opposite: Direction;
    }> = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c + 1 < cols && cells[r][c].walls.right) {
          internalWalls.push({
            r1: r,
            c1: c,
            dir: "right",
            r2: r,
            c2: c + 1,
            opposite: "left",
          });
        }
        if (r + 1 < rows && cells[r][c].walls.bottom) {
          internalWalls.push({
            r1: r,
            c1: c,
            dir: "bottom",
            r2: r + 1,
            c2: c,
            opposite: "top",
          });
        }
      }
    }

    // Barajar muros internos (Fisher-Yates) y abrir el porcentaje indicado
    for (let i = internalWalls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [internalWalls[i], internalWalls[j]] = [
        internalWalls[j],
        internalWalls[i],
      ];
    }

    const wallsToRemove = Math.floor(internalWalls.length * extraOpeningRatio);
    for (let i = 0; i < wallsToRemove; i++) {
      const w = internalWalls[i];
      cells[w.r1][w.c1].walls[w.dir] = false;
      cells[w.r2][w.c2].walls[w.opposite] = false;
    }

    return {
      rows,
      cols,
      cellSize,
      cells,
    };
  }

  /**
   * Calcula puntos de aparición seguros en el centro de celdas distintas,
   * maximizando la distancia mínima entre los jugadores (greedy farthest-point sampling).
   */
  public static getSpawnPoints(maze: MazeGrid, count: number): SpawnPoint[] {
    const { rows, cols, cellSize, cells } = maze;
    const allCells: Array<{ row: number; col: number }> = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        allCells.push({ row: r, col: c });
      }
    }

    if (count <= 0 || allCells.length === 0) {
      return [];
    }

    const selectedCells: Array<{ row: number; col: number }> = [];

    // Elegir la primera celda cerca de una de las 4 esquinas al azar para maximizar dispersión
    const cornerCandidates = allCells.filter(
      (cell) =>
        (cell.row <= 1 || cell.row >= rows - 2) &&
        (cell.col <= 1 || cell.col >= cols - 2)
    );
    const pool = cornerCandidates.length > 0 ? cornerCandidates : allCells;
    const first = pool[Math.floor(Math.random() * pool.length)];
    selectedCells.push(first);

    while (selectedCells.length < count && selectedCells.length < allCells.length) {
      let bestCandidate = allCells[0];
      let bestMinDistSq = -1;

      // Recorrer todas las celdas y elegir la que maximice la distancia al spawn más cercano
      for (const candidate of allCells) {
        if (
          selectedCells.some(
            (s) => s.row === candidate.row && s.col === candidate.col
          )
        ) {
          continue;
        }

        let minDistSq = Infinity;
        for (const chosen of selectedCells) {
          const dr = candidate.row - chosen.row;
          const dc = candidate.col - chosen.col;
          const distSq = dr * dr + dc * dc;
          if (distSq < minDistSq) {
            minDistSq = distSq;
          }
        }

        // Pequeño jitter aleatorio para desempatar celdas equidistantes
        const score = minDistSq + Math.random() * 0.25;
        if (score > bestMinDistSq) {
          bestMinDistSq = score;
          bestCandidate = candidate;
        }
      }

      selectedCells.push(bestCandidate);
    }

    return selectedCells.map((cell) => {
      const cellData = cells[cell.row][cell.col];
      // Orientar inicialmente el tanque hacia una salida abierta de la celda
      const openAngles: number[] = [];
      if (!cellData.walls.right) openAngles.push(0);
      if (!cellData.walls.bottom) openAngles.push(Math.PI / 2);
      if (!cellData.walls.left) openAngles.push(Math.PI);
      if (!cellData.walls.top) openAngles.push(-Math.PI / 2);

      const angle =
        openAngles.length > 0
          ? openAngles[Math.floor(Math.random() * openAngles.length)]
          : 0;

      return {
        row: cell.row,
        col: cell.col,
        x: cell.col * cellSize + cellSize / 2,
        y: cell.row * cellSize + cellSize / 2,
        angle,
      };
    });
  }
}
