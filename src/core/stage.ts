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
 */
export interface Stage {
  lightPos: Point;
  grid: TileGrid;
  spawn: Point;
  /**
   * 라운드 전환 세이브 포인트 — 통과하면 해당 라운드가 끝나고 다음 라운드로 즉시
   * 전환된다(스폰으로 되돌아가지 않음). 이후 사망 시 리스폰 지점도 이 지점으로
   * 바뀐다. 배열 순서가 라운드 순서(1R→2R 전환점, 2R→3R 전환점, ...)와 같다.
   */
  checkpoints: Point[];
  goal: Point;
  /**
   * 이동 패턴 학습 AI가 자주 다닌 경로를 학습해 추가로 막은 셀 — 일반 벽과 달리
   * 렌더링에서 구분 표시한다(어떤 벽이 "AI가 막은 것"인지 플레이어가 알 수 있게).
   * `generateStage`의 `extraWalls` 인자로 넘긴 셀들이 그대로 담긴다.
   */
  aiBlockedCells: Point[];
}
