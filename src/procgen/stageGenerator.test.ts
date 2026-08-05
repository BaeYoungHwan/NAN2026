import { describe, expect, it } from "vitest";
import type { Round } from "../core/round";
import { bfsDistances, isReachable } from "./reachability";
import { DEFAULT_SEED, generateStage, seedForRound } from "./stageGenerator";

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

  it("세이브 포인트(체크포인트)가 스테이지당 1개 생성되고 walkable하다", () => {
    const stage = generateStage(DEFAULT_SEED);
    expect(stage.checkpoints.length).toBe(1);
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
    expect(Array.from(a.distanceField)).toEqual(Array.from(b.distanceField));
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

  it("체크포인트는 스폰→골 최단 경로 위에 있다 — 골로 가는 길목에 놓이게 하는 배치 조건", () => {
    // 구현(최단 경로 역추적)을 그대로 재사용하지 않고, "스폰→CP 거리 + CP→골
    // 거리 == 스폰→골 거리"라는 최단 경로의 정의로 독립 검증한다.
    const stage = generateStage(DEFAULT_SEED);
    stage.checkpoints.forEach((checkpoint, i) => {
      const fromCheckpoint = bfsDistances(stage.grid, checkpoint);
      const goalCol = Math.floor(stage.goal.x / stage.grid.tileSize);
      const goalRow = Math.floor(stage.goal.y / stage.grid.tileSize);
      const checkpointToGoal = fromCheckpoint[goalRow * stage.grid.cols + goalCol];
      expect(stage.checkpointProgress[i] + checkpointToGoal).toBe(stage.goalProgress);
    });
  });

  it("1~200 시드에서도 체크포인트가 항상 최단 경로 위에 있다", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const stage = generateStage(seed);
      const goalCol = Math.floor(stage.goal.x / stage.grid.tileSize);
      const goalRow = Math.floor(stage.goal.y / stage.grid.tileSize);
      stage.checkpoints.forEach((checkpoint, i) => {
        const fromCheckpoint = bfsDistances(stage.grid, checkpoint);
        const checkpointToGoal = fromCheckpoint[goalRow * stage.grid.cols + goalCol];
        expect(stage.checkpointProgress[i] + checkpointToGoal).toBe(stage.goalProgress);
      });
    }
  });

  it("스폰 셀의 distanceField 값은 0이다", () => {
    const stage = generateStage(DEFAULT_SEED);
    const col = Math.floor(stage.spawn.x / stage.grid.tileSize);
    const row = Math.floor(stage.spawn.y / stage.grid.tileSize);
    expect(stage.distanceField[row * stage.grid.cols + col]).toBe(0);
  });

  it("checkpointProgress/goalProgress는 checkpoints/goal 좌표의 distanceField 값과 일치한다", () => {
    const stage = generateStage(DEFAULT_SEED);
    stage.checkpoints.forEach((checkpoint, i) => {
      const col = Math.floor(checkpoint.x / stage.grid.tileSize);
      const row = Math.floor(checkpoint.y / stage.grid.tileSize);
      expect(stage.checkpointProgress[i]).toBe(stage.distanceField[row * stage.grid.cols + col]);
    });
    const goalCol = Math.floor(stage.goal.x / stage.grid.tileSize);
    const goalRow = Math.floor(stage.goal.y / stage.grid.tileSize);
    expect(stage.goalProgress).toBe(stage.distanceField[goalRow * stage.grid.cols + goalCol]);
  });

  it("checkpointProgress/goalProgress는 항상 0보다 크고 오름차순이다 — nearestPathIndex가 벽을 무시해 순서가 뒤바뀌던 문제의 재발 방지", () => {
    const stage = generateStage(DEFAULT_SEED);
    let previous = 0;
    for (const progress of stage.checkpointProgress) {
      expect(progress).toBeGreaterThan(previous);
      previous = progress;
    }
    expect(stage.goalProgress).toBeGreaterThan(previous);
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

  it("1~200 시드 각각에서 path의 각 지점(carve 순서 인덱스 i)의 BFS 진행도는 i를 넘지 않는다", () => {
    // carve 순서 경로 자체가 스폰→해당 셀까지의 유효한 i-스텝 걷기이므로, BFS
    // 최단거리(distanceField)는 정의상 i 이하여야 한다 — nearestPathIndex가
    // 벽을 무시해 이 불변조건 없이도 먼 인덱스를 "가깝다"고 오판하던 문제를
    // distanceField 기반 판정이 구조적으로 막는지 실제 시드로 검증한다.
    for (let seed = 1; seed <= 200; seed++) {
      const stage = generateStage(seed);
      stage.path.forEach((point, i) => {
        const col = Math.floor(point.x / stage.grid.tileSize);
        const row = Math.floor(point.y / stage.grid.tileSize);
        expect(stage.distanceField[row * stage.grid.cols + col]).toBeLessThanOrEqual(i);
      });
    }
  });

  it("1~200 시드 각각에서 checkpointProgress/goalProgress가 항상 오름차순이다 (재시도 게이트 실측 검증)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const stage = generateStage(seed);
      let previous = 0;
      for (const progress of stage.checkpointProgress) {
        expect(progress).toBeGreaterThan(previous);
        previous = progress;
      }
      expect(stage.goalProgress).toBeGreaterThan(previous);
    }
  });
});

describe("세이브 포인트 배치 — 코스 중간(진행도 기준)에 놓인다", () => {
  // 배치 기준을 carve 순서(path 인덱스)에서 BFS 진행도로 바꾼 이유의 회귀 검증.
  // carve 순서 기준이던 시절엔 골 진행도가 22인 스테이지의 체크포인트 진행도가
  // 3, 5로 나와 스폰 코앞에 몰려 있었다 — 세이브 포인트가 사실상 무의미했다.
  const RATIO_MIN = 0.3;
  const RATIO_MAX = 0.7;

  it("1~200 시드 각각에서 체크포인트 진행도가 골 진행도의 30~70% 구간에 있다", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const stage = generateStage(seed);
      const ratio = stage.checkpointProgress[0] / stage.goalProgress;
      expect(ratio).toBeGreaterThanOrEqual(RATIO_MIN);
      expect(ratio).toBeLessThanOrEqual(RATIO_MAX);
    }
  });

  it("라운드별 파생 스테이지(1~50 베이스)에서도 같은 구간을 지킨다", () => {
    const rounds: Round[] = [1, 2, 3];
    for (let base = 1; base <= 50; base++) {
      for (const round of rounds) {
        const stage = generateStage(seedForRound(base, round));
        const ratio = stage.checkpointProgress[0] / stage.goalProgress;
        expect(ratio).toBeGreaterThanOrEqual(RATIO_MIN);
        expect(ratio).toBeLessThanOrEqual(RATIO_MAX);
      }
    }
  });
});
