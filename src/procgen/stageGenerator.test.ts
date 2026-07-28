import { describe, expect, it } from "vitest";
import { isReachable } from "./reachability";
import { DEFAULT_SEED, computeCheckpoints, generateStage } from "./stageGenerator";

function isWalkable(stage: ReturnType<typeof generateStage>, point: { x: number; y: number }): boolean {
  const col = Math.floor(point.x / stage.grid.tileSize);
  const row = Math.floor(point.y / stage.grid.tileSize);
  return stage.grid.cells[row * stage.grid.cols + col] === 0;
}

describe("generateStage", () => {
  it("스폰과 골이 walkable 셀 안에 있다", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(isWalkable(stage, stage.spawn)).toBe(true);
    expect(isWalkable(stage, stage.goal)).toBe(true);
  });

  it("세이브 포인트(체크포인트)가 라운드 수-1개만큼 생성되고 모두 walkable하다", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(stage.checkpoints.length).toBe(2);
    for (const checkpoint of stage.checkpoints) {
      expect(isWalkable(stage, checkpoint)).toBe(true);
    }
  });

  it("체크포인트는 서로, 그리고 스폰·골과도 겹치지 않는다", () => {
    const stage = generateStage(DEFAULT_SEED);
    const points = [stage.spawn, ...stage.checkpoints, stage.goal];
    const unique = new Set(points.map((p) => `${p.x},${p.y}`));
    expect(unique.size).toBe(points.length);
  });

  it("스폰에서 골까지 walkable 경로로 도달 가능하다", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(isReachable(stage.grid, stage.spawn, stage.goal)).toBe(true);
  });

  it("같은 시드는 항상 같은 스테이지를 만든다 (재현성)", () => {
    const a = generateStage(DEFAULT_SEED);
    const b = generateStage(DEFAULT_SEED);
    expect(a.spawn).toEqual(b.spawn);
    expect(a.goal).toEqual(b.goal);
    expect(a.checkpoints).toEqual(b.checkpoints);
    expect(a.lightSources).toEqual(b.lightSources);
    expect(Array.from(a.grid.cells)).toEqual(Array.from(b.grid.cells));
  });

  it("다른 시드는 다른 스테이지를 만든다", () => {
    const a = generateStage(1);
    const b = generateStage(2);
    expect(Array.from(a.grid.cells)).not.toEqual(Array.from(b.grid.cells));
  });

  it("어떤 광원도 스폰·골 지점과 겹치지 않는다 (광원이 벽 셀에 배치되므로 walkable 지점과는 구조적으로 겹칠 수 없다)", () => {
    const stage = generateStage(DEFAULT_SEED);
    for (const light of stage.lightSources) {
      expect(`${light.x},${light.y}`).not.toBe(`${stage.spawn.x},${stage.spawn.y}`);
      expect(`${light.x},${light.y}`).not.toBe(`${stage.goal.x},${stage.goal.y}`);
    }
  });

  it("광원(가로등)이 최소 하나 이상 배치되고 모두 캔버스 폭 안에 있다", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(stage.lightSources.length).toBeGreaterThan(0);
    for (const light of stage.lightSources) {
      expect(light.x).toBeGreaterThanOrEqual(0);
      expect(light.x).toBeLessThanOrEqual(800);
    }
  });

  it("광원(가로등)은 벽 셀 위에 배치되어 캐릭터가 물리적으로 닿을 수 없다", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(stage.lightSources.length).toBeGreaterThan(0);
    for (const light of stage.lightSources) {
      expect(isWalkable(stage, light)).toBe(false);
    }
  });
});

describe("computeCheckpoints", () => {
  const tileSize = 40;
  const cell = (col: number) => ({ col, row: 0 });

  it("경로가 충분히 길면(4칸 이상) 체크포인트가 서로 겹치지 않는다", () => {
    const path = [0, 1, 2, 3].map(cell);
    const points = computeCheckpoints(tileSize, path);
    expect(points[0]).not.toEqual(points[1]);
  });

  it("알려진 한계: 경로가 3칸 이하면 체크포인트가 겹칠 수 있다 (MIN_SPAN_CELLS 게이트로 실사용 차단)", () => {
    const path = [0, 1, 2].map(cell);
    const points = computeCheckpoints(tileSize, path);
    expect(points[0]).toEqual(points[1]); // 현재 알려진 동작 — 개선 아님, 회귀 감지용
  });
});
