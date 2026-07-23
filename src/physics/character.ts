import type { Point } from "../core/stage";

export const CHARACTER_SPEED = 220; // px/sec

export interface MoveInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 입력 방향으로 캐릭터를 이동시키고, 화면(캔버스) 경계 안으로 clamp한다.
 * 이 clamp는 캐릭터의 물리적 이동 범위일 뿐, 그림자가 지켜야 하는
 * 안전 구역(자연 각도 ± 허용치)과는 별개의 개념이다 — ADR-002.
 */
export function moveCharacter(
  position: Point,
  input: MoveInput,
  deltaSeconds: number,
  bounds: Bounds,
): Point {
  let dx = 0;
  let dy = 0;

  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;

  if (dx !== 0 && dy !== 0) {
    const norm = Math.SQRT1_2;
    dx *= norm;
    dy *= norm;
  }

  const nextX = position.x + dx * CHARACTER_SPEED * deltaSeconds;
  const nextY = position.y + dy * CHARACTER_SPEED * deltaSeconds;

  return {
    x: Math.min(Math.max(nextX, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(nextY, bounds.minY), bounds.maxY),
  };
}
