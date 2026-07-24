import { describe, expect, it } from "vitest";
import type { TileGrid } from "../core/stage";
import { selectBlockedCells, type VisitCounts } from "./pathBlocker";

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

describe("selectBlockedCells", () => {
  it("방문 빈도가 높은 셀을 우선 선택한다", () => {
    // 3x1 우회 가능한 격자: 위/아래 두 줄이 있어 한쪽을 막아도 반대쪽으로 갈 수 있다.
    const grid = makeGrid([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    const visits: VisitCounts = new Map([
      ["1,0", 10], // 자주 지나간 셀
      ["1,1", 1], // 거의 안 지나간 셀
    ]);
    const blocked = selectBlockedCells(visits, grid, [cellCenter(0, 0), cellCenter(2, 0)], 1);
    expect(blocked).toEqual([cellCenter(1, 0)]);
  });

  it("protectedCells(스폰·체크포인트·골)는 절대 막지 않는다", () => {
    const grid = makeGrid([[0, 0, 0]]);
    const spawn = cellCenter(0, 0);
    const goal = cellCenter(2, 0);
    const visits: VisitCounts = new Map([
      ["0,0", 100], // 스폰
      ["2,0", 100], // 골
    ]);
    const blocked = selectBlockedCells(visits, grid, [spawn, goal], 5);
    expect(blocked).toEqual([]);
  });

  it("차단 시 도달 불가능해지는 셀은 건너뛴다 (단일 경로 보호)", () => {
    // 1x3 일직선 통로 — 가운데를 막으면 스폰-골이 완전히 끊긴다.
    const grid = makeGrid([[0, 0, 0]]);
    const spawn = cellCenter(0, 0);
    const goal = cellCenter(2, 0);
    const visits: VisitCounts = new Map([["1,0", 50]]);
    const blocked = selectBlockedCells(visits, grid, [spawn, goal], 5);
    expect(blocked).toEqual([]);
  });

  it("조건을 만족하는 셀이 maxBlocks보다 적으면 그만큼만 반환한다", () => {
    const grid = makeGrid([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    const visits: VisitCounts = new Map([["1,0", 5]]);
    const blocked = selectBlockedCells(visits, grid, [cellCenter(0, 0), cellCenter(2, 0)], 5);
    expect(blocked.length).toBe(1);
  });
});
