import { describe, expect, it } from "vitest";
import { CHARACTER_SPEED, moveCharacter, reverseMoveInput } from "./character";

const noInput = { up: false, down: false, left: false, right: false };
const alwaysOpen = () => true;

describe("moveCharacter", () => {
  it("오른쪽 입력이면 x가 속도*시간만큼 증가한다 (막힘 없음)", () => {
    const { position } = moveCharacter({ x: 100, y: 100 }, { ...noInput, right: true }, 1, alwaysOpen);
    expect(position.x).toBeCloseTo(100 + CHARACTER_SPEED);
    expect(position.y).toBeCloseTo(100);
  });

  it("대각선 입력이면 속도가 정규화되어 축 방향 이동보다 빠르지 않다", () => {
    const { position } = moveCharacter(
      { x: 400, y: 300 },
      { up: true, right: true, down: false, left: false },
      1,
      alwaysOpen,
    );
    const dx = position.x - 400;
    const dy = 300 - position.y;
    const magnitude = Math.hypot(dx, dy);
    expect(magnitude).toBeCloseTo(CHARACTER_SPEED, 0);
  });

  it("입력이 없으면 위치가 그대로 유지된다", () => {
    const { position } = moveCharacter({ x: 300, y: 300 }, noInput, 1, alwaysOpen);
    expect(position).toEqual({ x: 300, y: 300 });
  });

  it("벽에 막히면 해당 축으로 이동하지 않는다", () => {
    // x >= 150이면 벽이라고 가정
    const canOccupy = (p: { x: number; y: number }) => p.x < 150;
    const { position } = moveCharacter({ x: 100, y: 100 }, { ...noInput, right: true }, 1, canOccupy);
    expect(position.x).toBe(100);
    expect(position.y).toBe(100);
  });

  it("한쪽 축만 막히면 다른 축으로는 계속 미끄러지듯 이동한다 (축 분리)", () => {
    // x >= 150이면 벽 — 대각선(오른쪽+아래) 이동 시 x는 막히고 y는 통과해야 함
    const canOccupy = (p: { x: number; y: number }) => p.x < 150;
    const { position } = moveCharacter(
      { x: 100, y: 100 },
      { up: false, down: true, left: false, right: true },
      1,
      canOccupy,
    );
    expect(position.x).toBe(100);
    expect(position.y).toBeGreaterThan(100);
  });
});

describe("moveCharacter 벽 충돌 보고", () => {
  const wallAtX150 = (p: { x: number; y: number }) => p.x < 150;

  it("막히지 않고 이동하면 두 축 모두 false다", () => {
    const result = moveCharacter({ x: 100, y: 100 }, { ...noInput, right: true }, 1, alwaysOpen);
    expect(result.blockedX).toBe(false);
    expect(result.blockedY).toBe(false);
  });

  it("입력이 없으면 막힘으로 보고하지 않는다 — 벽에 붙어 서 있기만 해도 소리가 나면 안 된다", () => {
    const result = moveCharacter({ x: 149, y: 100 }, noInput, 1, wallAtX150);
    expect(result.blockedX).toBe(false);
    expect(result.blockedY).toBe(false);
  });

  it("이동하려던 축이 벽에 막히면 그 축만 true로 보고한다", () => {
    const result = moveCharacter({ x: 100, y: 100 }, { ...noInput, right: true }, 1, wallAtX150);
    expect(result.blockedX).toBe(true);
    expect(result.blockedY).toBe(false);
  });

  it("대각선 중 한 축만 막히면 그 축만 true다 — 위치는 바뀌므로 위치 비교로는 알 수 없다", () => {
    const result = moveCharacter(
      { x: 100, y: 100 },
      { up: false, down: true, left: false, right: true },
      1,
      wallAtX150,
    );
    expect(result.blockedX).toBe(true);
    expect(result.blockedY).toBe(false);
    expect(result.position.y).toBeGreaterThan(100);
  });

  it("사방이 막히면 두 축 모두 true다", () => {
    const result = moveCharacter(
      { x: 100, y: 100 },
      { up: false, down: true, left: false, right: true },
      1,
      () => false,
    );
    expect(result.blockedX).toBe(true);
    expect(result.blockedY).toBe(true);
  });
});

describe("reverseMoveInput", () => {
  it("상하좌우를 반전시킨다", () => {
    expect(reverseMoveInput({ up: true, down: false, left: false, right: false })).toEqual({
      up: false,
      down: true,
      left: false,
      right: false,
    });
    expect(reverseMoveInput({ up: false, down: false, left: true, right: false })).toEqual({
      up: false,
      down: false,
      left: false,
      right: true,
    });
  });

  it("대각선 입력도 각 축이 반전된다", () => {
    expect(reverseMoveInput({ up: true, down: false, left: true, right: false })).toEqual({
      up: false,
      down: true,
      left: false,
      right: true,
    });
  });

  it("입력이 없으면 반전해도 그대로다", () => {
    expect(reverseMoveInput({ up: false, down: false, left: false, right: false })).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
    });
  });
});
