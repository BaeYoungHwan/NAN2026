import { describe, expect, it } from "vitest";
import { CHARACTER_SPEED, moveCharacter } from "./character";

const noInput = { up: false, down: false, left: false, right: false };
const alwaysOpen = () => true;

describe("moveCharacter", () => {
  it("오른쪽 입력이면 x가 속도*시간만큼 증가한다 (막힘 없음)", () => {
    const next = moveCharacter({ x: 100, y: 100 }, { ...noInput, right: true }, 1, alwaysOpen);
    expect(next.x).toBeCloseTo(100 + CHARACTER_SPEED);
    expect(next.y).toBeCloseTo(100);
  });

  it("대각선 입력이면 속도가 정규화되어 축 방향 이동보다 빠르지 않다", () => {
    const next = moveCharacter({ x: 400, y: 300 }, { up: true, right: true, down: false, left: false }, 1, alwaysOpen);
    const dx = next.x - 400;
    const dy = 300 - next.y;
    const magnitude = Math.hypot(dx, dy);
    expect(magnitude).toBeCloseTo(CHARACTER_SPEED, 0);
  });

  it("입력이 없으면 위치가 그대로 유지된다", () => {
    const next = moveCharacter({ x: 300, y: 300 }, noInput, 1, alwaysOpen);
    expect(next).toEqual({ x: 300, y: 300 });
  });

  it("벽에 막히면 해당 축으로 이동하지 않는다", () => {
    // x >= 150이면 벽이라고 가정
    const canOccupy = (p: { x: number; y: number }) => p.x < 150;
    const next = moveCharacter({ x: 100, y: 100 }, { ...noInput, right: true }, 1, canOccupy);
    expect(next.x).toBe(100);
    expect(next.y).toBe(100);
  });

  it("한쪽 축만 막히면 다른 축으로는 계속 미끄러지듯 이동한다 (축 분리)", () => {
    // x >= 150이면 벽 — 대각선(오른쪽+아래) 이동 시 x는 막히고 y는 통과해야 함
    const canOccupy = (p: { x: number; y: number }) => p.x < 150;
    const next = moveCharacter({ x: 100, y: 100 }, { up: false, down: true, left: false, right: true }, 1, canOccupy);
    expect(next.x).toBe(100);
    expect(next.y).toBeGreaterThan(100);
  });
});
