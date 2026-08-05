import { describe, expect, it } from "vitest";
import { buildClearSummary, formatDuration } from "./App";

describe("formatDuration", () => {
  it("1분 미만은 초만 보여준다", () => {
    expect(formatDuration(53_000)).toBe("53초");
  });

  it("1분 이상은 분과 초를 함께 보여준다", () => {
    expect(formatDuration(90_000)).toBe("1분 30초");
    expect(formatDuration(600_000)).toBe("10분 0초");
  });

  it("반올림한다 — ms 단위 잔여값이 표시에 새지 않는다", () => {
    expect(formatDuration(1_600)).toBe("2초");
    expect(formatDuration(1_400)).toBe("1초");
  });

  it("음수는 0초로 눌러 표시한다 — 타이머가 꼬여도 이상한 값이 나오지 않는다", () => {
    expect(formatDuration(-5_000)).toBe("0초");
  });
});

describe("buildClearSummary", () => {
  it("사망 횟수와 클리어 시간을 함께 보여준다", () => {
    const summary = buildClearSummary(3, 95_000);
    expect(summary).toContain("사망 횟수: 3회");
    expect(summary).toContain("클리어 시간: 1분 35초");
  });

  it("무사망이면 전용 문구를 쓴다", () => {
    const summary = buildClearSummary(0, 40_000);
    expect(summary).toContain("무사망 클리어");
    expect(summary).not.toContain("다시 도전하면");
  });

  it("한 번이라도 죽었으면 재도전 문구를 쓴다", () => {
    const summary = buildClearSummary(1, 40_000);
    expect(summary).toContain("다시 도전하면");
    expect(summary).not.toContain("무사망 클리어");
  });

  it("계측된 시간이 없으면(디버그 라운드 진입) 시간 줄을 생략한다 — 0초라고 거짓말하지 않는다", () => {
    const summary = buildClearSummary(2, null);
    expect(summary).not.toContain("클리어 시간");
    expect(summary).toContain("사망 횟수: 2회");
  });

  it("CutsceneSlide가 개행으로 줄을 나누므로 줄 단위로 구성된다", () => {
    const lines = buildClearSummary(2, 40_000).split("\n");
    expect(lines[0]).toBe("— 결과 —");
    expect(lines).toHaveLength(4);
  });
});
