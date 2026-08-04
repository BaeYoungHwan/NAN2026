import { describe, expect, it } from "vitest";
import type { TileGrid } from "./stage";
import {
  CHECKPOINT_TOUCH_RADIUS,
  controlsReversed,
  effectiveAngleTolerance,
  hasTouchedCheckpoint,
  isGuideVisible,
  isStageCleared,
  MAX_ROUND,
  progressAt,
  respawnPointFor,
  roundAfterClear,
} from "./round";

const spawn = { x: 0, y: 0 };
const checkpoints = [
  { x: 300, y: 0 },
  { x: 600, y: 0 },
];

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

describe("hasTouchedCheckpoint", () => {
  const checkpoint = { x: 100, y: 100 };

  it("활성화 반경 안에 있으면 밟은 것으로 판정한다", () => {
    expect(hasTouchedCheckpoint({ x: 100, y: 100 }, checkpoint)).toBe(true);
    expect(hasTouchedCheckpoint({ x: 100 + CHECKPOINT_TOUCH_RADIUS - 1, y: 100 }, checkpoint)).toBe(true);
  });

  it("경계(반경과 정확히 같은 거리)는 밟은 것으로 인정한다", () => {
    expect(hasTouchedCheckpoint({ x: 100 + CHECKPOINT_TOUCH_RADIUS, y: 100 }, checkpoint)).toBe(true);
  });

  it("반경 밖이면 밟지 않은 것으로 판정한다", () => {
    expect(hasTouchedCheckpoint({ x: 100 + CHECKPOINT_TOUCH_RADIUS + 1, y: 100 }, checkpoint)).toBe(false);
    expect(hasTouchedCheckpoint({ x: 400, y: 400 }, checkpoint)).toBe(false);
  });

  it("거리는 대각선(유클리드)으로 잰다 — 축 단독 거리가 반경 안이어도 실제 거리가 밖이면 false", () => {
    // (30, 30)은 두 축 모두 반경(40) 안이지만 실제 거리는 약 42.4로 반경 밖이다.
    expect(hasTouchedCheckpoint({ x: 130, y: 130 }, checkpoint)).toBe(false);
  });
});

describe("respawnPointFor", () => {
  it("어떤 체크포인트도 밟지 않았으면 스폰으로 되돌린다 — 세이브 포인트를 안 밟는 것도 정상 플레이다", () => {
    expect(respawnPointFor(spawn, checkpoints, [false, false])).toEqual(spawn);
  });

  it("첫 체크포인트만 밟았으면 그 지점으로 스냅한다 (죽은 자리 그대로 재개하지 않음)", () => {
    expect(respawnPointFor(spawn, checkpoints, [true, false])).toEqual(checkpoints[0]);
  });

  it("두 번째까지 밟았으면 마지막으로 밟은 지점으로 스냅한다", () => {
    expect(respawnPointFor(spawn, checkpoints, [true, true])).toEqual(checkpoints[1]);
  });

  it("앞을 건너뛰고 뒤만 밟았어도 밟은 것 중 마지막 지점으로 스냅한다", () => {
    expect(respawnPointFor(spawn, checkpoints, [false, true])).toEqual(checkpoints[1]);
  });

  it("체크포인트가 없는 스테이지에서는 항상 스폰으로 되돌린다", () => {
    expect(respawnPointFor(spawn, [], [])).toEqual(spawn);
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
