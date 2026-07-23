import { describe, expect, it } from "vitest";
import { naturalAngle, shadowTip } from "./shadowCaster";

describe("naturalAngle", () => {
  it("광원이 왼쪽에 있으면 각도는 0(오른쪽 방향)이다", () => {
    expect(naturalAngle({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
  });

  it("광원이 캐릭터 바로 위에 있으면 각도는 아래쪽(π/2)이다", () => {
    expect(naturalAngle({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2);
  });

  it("예외: 광원과 캐릭터가 같은 좌표면 0을 반환한다 (NaN 방지)", () => {
    const angle = naturalAngle({ x: 5, y: 5 }, { x: 5, y: 5 });
    expect(angle).toBe(0);
    expect(Number.isNaN(angle)).toBe(false);
  });
});

describe("shadowTip", () => {
  it("각도 0, 길이 10이면 캐릭터 오른쪽으로 10만큼 뻗은 끝점을 반환한다", () => {
    const tip = shadowTip({ x: 5, y: 5 }, 0, 10);
    expect(tip.x).toBeCloseTo(15);
    expect(tip.y).toBeCloseTo(5);
  });

  it("각도 π/2, 길이 10이면 캐릭터 아래로 10만큼 뻗은 끝점을 반환한다", () => {
    const tip = shadowTip({ x: 5, y: 5 }, Math.PI / 2, 10);
    expect(tip.x).toBeCloseTo(5);
    expect(tip.y).toBeCloseTo(15);
  });
});
