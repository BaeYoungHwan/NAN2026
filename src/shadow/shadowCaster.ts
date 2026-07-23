import type { Point } from "../core/stage";

/**
 * 광원에서 캐릭터를 향하는(=캐릭터 뒤로 그림자가 자연히 지는) 방향의 각도(라디안).
 * 안전 구역은 이 각도를 기준으로 계산된다 — ADR-002.
 *
 * 예외: 광원과 캐릭터가 같은 좌표면 방향을 정의할 수 없으므로 0을 반환한다
 * (NaN 전파 방지).
 */
export function naturalAngle(lightPos: Point, characterPos: Point): number {
  const dx = characterPos.x - lightPos.x;
  const dy = characterPos.y - lightPos.y;

  if (dx === 0 && dy === 0) {
    return 0;
  }

  return Math.atan2(dy, dx);
}

/**
 * 캐릭터 위치에서 주어진 각도·길이로 뻗어나가는 그림자 끝점을 계산한다.
 * 이 각도는 (naturalAngle과 달리) 플레이어가 ,/. 로 직접 회전시키는 독립 상태다.
 */
export function shadowTip(characterPos: Point, angle: number, length: number): Point {
  return {
    x: characterPos.x + Math.cos(angle) * length,
    y: characterPos.y + Math.sin(angle) * length,
  };
}
