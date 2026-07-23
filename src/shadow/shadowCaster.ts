import type { Point } from "../core/stage";

export interface Shadow {
  base: Point;
  tip: Point;
}

/**
 * 광원 고정 위치와 캐릭터 위치로 그림자 선분을 계산한다.
 * ADR-001: 그림자는 광원→캐릭터 방향으로 뻗어나가는 선분(base-tip)으로 모델링한다.
 *
 * 예외: 광원과 캐릭터가 같은 좌표면 방향을 정의할 수 없으므로,
 * 그림자를 캐릭터 위치에 고정(길이 0)해 NaN 전파를 막는다.
 */
export function castShadow(lightPos: Point, characterPos: Point, length: number): Shadow {
  const dx = characterPos.x - lightPos.x;
  const dy = characterPos.y - lightPos.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return { base: characterPos, tip: { x: characterPos.x, y: characterPos.y } };
  }

  const dirX = dx / distance;
  const dirY = dy / distance;

  return {
    base: characterPos,
    tip: {
      x: characterPos.x + dirX * length,
      y: characterPos.y + dirY * length,
    },
  };
}
