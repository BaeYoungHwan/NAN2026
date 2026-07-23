import { useEffect, useRef } from "react";
import type { Point } from "../core/stage";
import { useKeyboardInput } from "../core/input";
import { moveCharacter } from "../entities/character";
import { castShadow } from "../shadow/shadowCaster";
import { isShadowContained } from "../shadow/containmentJudge";
import { SHADOW_LENGTH, STATIC_STAGE } from "../procgen/staticStage";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CHARACTER_RADIUS = 10;
const CANVAS_BOUNDS = { minX: 0, minY: 0, maxX: CANVAS_WIDTH, maxY: CANVAS_HEIGHT };

/**
 * 정적 스테이지(STATIC_STAGE)로 캐릭터 이동 + 그림자 계산 + 경계 포함 판정을
 * 실시간 시각화하는 프로토타입. 그림자가 안전 경계를 벗어나면 즉시 스폰
 * 위치로 리셋한다 (PRD "실패 시 즉시 재시작" 요구사항).
 */
function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useKeyboardInput();
  const characterRef = useRef<Point>({ ...STATIC_STAGE.spawn });
  const deathCountRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;
    let lastTime = performance.now();

    const draw = (time: number) => {
      // 탭 비활성화 등으로 인한 비정상적으로 큰 델타는 0.1초로 clamp한다.
      const deltaSeconds = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      characterRef.current = moveCharacter(
        characterRef.current,
        inputRef.current,
        deltaSeconds,
        CANVAS_BOUNDS,
      );

      const shadow = castShadow(STATIC_STAGE.lightPos, characterRef.current, SHADOW_LENGTH);
      const contained = isShadowContained(shadow, STATIC_STAGE.boundaryPolygon);

      if (!contained) {
        characterRef.current = { ...STATIC_STAGE.spawn };
        deathCountRef.current += 1;
      }

      renderFrame(ctx, characterRef.current, deathCountRef.current);

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [inputRef]);

  return <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />;
}

function renderFrame(ctx: CanvasRenderingContext2D, characterPos: Point, deathCount: number) {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 안전 경계 (1R 가이드라인 — 현재는 항상 표시, 라운드별 표시/제거는 별도 태스크)
  ctx.strokeStyle = "#4a90d9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  STATIC_STAGE.boundaryPolygon.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.stroke();

  // 광원
  ctx.fillStyle = "#f5d547";
  ctx.beginPath();
  ctx.arc(STATIC_STAGE.lightPos.x, STATIC_STAGE.lightPos.y, 8, 0, Math.PI * 2);
  ctx.fill();

  // 그림자 — 경계 포함 여부에 따라 색을 바꿔 즉각적인 시각 피드백을 준다
  const shadow = castShadow(STATIC_STAGE.lightPos, characterPos, SHADOW_LENGTH);
  const contained = isShadowContained(shadow, STATIC_STAGE.boundaryPolygon);

  ctx.strokeStyle = contained ? "#4caf50" : "#e53935";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(shadow.base.x, shadow.base.y);
  ctx.lineTo(shadow.tip.x, shadow.tip.y);
  ctx.stroke();

  // 캐릭터
  ctx.fillStyle = "#eee";
  ctx.beginPath();
  ctx.arc(characterPos.x, characterPos.y, CHARACTER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // HUD
  ctx.fillStyle = "#eee";
  ctx.font = "16px sans-serif";
  ctx.fillText("WASD / 방향키로 이동 — 그림자가 파란 경계를 벗어나면 리셋", 16, 24);
  ctx.fillText(`사망 횟수: ${deathCount}`, 16, 46);
}

export default GameCanvas;
