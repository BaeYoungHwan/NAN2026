import { describe, expect, it } from "vitest";
import { DEFAULT_SEED, generateStage } from "./stageGenerator";

function isWalkable(stage: ReturnType<typeof generateStage>, point: { x: number; y: number }): boolean {
  const col = Math.floor(point.x / stage.grid.tileSize);
  const row = Math.floor(point.y / stage.grid.tileSize);
  return stage.grid.cells[row * stage.grid.cols + col] === 0;
}

/** BFS로 스폰에서 골까지 walkable 셀만 지나서 도달 가능한지 확인한다. */
function isReachable(stage: ReturnType<typeof generateStage>): boolean {
  const { grid } = stage;
  const startCol = Math.floor(stage.spawn.x / grid.tileSize);
  const startRow = Math.floor(stage.spawn.y / grid.tileSize);
  const goalCol = Math.floor(stage.goal.x / grid.tileSize);
  const goalRow = Math.floor(stage.goal.y / grid.tileSize);

  const visited = new Set<number>([startRow * grid.cols + startCol]);
  const queue: Array<[number, number]> = [[startCol, startRow]];

  while (queue.length > 0) {
    const [col, row] = queue.shift()!;
    if (col === goalCol && row === goalRow) return true;

    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nc >= grid.cols || nr < 0 || nr >= grid.rows) continue;
      const key = nr * grid.cols + nc;
      if (visited.has(key)) continue;
      if (grid.cells[key] === 1) continue;
      visited.add(key);
      queue.push([nc, nr]);
    }
  }

  return false;
}

describe("generateStage", () => {
  it("스폰과 골이 walkable 셀 안에 있다", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(isWalkable(stage, stage.spawn)).toBe(true);
    expect(isWalkable(stage, stage.goal)).toBe(true);
  });

  it("스폰에서 골까지 walkable 경로로 도달 가능하다", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(isReachable(stage)).toBe(true);
  });

  it("같은 시드는 항상 같은 스테이지를 만든다 (재현성)", () => {
    const a = generateStage(DEFAULT_SEED);
    const b = generateStage(DEFAULT_SEED);
    expect(a.spawn).toEqual(b.spawn);
    expect(a.goal).toEqual(b.goal);
    expect(a.lightPos).toEqual(b.lightPos);
    expect(Array.from(a.grid.cells)).toEqual(Array.from(b.grid.cells));
  });

  it("다른 시드는 다른 스테이지를 만든다", () => {
    const a = generateStage(1);
    const b = generateStage(2);
    expect(Array.from(a.grid.cells)).not.toEqual(Array.from(b.grid.cells));
  });

  it("광원 위치는 캔버스 폭 안에 있다", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(stage.lightPos.x).toBeGreaterThanOrEqual(0);
    expect(stage.lightPos.x).toBeLessThanOrEqual(800);
  });
});
