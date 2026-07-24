import { describe, expect, it } from "vitest";
import type { TileGrid } from "../core/stage";
import { isReachable } from "./reachability";

const tileSize = 40;

function makeGrid(rows: number[][]): TileGrid {
  const gridRows = rows.length;
  const cols = rows[0].length;
  const cells = new Uint8Array(cols * gridRows);
  rows.forEach((row, r) => row.forEach((cell, c) => (cells[r * cols + c] = cell)));
  return { cols, rows: gridRows, tileSize, cells };
}

function cellCenter(col: number, row: number) {
  return { x: (col + 0.5) * tileSize, y: (row + 0.5) * tileSize };
}

describe("isReachable", () => {
  it("일직선 통로면 도달 가능하다", () => {
    const grid = makeGrid([[0, 0, 0, 0]]);
    expect(isReachable(grid, cellCenter(0, 0), cellCenter(3, 0))).toBe(true);
  });

  it("중간이 벽으로 막히면 도달 불가능하다", () => {
    const grid = makeGrid([[0, 1, 0, 0]]);
    expect(isReachable(grid, cellCenter(0, 0), cellCenter(3, 0))).toBe(false);
  });

  it("우회로가 있으면 도달 가능하다", () => {
    const grid = makeGrid([
      [0, 1, 0],
      [0, 0, 0],
      [0, 1, 0],
    ]);
    expect(isReachable(grid, cellCenter(0, 0), cellCenter(2, 0))).toBe(true);
  });

  it("시작점과 도착점이 같으면(그 셀이 walkable이면) 도달 가능하다", () => {
    const grid = makeGrid([[0]]);
    expect(isReachable(grid, cellCenter(0, 0), cellCenter(0, 0))).toBe(true);
  });

  it("시작점(=도착점)이 벽이면 도달 불가능하다", () => {
    const grid = makeGrid([[1]]);
    expect(isReachable(grid, cellCenter(0, 0), cellCenter(0, 0))).toBe(false);
  });

  it("시작점이나 도착점 자체가 벽이면 도달 불가능하다", () => {
    const grid = makeGrid([[0, 1, 0]]);
    expect(isReachable(grid, cellCenter(1, 0), cellCenter(2, 0))).toBe(false);
    expect(isReachable(grid, cellCenter(0, 0), cellCenter(1, 0))).toBe(false);
  });
});
