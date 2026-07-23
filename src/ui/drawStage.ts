import type { Stage } from "../core/stage";

/**
 * 스테이지 지형(벽 셀)과 골 지점을 그린다. 아직 실제 아트 에셋이 없으므로
 * 기본 도형으로 렌더링한다 — 나중에 아트가 확정되면 이 함수만 스프라이트
 * draw로 교체하면 된다(다른 로직은 grid 데이터에만 의존, 렌더와 무관).
 */
export function drawStage(ctx: CanvasRenderingContext2D, stage: Stage): void {
  const { grid } = stage;

  ctx.fillStyle = "#4a4a5a";
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.cells[row * grid.cols + col] === 1) {
        ctx.fillRect(col * grid.tileSize, row * grid.tileSize, grid.tileSize, grid.tileSize);
      }
    }
  }

  ctx.fillStyle = "#f5a623";
  ctx.beginPath();
  ctx.arc(stage.goal.x, stage.goal.y, 12, 0, Math.PI * 2);
  ctx.fill();
}
