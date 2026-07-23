export interface Point {
  x: number;
  y: number;
}

/**
 * 스테이지 데이터 계약 — procgen이 생성하고 shadow(판정)·core(렌더러)가 그대로 공유한다.
 * ADR-001: boundaryPolygon은 기본적으로 볼록(convex) 다각형으로 생성한다.
 */
export interface Stage {
  lightPos: Point;
  boundaryPolygon: Point[];
  obstacles: Point[][];
  spawn: Point;
}
