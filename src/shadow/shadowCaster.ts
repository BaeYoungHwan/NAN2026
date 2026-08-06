import type { Point } from "../core/stage";

/**
 * 여러 광원 중 캐릭터와 가장 가까운 것을 고른다(ADR-004: 최근접 광원이 안전 구역
 * 판정을 결정). 캐릭터가 가로등 사이를 지날 때마다 다른 광원이 선택되어 "자연
 * 각도"가 계속 바뀌게 하는 것이 이 함수의 목적이다.
 */
export function nearestLight(lightPositions: Point[], characterPos: Point): Point {
  // 광원이 하나도 없으면 "안전 구역"이라는 개념 자체가 성립하지 않는다. 예전에는
  // `lightPositions[0]`(= undefined)를 그대로 반환해서, 호출부인 `naturalAngle`이
  // `light.x`를 읽는 순간 TypeError가 났다 — 게임 루프(rAF) 안에서 터지면 루프가
  // 그대로 죽고 화면이 멈추기 때문에 원인이 전혀 드러나지 않는다. 스테이지 생성이
  // 광원 1개 이상을 보장하므로(`placeLightSources`) 여기 걸리면 그쪽이 깨진 것이다.
  if (lightPositions.length === 0) {
    throw new Error("nearestLight: 광원이 없는 스테이지 — 스테이지 생성이 광원 1개 이상을 보장해야 한다");
  }

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
 * **특정** 광원 하나에서 캐릭터를 향하는 방향의 각도(라디안). 최근접 광원이 바뀌는
 * 순간 "직전 광원 기준으로는 정렬돼 있었는지"를 판정할 때처럼, 최근접 선택을 거치지
 * 않고 지정한 광원으로 계산해야 하는 곳에서 쓴다.
 *
 * 예외: 광원과 캐릭터가 같은 좌표면 방향을 정의할 수 없으므로 0을 반환한다
 * (NaN 전파 방지).
 */
export function angleFromLight(light: Point, characterPos: Point): number {
  const dx = characterPos.x - light.x;
  const dy = characterPos.y - light.y;

  if (dx === 0 && dy === 0) {
    return 0;
  }

  return Math.atan2(dy, dx);
}

/**
 * 캐릭터와 가장 가까운 광원에서 캐릭터를 향하는(=캐릭터 뒤로 그림자가 자연히
 * 지는) 방향의 각도(라디안). 안전 구역은 이 각도를 기준으로 계산된다 — ADR-002,
 * 다중 광원 최근접 선택은 ADR-004.
 */
export function naturalAngle(lightPositions: Point[], characterPos: Point): number {
  return angleFromLight(nearestLight(lightPositions, characterPos), characterPos);
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
