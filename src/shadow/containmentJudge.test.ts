import { describe, expect, it } from "vitest";
import { isPointInConvexPolygon, isShadowContained } from "./containmentJudge";

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("isPointInConvexPolygon", () => {
  it("다각형 내부의 점은 true를 반환한다", () => {
    expect(isPointInConvexPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it("다각형 바깥의 점은 false를 반환한다", () => {
    expect(isPointInConvexPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });

  it("경계 케이스: 정점 위에 정확히 걸치면 안전(true)으로 취급한다", () => {
    expect(isPointInConvexPolygon({ x: 0, y: 0 }, square)).toBe(true);
  });

  it("경계 케이스: 변의 중간(공선)에 정확히 걸치면 안전(true)으로 취급한다", () => {
    expect(isPointInConvexPolygon({ x: 5, y: 0 }, square)).toBe(true);
  });

  it("정점이 3개 미만인 다각형은 오류를 던진다", () => {
    expect(() => isPointInConvexPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow();
  });
});

describe("isShadowContained", () => {
  it("그림자 선분 양 끝점이 모두 경계 안에 있으면 true", () => {
    const shadow = { base: { x: 2, y: 2 }, tip: { x: 8, y: 8 } };
    expect(isShadowContained(shadow, square)).toBe(true);
  });

  it("tip이 경계를 벗어나면 false (즉사 조건)", () => {
    const shadow = { base: { x: 5, y: 5 }, tip: { x: 15, y: 5 } };
    expect(isShadowContained(shadow, square)).toBe(false);
  });

  it("base가 경계를 벗어나면 false", () => {
    const shadow = { base: { x: -5, y: 5 }, tip: { x: 5, y: 5 } };
    expect(isShadowContained(shadow, square)).toBe(false);
  });

  it("경계선 위에 정확히 걸친 선분은 안전(true)으로 취급한다", () => {
    const shadow = { base: { x: 0, y: 5 }, tip: { x: 10, y: 5 } };
    expect(isShadowContained(shadow, square)).toBe(true);
  });
});
