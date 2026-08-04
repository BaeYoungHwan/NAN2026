import type { Point } from "../core/stage";

export const CHARACTER_SPEED = 220; // px/sec
export const CHARACTER_RADIUS = 10;

export interface MoveInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface MoveResult {
  position: Point;
  /**
   * 그 축으로 움직이려 했지만 벽에 막힌 경우 true — 벽 충돌 효과음의 트리거다.
   * "위치가 변하지 않았다"로는 대신할 수 없다: 축 분리 이동이라 대각선 중 한
   * 축만 막히는 경우가 흔하고, 그때도 결과 위치는 바뀌기 때문이다.
   */
  blockedX: boolean;
  blockedY: boolean;
}

/**
 * 입력 방향으로 캐릭터를 이동시킨다. `canOccupy`는 특정 좌표를 캐릭터가
 * 차지할 수 있는지 판정하는 함수(예: `physics/collider.ts`의 벽 충돌 판정)이며,
 * 이 함수는 그리드 등 지형 표현에 직접 결합되지 않는다.
 *
 * X축, Y축을 분리해서 각각 이동을 시도한다(축 분리) — 한쪽 축만 벽에 막혀도
 * 다른 축으로는 계속 미끄러지듯 이동할 수 있어 모서리에 끼이지 않는다.
 *
 * 이 충돌판정은 캐릭터의 물리적 이동 가능 여부일 뿐, 그림자가 지켜야 하는
 * 안전 구역(자연 각도 ± 허용치)과는 완전히 별개의 개념이다 — ADR-002.
 */
export function moveCharacter(
  position: Point,
  input: MoveInput,
  deltaSeconds: number,
  canOccupy: (point: Point) => boolean,
): MoveResult {
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

  const deltaX = dx * CHARACTER_SPEED * deltaSeconds;
  const deltaY = dy * CHARACTER_SPEED * deltaSeconds;

  let next = position;
  let blockedX = false;
  let blockedY = false;

  const afterX = { x: next.x + deltaX, y: next.y };
  if (canOccupy(afterX)) {
    next = afterX;
  } else if (deltaX !== 0) {
    // 애초에 그 축으로 움직일 의도가 없었으면(deltaX === 0) 막힌 것이 아니다.
    blockedX = true;
  }

  const afterY = { x: next.x, y: next.y + deltaY };
  if (canOccupy(afterY)) {
    next = afterY;
  } else if (deltaY !== 0) {
    blockedY = true;
  }

  return { position: next, blockedX, blockedY };
}

/** 3R 디메리트 — 이동 입력의 상하좌우를 반전시킨다(대각선 입력도 각 축이 반전됨). */
export function reverseMoveInput(input: MoveInput): MoveInput {
  return { up: input.down, down: input.up, left: input.right, right: input.left };
}
