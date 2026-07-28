export interface Point {
  x: number;
  y: number;
}

/**
 * 지형 그리드 — 0(walkable) / 1(wall) 셀 배열.
 * Uint8Array로 캐시 친화적이고, 벽-캐릭터 충돌판정·렌더링이 모두 이 그리드 하나만 참조한다.
 */
export interface TileGrid {
  cols: number;
  rows: number;
  tileSize: number;
  cells: Uint8Array;
}

/**
 * 스테이지 데이터 계약 — procgen이 생성하고 physics(충돌)·shadow(판정)·core(렌더러)가 그대로 공유한다.
 * ADR-002: 안전 구역은 레벨 고정 폴리곤이 아니라 캐릭터에 부착되어 광원-캐릭터
 * 상대 위치로 매 프레임 재계산되므로, grid는 오직 캐릭터의 물리적 이동에만 관여하고
 * 그림자 각도 판정(shadow/)과는 완전히 무관하다.
 * ADR-004: 광원은 통로 경로를 따라 여러 개(가로등) 배치되며, 매 프레임 캐릭터와
 * 가장 가까운 광원이 안전 구역 판정에 쓰인다(`shadow/shadowCaster.ts`의 `naturalAngle`).
 */
export interface Stage {
  lightSources: Point[];
  grid: TileGrid;
  spawn: Point;
  /**
   * 이 스테이지(=한 라운드) 내부의 세이브 포인트(시각 표시용) — 사망 시 리스폰
   * 기준이 된다(`core/round.ts`의 `respawnIndexFor`). 라운드 전환(다음 라운드용
   * 새 스테이지로 교체)과는 무관한, 스테이지 내부 개념이다.
   */
  checkpoints: Point[];
  /**
   * 체크포인트가 `path` 위에서 위치한 인덱스 — `checkpoints`와 순서·길이가 같다.
   * 사망 리스폰 판정(`respawnIndexFor`)은 캐릭터 위치가 아니라 이 인덱스와
   * `nearestPathIndex` 결과를 비교해서 이뤄진다(세이브 포인트를 정확히 밟지
   * 않아도, 그 지점을 지나쳐 더 멀리 갔다는 사실만으로 인정된다).
   */
  checkpointPathIndices: number[];
  /** 이 라운드 스테이지의 최종 목표 — 도달하면 다음 라운드용 새 스테이지로 전환되거나(마지막 라운드면) 전체 클리어된다. */
  goal: Point;
  /**
   * 스폰(index 0)부터 골(마지막 index)까지, carve된 순서 그대로의 통로 중심점
   * 목록 — 이 스테이지 내부에서의 진척도·사망 리스폰 지점을 "가장 멀리 도달한
   * path 인덱스"로 추적하는 데 쓴다(`core/round.ts`).
   */
  path: Point[];
}
