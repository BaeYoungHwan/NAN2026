import { describe, expect, it } from "vitest";
import type { TileGrid } from "../core/stage";
import { createGridCollider } from "./collider";

function makeGrid(rows: string[], tileSize = 40): TileGrid {
  const cols = rows[0].length;
  const cells = new Uint8Array(cols * rows.length);
  rows.forEach((rowStr, row) => {
    for (let col = 0; col < cols; col++) {
      cells[row * cols + col] = rowStr[col] === "#" ? 1 : 0;
    }
  });
  return { cols, rows: rows.length, tileSize, cells };
}

describe("createGridCollider", () => {
  it("walkable 셀 중앙은 점유 가능하다", () => {
    const grid = makeGrid([".....", ".....", "....."]);
    const canOccupy = createGridCollider(grid, 10);
    expect(canOccupy({ x: 100, y: 60 })).toBe(true);
  });

  it("벽 셀과 겹치면 점유 불가능하다", () => {
    const grid = makeGrid(["..#..", "..#..", "..#.."]);
    const canOccupy = createGridCollider(grid, 10);
    // col=2 전체가 벽 (x: 80~120)
    expect(canOccupy({ x: 100, y: 60 })).toBe(false);
  });

  it("반지름을 고려해 벽에 너무 가까우면 점유 불가능하다", () => {
    const grid = makeGrid(["..#..", "..#..", "..#.."]);
    const canOccupy = createGridCollider(grid, 15);
    // col=1의 오른쪽 끝(x=80)에서 반지름 15만큼 벽(col=2, x>=80) 쪽으로 침범
    expect(canOccupy({ x: 75, y: 60 })).toBe(false);
  });

  it("그리드 범위 밖은 벽으로 취급한다", () => {
    const grid = makeGrid([".....", ".....", "....."]);
    const canOccupy = createGridCollider(grid, 10);
    expect(canOccupy({ x: -50, y: 60 })).toBe(false);
  });
});
