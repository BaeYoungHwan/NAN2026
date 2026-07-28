import { describe, expect, it } from "vitest";
import {
  controlsReversed,
  effectiveAngleTolerance,
  isGuideVisible,
  isStageCleared,
  MAX_ROUND,
  nearestPathIndex,
  respawnIndexFor,
  roundAfterClear,
} from "./round";

const checkpointPathIndices = [3, 6]; // 스테이지 내부 세이브 포인트 인덱스 (예: 경로 길이 9, 라운드 전환과 무관)

describe("isGuideVisible", () => {
  it("1R에서는 가이드라인을 표시한다", () => {
    expect(isGuideVisible(1)).toBe(true);
  });

  it("2R부터는 가이드라인을 숨긴다", () => {
    expect(isGuideVisible(2)).toBe(false);
    expect(isGuideVisible(3)).toBe(false);
  });
});

describe("nearestPathIndex", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ];

  it("가장 가까운 path 점의 인덱스를 반환한다", () => {
    expect(nearestPathIndex(path, { x: 9, y: 1 })).toBe(1);
  });

  it("정확히 겹치는 점이 있으면 그 인덱스를 반환한다", () => {
    expect(nearestPathIndex(path, { x: 20, y: 0 })).toBe(2);
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

describe("respawnIndexFor", () => {
  it("어떤 체크포인트도 못 넘었으면 스폰(0)으로 스냅한다", () => {
    expect(respawnIndexFor(0, checkpointPathIndices)).toBe(0);
    expect(respawnIndexFor(2, checkpointPathIndices)).toBe(0);
  });

  it("체크포인트를 넘은 뒤 그 사이 아무 지점에서 죽어도 마지막으로 넘은 체크포인트로 스냅한다 (죽은 자리 그대로 재개하지 않음)", () => {
    expect(respawnIndexFor(3, checkpointPathIndices)).toBe(3);
    expect(respawnIndexFor(5, checkpointPathIndices)).toBe(3);
  });

  it("두 번째 체크포인트를 넘었으면 그 지점으로 스냅한다", () => {
    expect(respawnIndexFor(6, checkpointPathIndices)).toBe(6);
    expect(respawnIndexFor(100, checkpointPathIndices)).toBe(6);
  });
});

describe("isStageCleared", () => {
  it("path의 마지막 인덱스에 도달하지 못했으면 false다", () => {
    expect(isStageCleared(7, 8)).toBe(false);
  });

  it("path의 마지막 인덱스 이상이면 true다", () => {
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
