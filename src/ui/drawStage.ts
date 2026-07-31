import type { Stage } from "../core/stage";

/**
 * 스테이지 배경과 지형(벽 셀)·골 지점을 그린다. 배경은 라운드별 정적 아트
 * (`backgroundArt.ts`)이고, 벽은 시드마다 통로 모양이 달라지는 절차적 타일이라
 * 배경 그림과 픽셀 단위로 맞지 않는다 — 그래서 벽을 불투명 사각형이 아니라
 * "그림자 세계의 경계"처럼 보이는 반투명 오버레이로 그려, 배경과 정확히 겹치지
 * 않아도 위화감이 적게 만든다. 배경 이미지가 없으면(로드 실패·미확보) 기존
 * 단색 배경으로 폴백한다.
 */
export function drawStage(ctx: CanvasRenderingContext2D, stage: Stage, background: HTMLImageElement | null): void {
  const { grid } = stage;
  const mapWidth = grid.cols * grid.tileSize;
  const mapHeight = grid.rows * grid.tileSize;

  if (background) {
    ctx.drawImage(background, 0, 0, mapWidth, mapHeight);
  } else {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, mapWidth, mapHeight);
  }

  ctx.fillStyle = "rgba(20, 10, 30, 0.55)";
  ctx.strokeStyle = "rgba(180, 140, 220, 0.35)";
  ctx.lineWidth = 2;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.cells[row * grid.cols + col] === 1) {
        const x = col * grid.tileSize;
        const y = row * grid.tileSize;
        ctx.fillRect(x, y, grid.tileSize, grid.tileSize);
        ctx.strokeRect(x, y, grid.tileSize, grid.tileSize);
      }
    }
  }

  ctx.shadowColor = "rgba(74, 144, 217, 0.9)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#4a90d9";
  for (const checkpoint of stage.checkpoints) {
    ctx.beginPath();
    ctx.arc(checkpoint.x, checkpoint.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowColor = "rgba(245, 166, 35, 0.9)";
  ctx.fillStyle = "#f5a623";
  ctx.beginPath();
  ctx.arc(stage.goal.x, stage.goal.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}
