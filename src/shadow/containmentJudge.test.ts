import { describe, expect, it } from "vitest";
import { isShadowAligned, normalizeAngleDiff } from "./containmentJudge";

describe("normalizeAngleDiff", () => {
  it("작은 차이는 그대로 반환한다", () => {
    expect(normalizeAngleDiff(0.1)).toBeCloseTo(0.1);
  });

  it("359도와 1도의 차이는 -2도(라디안)로 정규화된다", () => {
    const almostFullCircle = (359 * Math.PI) / 180;
    const oneDegree = (1 * Math.PI) / 180;
    const diff = normalizeAngleDiff(almostFullCircle - oneDegree);
    expect(diff).toBeCloseTo((-2 * Math.PI) / 180);
  });
});

describe("isShadowAligned", () => {
  const tolerance = Math.PI / 6; // 30도

  it("그림자 각도가 자연 각도와 같으면 정렬됨(true)", () => {
    expect(isShadowAligned(1, 1, tolerance)).toBe(true);
  });

  it("허용치 안의 차이는 정렬됨(true)", () => {
    expect(isShadowAligned(0, tolerance - 0.01, tolerance)).toBe(true);
  });

  it("허용치를 벗어나면 이탈(false)", () => {
    expect(isShadowAligned(0, tolerance + 0.01, tolerance)).toBe(false);
  });

  it("경계값(정확히 허용치)은 안전(true)으로 취급한다", () => {
    expect(isShadowAligned(0, tolerance, tolerance)).toBe(true);
  });

  it("각도가 원을 넘나들어도(0도 근처) 올바르게 판정한다", () => {
    // 자연각 -170도, 그림자각 175도 -> 실제 차이는 15도(짧은 쪽)
    const natural = (-170 * Math.PI) / 180;
    const shadow = (175 * Math.PI) / 180;
    expect(isShadowAligned(shadow, natural, tolerance)).toBe(true);
  });
});
