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
 * 골 도달 시 다음 라운드로 진행한다. 이미 마지막 라운드(3R)에서 골에
 * 도달하면 스테이지 전체 클리어로 처리한다.
 */
export function advanceRound(round: Round): { round: Round; stageCleared: boolean } {
  if (round >= MAX_ROUND) {
    return { round, stageCleared: true };
  }
  return { round: (round + 1) as Round, stageCleared: false };
}

/**
 * 현재 라운드가 향해야 할 목표 지점. 마지막 라운드 전에는 다음 세이브
 * 포인트(`checkpoints[round - 1]`)가 목표이고, 마지막 라운드에서는 스테이지의
 * 최종 골이 목표다.
 */
export function roundTarget(round: Round, checkpoints: Point[], goal: Point): Point {
  return round < MAX_ROUND ? checkpoints[round - 1] : goal;
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
