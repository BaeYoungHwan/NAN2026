import type { Point } from "./stage";

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
 * 캐릭터 위치에서 가장 가까운 path 인덱스를 찾는다 — 이 스테이지(라운드) 안의
 * 세이브 포인트를 정확히 밟았는지가 아니라 "통로를 따라 얼마나 진행했는지"로
 * 판정하기 위한 진척도 지표. `path`는 스폰(0)→골(length-1) 순서의 통로 중심점
 * 목록이다.
 */
export function nearestPathIndex(path: Point[], position: Point): number {
  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < path.length; i++) {
    const dx = path[i].x - position.x;
    const dy = path[i].y - position.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * 한 라운드 스테이지의 골에 도달했을 때, 다음 라운드로 갈지 전체 클리어인지
 * 결정한다. 라운드 번호는 더 이상 진척도의 파생값이 아니라, 이 명시적 이벤트
 * (스테이지 골 도달)로만 전이되는 독립 상태다 — 라운드마다 독립 스테이지로
 * 전환하는 구조로 바뀌면서, "라운드 전환"과 "스테이지 내부 세이브 포인트
 * 진척도"(`respawnIndexFor` 등)를 분리했다.
 */
export function roundAfterClear(round: Round): { round: Round; cleared: boolean } {
  if (round >= MAX_ROUND) return { round, cleared: true };
  return { round: (round + 1) as Round, cleared: false };
}

/** 진척도가 path의 마지막 인덱스(골)에 도달했는지 — 이 라운드 스테이지 클리어 판정. */
export function isStageCleared(farthestIndex: number, pathLastIndex: number): boolean {
  return farthestIndex >= pathLastIndex;
}

/**
 * 사망 리스폰 지점의 path 인덱스 — `farthestIndex`를 그대로 쓰지 않고, 그동안
 * 넘은 체크포인트 중 가장 마지막 것(없으면 스폰=0)으로 되돌린다.
 *
 * `farthestIndex`는 살아있는 동안 매 프레임 "현재 위치"로 갱신되므로, 죽는
 * 바로 그 프레임에도 이미 사망 지점 자신을 가리킨다 — 이걸 리스폰 지점으로
 * 그대로 쓰면 사망 페널티가 전혀 없어진다(죽은 자리에서 바로 재개 — 실제로
 * 발견된 버그). 체크포인트 단위로 스냅해 죽음에 의미 있는 손실을 되돌려주되,
 * "체크포인트를 정확히 밟아야만" 인정되던 문제(세이브 포인트를 못 찍으면 죽은
 * 자리 근처로도 못 돌아오던 문제)는 이 함수 자체가 `farthestIndex`(지나치기만
 * 해도 갱신됨) 기준으로 판정하므로 해결된 상태를 유지한다.
 */
export function respawnIndexFor(farthestIndex: number, checkpointPathIndices: number[]): number {
  let snapped = 0;
  for (const idx of checkpointPathIndices) {
    if (farthestIndex >= idx) snapped = idx;
  }
  return snapped;
}

/** 3R 디메리트(허용 각도 축소·조작키 반전)가 적용되는 라운드인지 여부 — PRD §7-1. */
export function isDemeritRound(round: Round): boolean {
  return round === 3;
}

/** 3R 디메리트 — 허용 각도 축소 배율. 임시값, P1 플레이테스트로 확정한다 (PRD §12). */
export const ROUND_3_TOLERANCE_MULTIPLIER = 0.5;

/**
 * 라운드별 실제 적용 허용 각도. 3R에서는 기본 허용 각도를 절반으로 줄여
 * 정렬을 더 엄격하게 요구한다 — PRD §7-1 3R 디메리트.
 */
export function effectiveAngleTolerance(round: Round, baseTolerance: number): number {
  return isDemeritRound(round) ? baseTolerance * ROUND_3_TOLERANCE_MULTIPLIER : baseTolerance;
}

/**
 * 3R 디메리트 — WASD 이동키 상하좌우 반전 여부. 캐릭터 조작(그림자 회전은
 * 영향받지 않음)에만 적용된다 — PRD §7-1.
 */
export function controlsReversed(round: Round): boolean {
  return isDemeritRound(round);
}
