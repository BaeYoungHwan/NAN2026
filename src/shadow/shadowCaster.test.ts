import { describe, expect, it } from "vitest";
import { naturalAngle, nearestLight, shadowTip } from "./shadowCaster";

describe("naturalAngle", () => {
  it("광원이 왼쪽에 있으면 각도는 0(오른쪽 방향)이다", () => {
    expect(naturalAngle([{ x: 0, y: 0 }], { x: 10, y: 0 })).toBeCloseTo(0);
  });

  it("광원이 캐릭터 바로 위에 있으면 각도는 아래쪽(π/2)이다", () => {
    expect(naturalAngle([{ x: 0, y: 0 }], { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2);
  });

  it("예외: 가장 가까운 광원과 캐릭터가 같은 좌표면 0을 반환한다 (NaN 방지)", () => {
    const angle = naturalAngle([{ x: 5, y: 5 }], { x: 5, y: 5 });
    expect(angle).toBe(0);
    expect(Number.isNaN(angle)).toBe(false);
  });

  it("광원이 여러 개면 가장 가까운 광원 기준으로 각도를 계산한다 (ADR-004)", () => {
    // 캐릭터(10,0) 기준 (0,0)이 (100,0)보다 가까우므로 (0,0) 쪽이 광원이어야 함 → 각도 0
    const angle = naturalAngle(
      [
        { x: 100, y: 0 },
        { x: 0, y: 0 },
      ],
      { x: 10, y: 0 },
    );
    expect(angle).toBeCloseTo(0);
  });
});

describe("nearestLight", () => {
  it("여러 광원 중 캐릭터와 가장 가까운 것을 반환한다", () => {
    const far = { x: 200, y: 200 };
    const near = { x: 12, y: 0 };
    expect(nearestLight([far, near], { x: 10, y: 0 })).toBe(near);
  });

  it("캐릭터가 두 광원 사이를 지나면 최근접 광원이 바뀐다", () => {
    const left = { x: 0, y: 0 };
    const right = { x: 100, y: 0 };
    expect(nearestLight([left, right], { x: 10, y: 0 })).toBe(left);
    expect(nearestLight([left, right], { x: 90, y: 0 })).toBe(right);
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
