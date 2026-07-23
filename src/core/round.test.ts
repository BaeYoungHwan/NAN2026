import { describe, expect, it } from "vitest";
import { advanceRound, isGuideVisible, MAX_ROUND } from "./round";

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
