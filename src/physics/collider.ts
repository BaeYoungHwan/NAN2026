import type { Point, TileGrid } from "../core/stage";

function isWallAt(grid: TileGrid, col: number, row: number): boolean {
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) {
    return true; // 그리드 밖은 벽으로 취급 — 캐릭터가 지형 밖으로 나가지 못하게 한다
  }
  return grid.cells[row * grid.cols + col] === 1;
}

/**
 * 캐릭터(반지름 radius인 원)가 주어진 위치를 차지할 수 있는지 판정하는 함수를 만든다.
 * 원을 바운딩 박스로 근사해, 겹치는 셀 중 하나라도 벽이면 점유 불가로 판정한다.
 * physics는 이 판정자만 주입받으므로 그리드 표현에 직접 결합되지 않는다.
 */
export function createGridCollider(grid: TileGrid, radius: number): (point: Point) => boolean {
  return (point: Point) => {
    const minCol = Math.floor((point.x - radius) / grid.tileSize);
    const maxCol = Math.floor((point.x + radius) / grid.tileSize);
    const minRow = Math.floor((point.y - radius) / grid.tileSize);
    const maxRow = Math.floor((point.y + radius) / grid.tileSize);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (isWallAt(grid, col, row)) return false;
      }
    }
    return true;
  };
}
