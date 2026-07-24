import type { Point, TileGrid } from "../core/stage";

/**
 * BFS로 `from`에서 `to`까지 walkable 셀(0)만 지나서 도달 가능한지 확인한다.
 * 픽셀 좌표를 grid 셀로 변환해서 검사하며, 그 외 grid 형태에 대한 가정은 없다 —
 * procgen(스테이지 생성)과 ai(경로 차단 후보 검증) 양쪽에서 재사용한다.
 *
 * `from`/`to` 자신이 벽 셀이면 항상 false다(그 지점엔 애초에 있을 수 없으므로) —
 * `from === to`인 특수 케이스도 이 규칙을 그대로 따른다.
 */
export function isReachable(grid: TileGrid, from: Point, to: Point): boolean {
  const startCol = Math.floor(from.x / grid.tileSize);
  const startRow = Math.floor(from.y / grid.tileSize);
  const goalCol = Math.floor(to.x / grid.tileSize);
  const goalRow = Math.floor(to.y / grid.tileSize);

  if (grid.cells[startRow * grid.cols + startCol] === 1 || grid.cells[goalRow * grid.cols + goalCol] === 1) {
    return false;
  }

  const visited = new Set<number>([startRow * grid.cols + startCol]);
  const queue: Array<[number, number]> = [[startCol, startRow]];

  while (queue.length > 0) {
    const [col, row] = queue.shift()!;
    if (col === goalCol && row === goalRow) return true;

    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nc >= grid.cols || nr < 0 || nr >= grid.rows) continue;
      const key = nr * grid.cols + nc;
      if (visited.has(key)) continue;
      if (grid.cells[key] === 1) continue;
      visited.add(key);
      queue.push([nc, nr]);
    }
  }

  return false;
}
