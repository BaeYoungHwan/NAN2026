import { useEffect, useMemo, useRef, useState } from "react";
import type { Point, Stage } from "../core/stage";
import { useKeyboardInput } from "../core/input";
import { CHARACTER_RADIUS, moveCharacter } from "../physics/character";
import { createGridCollider } from "../physics/collider";
import { naturalAngle, shadowTip } from "../shadow/shadowCaster";
import { isShadowAligned } from "../shadow/containmentJudge";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_SEED,
  ROTATION_SPEED,
  SAFE_ANGLE_TOLERANCE,
  SHADOW_LENGTH,
  generateStage,
} from "../procgen/stageGenerator";
import { drawStage } from "./drawStage";

const SAFE_ZONE_RADIUS = SHADOW_LENGTH + 20;
const GOAL_RADIUS = 40; // 골 도달 판정 반경(px)

/**
 * 두 객체를 동시에 조종하는 프로토타입 (ADR-002):
 * - 캐릭터는 WASD로 이동 (벽 충돌 반영)
 * - 그림자는 , . 로 직접 회전 (광원 위치와 무관, 자동 복귀 없음)
 * - 안전 구역(캐릭터 뒤, 광원 반대 방향 ± 허용각)은 광원-캐릭터 위치로 매 프레임 재계산됨
 * - 그림자 각도가 안전 구역을 벗어나면 즉시 스폰 위치로 리셋
 * - 골 지점에 도달하면 클리어
 */
function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useKeyboardInput();
  const [stage] = useState<Stage>(() => generateStage(DEFAULT_SEED));
  const canOccupy = useMemo(() => createGridCollider(stage.grid, CHARACTER_RADIUS), [stage]);
  const characterRef = useRef<Point>({ ...stage.spawn });
  const shadowAngleRef = useRef(naturalAngle(stage.lightPos, stage.spawn));
  const deathCountRef = useRef(0);
  const clearedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;
    let lastTime = performance.now();

    const draw = (time: number) => {
      if (clearedRef.current) return;

      const deltaSeconds = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      characterRef.current = moveCharacter(characterRef.current, inputRef.current, deltaSeconds, canOccupy);

      if (inputRef.current.rotateCW) {
        shadowAngleRef.current += ROTATION_SPEED * deltaSeconds;
      }
      if (inputRef.current.rotateCCW) {
        shadowAngleRef.current -= ROTATION_SPEED * deltaSeconds;
      }

      const natural = naturalAngle(stage.lightPos, characterRef.current);
      const aligned = isShadowAligned(shadowAngleRef.current, natural, SAFE_ANGLE_TOLERANCE);

      if (!aligned) {
        characterRef.current = { ...stage.spawn };
        shadowAngleRef.current = naturalAngle(stage.lightPos, stage.spawn);
        deathCountRef.current += 1;
      }

      const distanceToGoal = Math.hypot(
        characterRef.current.x - stage.goal.x,
        characterRef.current.y - stage.goal.y,
      );
      if (distanceToGoal <= GOAL_RADIUS) {
        clearedRef.current = true;
      }

      renderFrame(ctx, stage, characterRef.current, shadowAngleRef.current, deathCountRef.current, clearedRef.current);

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [inputRef, stage, canOccupy]);

  return <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />;
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  characterPos: Point,
  shadowAngle: number,
  deathCount: number,
  cleared: boolean,
) {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawStage(ctx, stage);

  const natural = naturalAngle(stage.lightPos, characterPos);
  const aligned = isShadowAligned(shadowAngle, natural, SAFE_ANGLE_TOLERANCE);

  // 안전 구역 — 캐릭터 뒤(광원 반대 방향) ± 허용각 부채꼴
  ctx.beginPath();
  ctx.moveTo(characterPos.x, characterPos.y);
  ctx.arc(
    characterPos.x,
    characterPos.y,
    SAFE_ZONE_RADIUS,
    natural - SAFE_ANGLE_TOLERANCE,
    natural + SAFE_ANGLE_TOLERANCE,
  );
  ctx.closePath();
  ctx.fillStyle = "rgba(74, 144, 217, 0.25)";
  ctx.fill();
  ctx.strokeStyle = "#4a90d9";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 광원
  ctx.fillStyle = "#f5d547";
  ctx.beginPath();
  ctx.arc(stage.lightPos.x, stage.lightPos.y, 8, 0, Math.PI * 2);
  ctx.fill();

  // 그림자 — 정렬 여부에 따라 색을 바꿔 즉각적인 시각 피드백을 준다
  const tip = shadowTip(characterPos, shadowAngle, SHADOW_LENGTH);
  ctx.strokeStyle = aligned ? "#4caf50" : "#e53935";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(characterPos.x, characterPos.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  // 캐릭터
  ctx.fillStyle = "#eee";
  ctx.beginPath();
  ctx.arc(characterPos.x, characterPos.y, CHARACTER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // HUD
  ctx.fillStyle = "#eee";
  ctx.font = "16px sans-serif";
  ctx.fillText("WASD 이동 / , . 그림자 회전 — 주황 원(골)까지 이동하세요", 16, 24);
  ctx.fillText(`사망 횟수: ${deathCount}`, 16, 46);

  if (cleared) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#4caf50";
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("클리어!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.textAlign = "left";
  }
}

export default GameCanvas;
