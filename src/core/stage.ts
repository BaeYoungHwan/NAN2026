export interface Point {
  x: number;
  y: number;
}

/**
 * 스테이지 데이터 계약 — procgen이 생성하고 shadow(판정)·core(렌더러)가 그대로 공유한다.
 * ADR-002: 안전 구역은 레벨 고정 폴리곤이 아니라 캐릭터에 부착되어 광원-캐릭터
 * 상대 위치로 매 프레임 재계산되므로, Stage는 boundaryPolygon을 갖지 않는다.
 */
export interface Stage {
  lightPos: Point;
  obstacles: Point[][];
  spawn: Point;
}
