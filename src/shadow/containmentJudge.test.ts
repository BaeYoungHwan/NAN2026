import { describe, expect, it } from "vitest";
import { alignmentMargin, normalizeAngleDiff } from "./containmentJudge";

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

describe("alignmentMargin", () => {
  const tolerance = Math.PI / 6; // 30도

  it("완벽히 정렬되면 0을 반환한다", () => {
    expect(alignmentMargin(1, 1, tolerance)).toBe(0);
  });

  it("허용치 경계에서 정확히 1을 반환한다", () => {
    expect(alignmentMargin(0, tolerance, tolerance)).toBeCloseTo(1);
  });

  it("허용치의 절반만큼 벗어나면 0.5를 반환한다", () => {
    expect(alignmentMargin(0, tolerance / 2, tolerance)).toBeCloseTo(0.5);
  });

  it("허용치를 벗어나면 1보다 큰 값을 반환한다", () => {
    expect(alignmentMargin(0, tolerance * 1.5, tolerance)).toBeCloseTo(1.5);
  });

  it("각도가 원을 넘나들어도 올바르게 계산한다", () => {
    const natural = (-170 * Math.PI) / 180;
    const shadow = (175 * Math.PI) / 180; // 실제 차이 15도
    const fullTolerance = Math.PI / 12; // 15도
    expect(alignmentMargin(shadow, natural, fullTolerance)).toBeCloseTo(1);
  });
});
