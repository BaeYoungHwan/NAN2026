import { describe, expect, it } from "vitest";
import type { Round } from "../core/round";
import { isReachable } from "./reachability";
import { DEFAULT_SEED, computeCheckpoints, generateStage, seedForRound } from "./stageGenerator";

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

  it("세이브 포인트(체크포인트)가 스테이지당 정해진 개수만큼 생성되고 모두 walkable하다", () => {
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

  it("path는 스폰에서 시작해 골로 끝난다 — 진척도(라운드) 판정의 기준", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(stage.path[0]).toEqual(stage.spawn);
    expect(stage.path[stage.path.length - 1]).toEqual(stage.goal);
  });

  it("checkpointPathIndices가 가리키는 path 지점이 checkpoints 좌표와 일치한다", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(stage.checkpointPathIndices.length).toBe(stage.checkpoints.length);
    stage.checkpointPathIndices.forEach((idx, i) => {
      expect(stage.path[idx]).toEqual(stage.checkpoints[i]);
    });
  });

  it("checkpointPathIndices는 오름차순이다 — 라운드 진척도가 뒤로 가지 않으려면 필요", () => {
    const stage = generateStage(DEFAULT_SEED);
    for (let i = 1; i < stage.checkpointPathIndices.length; i++) {
      expect(stage.checkpointPathIndices[i]).toBeGreaterThan(stage.checkpointPathIndices[i - 1]);
    }
  });
});

describe("seedForRound", () => {
  it("1R 시드는 베이스 시드와 같다 — 기존 generateStage(DEFAULT_SEED) 호출부와 호환", () => {
    expect(seedForRound(DEFAULT_SEED, 1)).toBe(DEFAULT_SEED);
  });

  it("같은 base+round는 항상 같은 시드를 만든다 (결정론)", () => {
    expect(seedForRound(DEFAULT_SEED, 2)).toBe(seedForRound(DEFAULT_SEED, 2));
    expect(seedForRound(DEFAULT_SEED, 3)).toBe(seedForRound(DEFAULT_SEED, 3));
  });

  it("라운드별로 서로 다른 시드를 만든다", () => {
    const s1 = seedForRound(DEFAULT_SEED, 1);
    const s2 = seedForRound(DEFAULT_SEED, 2);
    const s3 = seedForRound(DEFAULT_SEED, 3);
    expect(new Set([s1, s2, s3]).size).toBe(3);
  });

  it("라운드별로 파생된 시드는 서로 다른 스테이지를 만든다", () => {
    const stage1 = generateStage(seedForRound(DEFAULT_SEED, 1));
    const stage2 = generateStage(seedForRound(DEFAULT_SEED, 2));
    expect(Array.from(stage1.grid.cells)).not.toEqual(Array.from(stage2.grid.cells));
  });
});

describe("generateStage — 여러 시드 전수 검증 (라운드별 재생성 시나리오 대응)", () => {
  it("1~200 시드 각각에 대해 스폰→체크포인트→골까지 항상 도달 가능하고 서로 겹치지 않는다", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const stage = generateStage(seed);
      const points = [stage.spawn, ...stage.checkpoints, stage.goal];
      for (let i = 0; i < points.length - 1; i++) {
        expect(isReachable(stage.grid, points[i], points[i + 1])).toBe(true);
      }
      expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(points.length);
    }
  });

  it("seedForRound로 파생된 라운드별 시드도(1~50 베이스) 항상 스폰→골 도달 가능하다", () => {
    const rounds: Round[] = [1, 2, 3];
    for (let base = 1; base <= 50; base++) {
      for (const round of rounds) {
        const stage = generateStage(seedForRound(base, round));
        expect(isReachable(stage.grid, stage.spawn, stage.goal)).toBe(true);
      }
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
