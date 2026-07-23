export type Round = 1 | 2 | 3;

export const MAX_ROUND: Round = 3;

/**
 * 라운드별 안전 구역 가이드라인(부채꼴) 표시 여부.
 * 1R: 가이드라인 표시 / 2R부터: 가이드라인 제거(그림자 색상 피드백은 유지) — PRD §7-1.
 */
export function isGuideVisible(round: Round): boolean {
  return round === 1;
}

/**
 * 골 도달 시 다음 라운드로 진행한다. 이미 마지막 라운드(3R)에서 골에
 * 도달하면 스테이지 전체 클리어로 처리한다.
 */
export function advanceRound(round: Round): { round: Round; stageCleared: boolean } {
  if (round >= MAX_ROUND) {
    return { round, stageCleared: true };
  }
  return { round: (round + 1) as Round, stageCleared: false };
}
