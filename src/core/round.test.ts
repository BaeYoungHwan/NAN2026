import { describe, expect, it } from "vitest";
import { advanceRound, controlsReversed, effectiveAngleTolerance, isGuideVisible, MAX_ROUND, roundTarget } from "./round";

const checkpoints = [
  { x: 10, y: 10 },
  { x: 20, y: 20 },
];
const goal = { x: 30, y: 30 };

describe("isGuideVisible", () => {
  it("1R에서는 가이드라인을 표시한다", () => {
    expect(isGuideVisible(1)).toBe(true);
  });

  it("2R부터는 가이드라인을 숨긴다", () => {
    expect(isGuideVisible(2)).toBe(false);
    expect(isGuideVisible(3)).toBe(false);
  });
});

describe("advanceRound", () => {
  it("1R에서 골 도달 시 2R로 진행하고 스테이지는 클리어되지 않는다", () => {
    expect(advanceRound(1)).toEqual({ round: 2, stageCleared: false });
  });

  it("2R에서 골 도달 시 3R로 진행한다", () => {
    expect(advanceRound(2)).toEqual({ round: 3, stageCleared: false });
  });

  it("마지막 라운드(3R)에서 골 도달 시 스테이지 전체가 클리어된다", () => {
    expect(advanceRound(MAX_ROUND)).toEqual({ round: 3, stageCleared: true });
  });
});

describe("roundTarget", () => {
  it("1R의 목표는 첫 번째 세이브 포인트다", () => {
    expect(roundTarget(1, checkpoints, goal)).toEqual(checkpoints[0]);
  });

  it("2R의 목표는 두 번째 세이브 포인트다", () => {
    expect(roundTarget(2, checkpoints, goal)).toEqual(checkpoints[1]);
  });

  it("마지막 라운드(3R)의 목표는 최종 골이다", () => {
    expect(roundTarget(MAX_ROUND, checkpoints, goal)).toEqual(goal);
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
