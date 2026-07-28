import { describe, expect, it } from "vitest";
import { DEATH_LINES, pickRandomLine, TUTORIAL_LINES } from "./reaperLines";

describe("pickRandomLine", () => {
  it("항상 주어진 목록 안의 문자열을 반환한다", () => {
    for (let i = 0; i < 20; i++) {
      expect(DEATH_LINES).toContain(pickRandomLine(DEATH_LINES));
    }
  });

  it("빈 배열이 아닌 이상 항상 비어있지 않은 문자열을 반환한다", () => {
    expect(pickRandomLine(TUTORIAL_LINES)).not.toBe("");
  });
});
