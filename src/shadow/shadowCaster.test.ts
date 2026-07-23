import { describe, expect, it } from "vitest";
import { castShadow } from "./shadowCaster";

describe("castShadow", () => {
  it("광원에서 캐릭터를 향하는 방향으로 길이만큼 뻗어나간 tip을 계산한다", () => {
    const shadow = castShadow({ x: 0, y: 0 }, { x: 10, y: 0 }, 5);

    expect(shadow.base).toEqual({ x: 10, y: 0 });
    expect(shadow.tip.x).toBeCloseTo(15);
    expect(shadow.tip.y).toBeCloseTo(0);
  });

  it("대각선 방향에서도 방향 벡터를 정규화해 정확한 길이로 뻗는다", () => {
    const shadow = castShadow({ x: 0, y: 0 }, { x: 3, y: 4 }, 10);

    // 방향 (3,4) 정규화 = (0.6, 0.8), tip = (3,4) + (0.6,0.8)*10 = (9, 12)
    expect(shadow.tip.x).toBeCloseTo(9);
    expect(shadow.tip.y).toBeCloseTo(12);
  });

  it("예외: 광원과 캐릭터가 같은 좌표면 방향을 정의할 수 없어 길이 0으로 고정한다", () => {
    const shadow = castShadow({ x: 5, y: 5 }, { x: 5, y: 5 }, 10);

    expect(shadow.base).toEqual({ x: 5, y: 5 });
    expect(shadow.tip).toEqual({ x: 5, y: 5 });
    expect(Number.isNaN(shadow.tip.x)).toBe(false);
    expect(Number.isNaN(shadow.tip.y)).toBe(false);
  });

  it("길이가 0이면 tip이 base와 같다", () => {
    const shadow = castShadow({ x: 0, y: 0 }, { x: 10, y: 10 }, 0);

    expect(shadow.tip).toEqual(shadow.base);
  });
});
