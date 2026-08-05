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
   * 이 스테이지(=한 라운드) 내부의 세이브 포인트 — 캐릭터가 **직접 밟아야**
   * 활성화되고(`core/round.ts`의 `hasTouchedCheckpoint`), 활성화된 것 중 마지막
   * 지점이 사망 리스폰 기준이 된다(`respawnPointFor`). 밟지 않고 지나가거나
   * 아예 안 밟고 골까지 가는 것도 정상 플레이다. 라운드 전환(다음 라운드용
   * 새 스테이지로 교체)과는 무관한, 스테이지 내부 개념이다.
   */
  checkpoints: Point[];
  /** 이 라운드 스테이지의 최종 목표 — 도달하면 다음 라운드용 새 스테이지로 전환되거나(마지막 라운드면) 전체 클리어된다. */
  goal: Point;
  /**
   * 스폰(index 0)부터 골(마지막 index)까지, carve된 순서 그대로의 통로 중심점
   * 목록 — 광원(가로등) 배치(`placeLightSources`)의 기준 데이터다. 되돌아가는
   * 구간·막다른 갈래를 포함하므로 최단 경로가 아니며, 체크포인트 배치에도 쓰지
   * 않는다(그쪽은 `distanceField`로 역추적한 최단 경로를 쓴다 —
   * `computeCheckpointCells`). 런타임 진척도 판정에도 쓰이지 않는다
   * (`nearestPathIndex`가 벽을 무시해 벽 건너편의 공간적으로 가까운 인덱스를
   * 오판하는 문제가 있어 `distanceField` 기반으로 교체됨 — ADR-003 참고).
   */
  path: Point[];
  /**
   * 스폰 기준 각 walkable 셀까지의 BFS 최단거리(스텝 수) — `row*cols+col` 인덱스,
   * 미도달 셀은 -1(`procgen/reachability.ts`의 `bfsDistances`). 유클리드 거리와
   * 달리 벽을 넘어갈 수 없어, `procgen/stageGenerator.ts`가 체크포인트·골 배치를
   * 검증할 때(`computeCheckpointCells`, `isAscendingProgress`) 벽 건너편의 가까운
   * 지점을 진행도로 오판하는 일이 구조적으로 불가능하다. 런타임 클리어 판정에는
   * 더 이상 쓰이지 않는다(`core/round.ts`의 `hasTouchedCheckpoint` 실제 접촉
   * 판정으로 대체됨 — ADR-003 2026-08-05 기록 참고).
   */
  distanceField: Int32Array;
  /**
   * 각 `checkpoints[i]`의 `distanceField` 값 — 체크포인트를 코스 중간(진행도 기준)에
   * 놓았는지 확인하는 **배치 검증용**이다(오름차순 보장, `generateStage` 재시도
   * 게이트 참고). 런타임 활성화 판정에는 쓰지 않는다 — 방향 정보가 없는 스칼라라
   * 반대 갈래로 가도 통과 처리되던 버그의 원인이었다(`core/round.ts`의
   * `respawnPointFor` 주석 참고).
   */
  checkpointProgress: number[];
  /** `goal`의 `distanceField` 값 — 라운드(스테이지) 클리어 판정 기준. */
  goalProgress: number;
}
