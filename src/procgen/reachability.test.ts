import { describe, expect, it } from "vitest";
import type { TileGrid } from "../core/stage";
import { bfsDistances, isReachable } from "./reachability";

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

describe("bfsDistances", () => {
  it("일직선 통로에서는 셀 인덱스 차이만큼의 거리를 갖는다", () => {
    const grid = makeGrid([[0, 0, 0, 0]]);
    const distances = bfsDistances(grid, cellCenter(0, 0));
    expect(Array.from(distances)).toEqual([0, 1, 2, 3]);
  });

  it("벽 건너편의 기하학적으로 가까운 셀도 실제 통로 거리로 계산한다 — 벽을 뛰어넘지 않는다", () => {
    // (0,0)과 (2,0)은 유클리드로 2칸(80px)밖에 안 떨어져 있지만, 가운데 열이 막혀 있어
    // 실제로는 아래로 돌아가야 한다 — nearestPathIndex가 벽을 무시해 오판하던 문제를
    // bfsDistances가 구조적으로 재발 불가능하게 만드는지 직접 검증한다.
    const grid = makeGrid([
      [0, 1, 0],
      [0, 1, 0],
      [0, 0, 0],
    ]);
    const distances = bfsDistances(grid, cellCenter(0, 0));
    expect(distances[0 * 3 + 2]).toBe(6); // 유클리드 2칸이지만 실제 경로는 6스텝 우회
  });

  it("시작점이 벽이면 모든 셀이 -1이다", () => {
    const grid = makeGrid([[1, 0, 0]]);
    const distances = bfsDistances(grid, cellCenter(0, 0));
    expect(Array.from(distances)).toEqual([-1, -1, -1]);
  });

  it("연결되지 않은 영역의 셀은 -1이다", () => {
    const grid = makeGrid([
      [0, 1, 0],
      [1, 1, 1],
    ]);
    const distances = bfsDistances(grid, cellCenter(0, 0));
    expect(distances[0 * 3 + 2]).toBe(-1); // (2,0) — 벽으로 완전히 분리됨
  });
});
