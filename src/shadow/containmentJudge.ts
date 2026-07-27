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
 * 정렬 위험도 — 0은 완벽히 정렬(자연각과 정확히 일치), 1은 허용치 경계,
 * 1 초과는 이탈(사망) 상태. ADR-002의 "그림자 각도가 안전 구역(자연 각도 ±
 * 허용치) 안에 있는지" 판정을 대체한다(margin <= 1이 곧 정렬 상태) — 캐릭터
 * 포즈·그림자 표정을 함께 결정하는 단일 신호로 쓴다 — PRD §7-2 캐릭터
 * 스프라이트 연동.
 */
export function alignmentMargin(shadowAngle: number, naturalAngle: number, toleranceRadians: number): number {
  const diff = Math.abs(normalizeAngleDiff(shadowAngle - naturalAngle));
  return diff / toleranceRadians;
}
