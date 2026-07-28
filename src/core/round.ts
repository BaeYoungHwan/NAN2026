import type { Point, TileGrid } from "./stage";

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
 * 캐릭터 위치가 서 있는 셀의 진척도(스폰 기준 BFS 통로 거리)를 조회한다 —
 * "통로를 따라 얼마나 진행했는지"를 나타내는 지표. `distanceField`는
 * `procgen/reachability.ts`의 `bfsDistances`로 스폰 기준 미리 계산된 값이라
 * O(1) 조회만 한다.
 *
 * 이전에는 `stage.path`(carve 순서 점 목록) 중 유클리드 거리로 가장 가까운
 * 인덱스를 진척도로 썼는데(`nearestPathIndex`, 폐기됨), 벽을 전혀 모르는
 * 판정이라 절차적으로 생성된 통로가 자기 자신 근처를 지나가는 경우(흔함) 벽
 * 하나 너머의 먼 지점이 "가장 가깝다"고 오판해 체크포인트·골이 조기 통과
 * 처리될 수 있었다(실측 확인, ADR-003 "버그 수정 기록" 참고). `distanceField`는
 * 벽을 넘어갈 수 없는 그래프 거리라 이 문제가 구조적으로 재발할 수 없다.
 */
export function progressAt(grid: TileGrid, distanceField: Int32Array, position: Point): number {
  const col = Math.floor(position.x / grid.tileSize);
  const row = Math.floor(position.y / grid.tileSize);
  const value = distanceField[row * grid.cols + col];
  // 캐릭터는 collider에 의해 항상 walkable 셀에만 있으므로 -1(미도달/벽)은
  // 정상 경로에서는 나오지 않는다 — 방어적으로만 0 처리.
  return value >= 0 ? value : 0;
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

/** 진척도가 골의 진척도(`Stage.goalProgress`)에 도달했는지 — 이 라운드 스테이지 클리어 판정. */
export function isStageCleared(farthestProgress: number, goalProgress: number): boolean {
  return farthestProgress >= goalProgress;
}

/**
 * 사망 리스폰 지점 — `farthestProgress`를 그대로 쓰지 않고, 그동안 넘은
 * 체크포인트 중 가장 마지막 것(없으면 스폰)으로 되돌린다.
 *
 * `farthestProgress`는 살아있는 동안 매 프레임 "현재 위치"로 갱신되므로, 죽는
 * 바로 그 프레임에도 이미 사망 지점 자신을 가리킨다 — 이걸 리스폰 지점으로
 * 그대로 쓰면 사망 페널티가 전혀 없어진다(죽은 자리에서 바로 재개 — 실제로
 * 발견된 버그). 체크포인트 단위로 스냅해 죽음에 의미 있는 손실을 되돌려주되,
 * "체크포인트를 정확히 밟아야만" 인정되던 문제(세이브 포인트를 못 찍으면 죽은
 * 자리 근처로도 못 돌아오던 문제)는 이 함수 자체가 `farthestProgress`(지나치기만
 * 해도 갱신됨) 기준으로 판정하므로 해결된 상태를 유지한다.
 *
 * `checkpoints`/`checkpointProgress`는 순서·길이가 같고 오름차순이다
 * (`procgen/stageGenerator.ts`의 `generateStage` 재시도 게이트가 보장).
 */
export function respawnPointFor(
  farthestProgress: number,
  spawn: Point,
  checkpoints: Point[],
  checkpointProgress: number[],
): Point {
  let respawn = spawn;
  for (let i = 0; i < checkpointProgress.length; i++) {
    if (farthestProgress >= checkpointProgress[i]) respawn = checkpoints[i];
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
