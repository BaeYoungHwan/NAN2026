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
 * 한 라운드 스테이지의 골에 도달했을 때, 다음 라운드로 갈지 전체 클리어인지
 * 결정한다. 라운드 번호는 더 이상 진척도의 파생값이 아니라, 이 명시적 이벤트
 * (스테이지 골 도달)로만 전이되는 독립 상태다 — 라운드마다 독립 스테이지로
 * 전환하는 구조로 바뀌면서, "라운드 전환"과 "스테이지 내부 세이브 포인트
 * 진척도"(`respawnPointFor` 등)를 분리했다.
 */
export function roundAfterClear(round: Round): { round: Round; cleared: boolean } {
  if (round >= MAX_ROUND) return { round, cleared: true };
  return { round: (round + 1) as Round, cleared: false };
}

/**
 * 세이브 포인트 활성화 반경(px) — 캐릭터 중심이 체크포인트 중심에서 이 거리
 * 안에 들어오면 활성화된다. 통로 폭(2칸 = 80px)의 절반이라, 체크포인트가 놓인
 * 통로를 지나가면 사실상 반드시 접촉한다(체크포인트는 항상 통로 셀 중앙에 있다).
 * 골 도달 판정에도 같은 반경·함수를 재사용한다(`GameCanvas.tsx`의 `justCleared` 참고).
 */
export const CHECKPOINT_TOUCH_RADIUS = 40;

/**
 * 캐릭터가 체크포인트를 실제로 밟았는지(활성화 반경 안에 들어왔는지).
 * 이름은 체크포인트 기준이지만 임의의 지점(골 포함) 접촉 판정에 그대로 쓸 수 있는 범용 함수다.
 */
export function hasTouchedCheckpoint(character: Point, checkpoint: Point): boolean {
  return Math.hypot(character.x - checkpoint.x, character.y - checkpoint.y) <= CHECKPOINT_TOUCH_RADIUS;
}

/**
 * 사망 리스폰 지점 — 그동안 **직접 밟아 활성화한** 체크포인트 중 가장 마지막
 * 것(없으면 스폰)으로 되돌린다. 세이브 포인트를 하나도 안 밟고 진행하는 것은
 * 정상 플레이이며(그 경우 항상 스폰으로 되돌아간다), 골까지 그대로 클리어할 수도 있다.
 *
 * 활성화 판정을 진행도(스폰 기준 BFS 거리) 비교로 하던 이전 방식은, 그 값이
 * 방향 정보가 없는 스칼라라서 체크포인트와 정반대 갈래로 진행해도 "통과"로
 * 처리됐다 — 밟은 적 없는 세이브 포인트가 활성 표시되고, 죽으면 가본 적도 없는
 * 지점에서 리스폰되는 버그였다(실측: 전 라운드 전 체크포인트에서 재현). 판정
 * 기준을 실제 접촉(`hasTouchedCheckpoint`)으로 바꿔 원리적으로 차단한다.
 *
 * `reached`는 `checkpoints`와 순서·길이가 같은 활성화 여부다 — 호출부
 * (`ui/GameCanvas.tsx`)가 프레임마다 접촉을 검사해 한 번 true가 되면 유지(래치)한다.
 */
export function respawnPointFor(spawn: Point, checkpoints: Point[], reached: readonly boolean[]): Point {
  let respawn = spawn;
  for (let i = 0; i < checkpoints.length; i++) {
    if (reached[i]) respawn = checkpoints[i];
  }
  return respawn;
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

/**
 * 라운드별 배경 밝기 배율 — `backgroundArt.ts`가 로드하는 배경 이미지 한 장을
 * 라운드마다 다른 밝기로 보여주기 위한 값(PR #17 리뷰: round2/3용 PNG를 밝기만
 * 다르게 별도로 구워 4.6MB를 중복 보관하고 있었다). 값이 작을수록 어둡다 —
 * 라운드가 올라갈수록 시야가 좁아지는 긴장감을 준다.
 */
export const ROUND_BACKGROUND_BRIGHTNESS: Record<Round, number> = {
  1: 1,
  2: 0.65,
  3: 0.3,
};
