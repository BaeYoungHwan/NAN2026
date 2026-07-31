import { describe, expect, it } from "vitest";
import type { TileGrid } from "./stage";
import {
  controlsReversed,
  effectiveAngleTolerance,
  isGuideVisible,
  isStageCleared,
  MAX_ROUND,
  progressAt,
  respawnPointFor,
  roundAfterClear,
} from "./round";

const spawn = { x: 0, y: 0 };
const checkpoints = [
  { x: 30, y: 0 },
  { x: 60, y: 0 },
];
const checkpointProgress = [3, 6]; // 스테이지 내부 세이브 포인트 진척도(BFS 거리) 값, 라운드 전환과 무관

describe("isGuideVisible", () => {
  it("1R에서는 가이드라인을 표시한다", () => {
    expect(isGuideVisible(1)).toBe(true);
  });

  it("2R부터는 가이드라인을 숨긴다", () => {
    expect(isGuideVisible(2)).toBe(false);
    expect(isGuideVisible(3)).toBe(false);
  });
});

describe("progressAt", () => {
  const grid: TileGrid = { cols: 3, rows: 1, tileSize: 40, cells: new Uint8Array([0, 0, 0]) };
  const distanceField = new Int32Array([0, 1, 2]);

  it("캐릭터가 서 있는 셀의 distanceField 값을 반환한다", () => {
    expect(progressAt(grid, distanceField, { x: 5, y: 10 })).toBe(0);
    expect(progressAt(grid, distanceField, { x: 45, y: 10 })).toBe(1);
    expect(progressAt(grid, distanceField, { x: 85, y: 10 })).toBe(2);
  });

  it("미도달(-1) 셀은 방어적으로 0을 반환한다", () => {
    const withUnreached = new Int32Array([0, -1, 2]);
    expect(progressAt(grid, withUnreached, { x: 45, y: 10 })).toBe(0);
  });
});

describe("roundAfterClear", () => {
  it("1R 스테이지 클리어 시 2R로 진행하고 전체 클리어는 아니다", () => {
    expect(roundAfterClear(1)).toEqual({ round: 2, cleared: false });
  });

  it("2R 스테이지 클리어 시 3R로 진행한다", () => {
    expect(roundAfterClear(2)).toEqual({ round: 3, cleared: false });
  });

  it("마지막 라운드(3R) 스테이지 클리어 시 전체 클리어로 판정한다", () => {
    expect(roundAfterClear(MAX_ROUND)).toEqual({ round: 3, cleared: true });
  });
});

describe("respawnPointFor", () => {
  it("어떤 체크포인트도 못 넘었으면 스폰으로 스냅한다", () => {
    expect(respawnPointFor(0, spawn, checkpoints, checkpointProgress)).toEqual(spawn);
    expect(respawnPointFor(2, spawn, checkpoints, checkpointProgress)).toEqual(spawn);
  });

  it("체크포인트를 넘은 뒤 그 사이 아무 지점에서 죽어도 마지막으로 넘은 체크포인트로 스냅한다 (죽은 자리 그대로 재개하지 않음)", () => {
    expect(respawnPointFor(3, spawn, checkpoints, checkpointProgress)).toEqual(checkpoints[0]);
    expect(respawnPointFor(5, spawn, checkpoints, checkpointProgress)).toEqual(checkpoints[0]);
  });

  it("두 번째 체크포인트를 넘었으면 그 지점으로 스냅한다", () => {
    expect(respawnPointFor(6, spawn, checkpoints, checkpointProgress)).toEqual(checkpoints[1]);
    expect(respawnPointFor(100, spawn, checkpoints, checkpointProgress)).toEqual(checkpoints[1]);
  });
});

describe("isStageCleared", () => {
  it("골의 진척도(goalProgress)에 도달하지 못했으면 false다", () => {
    expect(isStageCleared(7, 8)).toBe(false);
  });

  it("골의 진척도 이상이면 true다", () => {
    expect(isStageCleared(8, 8)).toBe(true);
    expect(isStageCleared(9, 8)).toBe(true);
  });
});

describe("effectiveAngleTolerance", () => {
  it("1R·2R은 기본 허용 각도를 그대로 사용한다", () => {
    expect(effectiveAngleTolerance(1, 0.6)).toBe(0.6);
    expect(effectiveAngleTolerance(2, 0.6)).toBe(0.6);
  });

  it("3R은 허용 각도를 절반으로 축소한다", () => {
    expect(effectiveAngleTolerance(3, 0.6)).toBeCloseTo(0.3);
  });
});

describe("controlsReversed", () => {
  it("1R·2R에서는 조작키가 반전되지 않는다", () => {
    expect(controlsReversed(1)).toBe(false);
    expect(controlsReversed(2)).toBe(false);
  });

  it("3R에서는 조작키가 반전된다", () => {
    expect(controlsReversed(3)).toBe(true);
  });
});
