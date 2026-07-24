import type { Point, TileGrid } from "../core/stage";
import { isReachable } from "../procgen/reachability";

/** 셀 방문 횟수 — "col,row" 키. GameCanvas가 매 프레임 캐릭터가 있는 셀을 누적한다. */
export type VisitCounts = Map<string, number>;

/** 픽셀 좌표 → "col,row" 키. `VisitCounts` 기록·조회 양쪽에서 같은 포맷을 쓰기 위해 공유한다. */
export function cellKey(grid: TileGrid, point: Point): string {
  const col = Math.floor(point.x / grid.tileSize);
  const row = Math.floor(point.y / grid.tileSize);
  return `${col},${row}`;
}

/**
 * 방문 빈도가 높은 순으로 최대 `maxBlocks`개 셀을 차단 후보로 고른다 — 단순 빈도
 * 기반 이동 패턴 학습(PRD §12). `protectedCells`(스폰·체크포인트·골)는 절대 막지
 * 않고, 막았을 때 `protectedCells[0]`(보통 스폰)에서 나머지 지점까지 도달가능성이
 * 깨지는 셀도 건너뛴다 — 이 스테이지의 통로는 분기 없는 단일 경로라 중간을 막으면
 * 스테이지 자체가 풀리지 않게 될 수 있어서다. 조건을 만족하는 셀이 모자라면
 * 그만큼만 반환한다(강제로 채우지 않음).
 */
export function selectBlockedCells(
  visits: VisitCounts,
  grid: TileGrid,
  protectedCells: Point[],
  maxBlocks: number,
): Point[] {
  const protectedKeys = new Set(protectedCells.map((p) => cellKey(grid, p)));
  const candidates = Array.from(visits.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)
    .filter((key) => !protectedKeys.has(key));

  // 실제 grid는 건드리지 않고 복사본으로 후보를 검증한다(여러 차단을 누적 검증).
  const trialCells = grid.cells.slice();
  const trialGrid: TileGrid = { ...grid, cells: trialCells };
  const anchor = protectedCells[0];

  const blocked: Point[] = [];
  for (const key of candidates) {
    if (blocked.length >= maxBlocks) break;

    const [col, row] = key.split(",").map(Number);
    const idx = row * grid.cols + col;
    if (trialCells[idx] === 1) continue; // 이미 벽

    trialCells[idx] = 1;
    const stillConnected = protectedCells.slice(1).every((point) => isReachable(trialGrid, anchor, point));

    if (stillConnected) {
      blocked.push({ x: (col + 0.5) * grid.tileSize, y: (row + 0.5) * grid.tileSize });
    } else {
      trialCells[idx] = 0; // 되돌리기 — 이 후보는 포기
    }
  }

  return blocked;
}
