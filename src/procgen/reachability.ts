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

/**
 * `from` 기준 모든 walkable 셀까지의 BFS 최단거리(스텝 수)를 계산한다 — 벽을 넘어갈 수
 * 없으므로, 유클리드 거리와 달리 두 지점이 공간적으로 가까워도 벽으로 분리돼 있으면 항상
 * 실제 통로 거리를 반환한다(`core/round.ts`의 `progressAt`이 이 값을 진척도로 쓴다).
 * 미도달 셀(벽 또는 `from`과 연결되지 않은 영역)은 -1.
 */
export function bfsDistances(grid: TileGrid, from: Point): Int32Array {
  const distances = new Int32Array(grid.cols * grid.rows).fill(-1);

  const startCol = Math.floor(from.x / grid.tileSize);
  const startRow = Math.floor(from.y / grid.tileSize);
  const startKey = startRow * grid.cols + startCol;
  if (grid.cells[startKey] === 1) return distances;

  distances[startKey] = 0;
  const queue: Array<[number, number]> = [[startCol, startRow]];

  while (queue.length > 0) {
    const [col, row] = queue.shift()!;
    const dist = distances[row * grid.cols + col];

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
      if (distances[key] !== -1) continue;
      if (grid.cells[key] === 1) continue;
      distances[key] = dist + 1;
      queue.push([nc, nr]);
    }
  }

  return distances;
}
