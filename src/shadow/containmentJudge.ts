import type { Point } from "../core/stage";
import type { Shadow } from "./shadowCaster";

/**
 * 점이 볼록 다각형 안(경계선 포함)에 있는지 판정한다.
 * 모든 변에 대해 외적 부호가 일관되면(0 포함) 내부로 판단한다.
 * ADR-001: 경계선 위/정점에 정확히 걸치는 공선(collinear) 케이스는 "안전"으로 취급한다.
 */
export function isPointInConvexPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) {
    throw new Error("boundaryPolygon must have at least 3 points");
  }

  let sign = 0;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const edgeX = b.x - a.x;
    const edgeY = b.y - a.y;
    const toPointX = point.x - a.x;
    const toPointY = point.y - a.y;
    const cross = edgeX * toPointY - edgeY * toPointX;

    if (cross === 0) {
      // 변 위에 정확히 걸침 — 안전(포함)으로 취급하고 다음 변 계속 확인
      continue;
    }

    const currentSign = cross > 0 ? 1 : -1;
    if (sign === 0) {
      sign = currentSign;
    } else if (currentSign !== sign) {
      return false;
    }
  }

  return true;
}

/**
 * 그림자 선분이 안전 경계(볼록 다각형) 안에 완전히 포함되는지 판정한다.
 * 볼록 다각형에서는 두 끝점이 모두 내부면 선분 전체도 내부다 — 별도의
 * 선분-변 교차 판정이 필요 없다 (ADR-001 "구현 시 주의사항" 참고).
 */
export function isShadowContained(shadow: Shadow, boundaryPolygon: Point[]): boolean {
  return (
    isPointInConvexPolygon(shadow.base, boundaryPolygon) &&
    isPointInConvexPolygon(shadow.tip, boundaryPolygon)
  );
}
