import type { Point } from "../core/stage";

/**
 * 여러 광원 중 캐릭터와 가장 가까운 것을 고른다(ADR-004: 최근접 광원이 안전 구역
 * 판정을 결정). 캐릭터가 가로등 사이를 지날 때마다 다른 광원이 선택되어 "자연
 * 각도"가 계속 바뀌게 하는 것이 이 함수의 목적이다.
 */
export function nearestLight(lightPositions: Point[], characterPos: Point): Point {
  let closest = lightPositions[0];
  let closestDistSq = Infinity;

  for (const light of lightPositions) {
    const dx = characterPos.x - light.x;
    const dy = characterPos.y - light.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < closestDistSq) {
      closestDistSq = distSq;
      closest = light;
    }
  }

  return closest;
}

/**
 * 캐릭터와 가장 가까운 광원에서 캐릭터를 향하는(=캐릭터 뒤로 그림자가 자연히
 * 지는) 방향의 각도(라디안). 안전 구역은 이 각도를 기준으로 계산된다 — ADR-002,
 * 다중 광원 최근접 선택은 ADR-004.
 *
 * 예외: 가장 가까운 광원과 캐릭터가 같은 좌표면 방향을 정의할 수 없으므로 0을
 * 반환한다 (NaN 전파 방지).
 */
export function naturalAngle(lightPositions: Point[], characterPos: Point): number {
  const light = nearestLight(lightPositions, characterPos);
  const dx = characterPos.x - light.x;
  const dy = characterPos.y - light.y;

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
