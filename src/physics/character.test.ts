import { describe, expect, it } from "vitest";
import { CHARACTER_SPEED, moveCharacter } from "./character";

const bounds = { minX: 0, minY: 0, maxX: 800, maxY: 600 };
const noInput = { up: false, down: false, left: false, right: false };

describe("moveCharacter", () => {
  it("오른쪽 입력이면 x가 속도*시간만큼 증가한다", () => {
    const next = moveCharacter({ x: 100, y: 100 }, { ...noInput, right: true }, 1, bounds);
    expect(next.x).toBeCloseTo(100 + CHARACTER_SPEED);
    expect(next.y).toBeCloseTo(100);
  });

  it("대각선 입력이면 속도가 정규화되어 축 방향 이동보다 빠르지 않다", () => {
    // 경계 clamp의 영향을 받지 않도록 중앙에서 시작한다
    const next = moveCharacter({ x: 400, y: 300 }, { up: true, right: true, down: false, left: false }, 1, bounds);
    const dx = next.x - 400;
    const dy = 300 - next.y;
    const magnitude = Math.hypot(dx, dy);
    expect(magnitude).toBeCloseTo(CHARACTER_SPEED, 0);
  });

  it("경계를 벗어나는 이동은 clamp된다", () => {
    const next = moveCharacter({ x: 5, y: 5 }, { ...noInput, left: true, up: true }, 1, bounds);
    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
  });

  it("입력이 없으면 위치가 그대로 유지된다", () => {
    const next = moveCharacter({ x: 300, y: 300 }, noInput, 1, bounds);
    expect(next).toEqual({ x: 300, y: 300 });
  });
});
