/**
 * 두 각도(라디안) 차이를 (-π, π] 범위로 정규화한다.
 * 예: 359도와 1도의 차이는 358도가 아니라 -2도여야 한다.
 */
export function normalizeAngleDiff(diff: number): number {
  const twoPi = Math.PI * 2;
  let result = diff % twoPi;
  if (result > Math.PI) result -= twoPi;
  if (result <= -Math.PI) result += twoPi;
  return result;
}

/**
 * 그림자 각도가 안전 구역(자연 각도 ± 허용치) 안에 있는지 판정한다.
 * ADR-002: 안전 구역은 광원-캐릭터 위치로 매 프레임 재계산되는 자연 각도
 * 기준의 각도 범위이며, 그림자 각도는 플레이어가 ,/. 로 직접 회전시킨
 * 독립 상태다 — 둘이 벌어지면(허용치 초과) 이탈로 판정한다.
 */
export function isShadowAligned(
  shadowAngle: number,
  naturalAngle: number,
  toleranceRadians: number,
): boolean {
  const diff = Math.abs(normalizeAngleDiff(shadowAngle - naturalAngle));
  return diff <= toleranceRadians;
}
