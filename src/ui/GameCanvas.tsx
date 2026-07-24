import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Point, Stage } from "../core/stage";
import { useKeyboardInput } from "../core/input";
import {
  advanceRound,
  controlsReversed,
  effectiveAngleTolerance,
  isGuideVisible,
  roundTarget,
  type Round,
} from "../core/round";
import { CHARACTER_RADIUS, moveCharacter, type MoveInput } from "../physics/character";
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
const TARGET_RADIUS = 40; // 세이브 포인트·골 도달 판정 반경(px)

/** 3R 디메리트 — WASD 이동키의 상하좌우를 반전시킨다(그림자 회전키는 대상 아님). */
function reverseControls(input: MoveInput): MoveInput {
  return { up: input.down, down: input.up, left: input.right, right: input.left };
}

export interface GameCanvasHandle {
  /** 캐릭터·그림자 각도를 스폰 상태로 되돌린다 (사망 카운트는 건드리지 않는 수동 재시작용). */
  restart: () => void;
}

interface GameCanvasProps {
  /** 사망(정렬 이탈) 이벤트가 발생할 때만 호출된다 — 매 프레임 호출되지 않음. */
  onDeathCountChange?: (count: number) => void;
  /** 라운드가 바뀔 때만 호출된다(1R→2R→3R) — 매 프레임 호출되지 않음. */
  onRoundChange?: (round: Round) => void;
}

/**
 * 두 객체를 동시에 조종하는 프로토타입 (ADR-002):
 * - 캐릭터는 WASD로 이동 (벽 충돌 반영)
 * - 그림자는 , . 로 직접 회전 (광원 위치와 무관, 자동 복귀 없음)
 * - 안전 구역(캐릭터 뒤, 광원 반대 방향 ± 허용각)은 광원-캐릭터 위치로 매 프레임 재계산됨
 * - 그림자 각도가 안전 구역을 벗어나면 즉시 마지막 세이브 포인트로 리셋
 * - 하나의 스테이지(같은 통로)를 세이브 포인트로 구간을 나눠 1R→2R→3R 순서로
 *   이어서 진행한다. 세이브 포인트 통과 시 캐릭터 위치는 그대로 두고 다음
 *   라운드로 즉시 전환하며(텔레포트 없음), 그 지점이 새 리스폰 기준이 된다.
 *   마지막 라운드에서 최종 골 도달 시 스테이지 전체 클리어. 1R은 안전 구역
 *   가이드라인(부채꼴)을 보여주고, 2R부터는 가이드라인을 숨긴다(그림자 색상
 *   피드백은 유지). 3R 디메리트: 허용 각도 축소 + WASD 이동키 상하좌우
 *   반전(그림자 회전키는 영향 없음) — PRD §7-1.
 */
const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(function GameCanvas(
  { onDeathCountChange, onRoundChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useKeyboardInput();
  const [stage] = useState<Stage>(() => generateStage(DEFAULT_SEED));
  const canOccupy = useMemo(() => createGridCollider(stage.grid, CHARACTER_RADIUS), [stage]);
  const characterRef = useRef<Point>({ ...stage.spawn });
  const shadowAngleRef = useRef(naturalAngle(stage.lightPos, stage.spawn));
  const deathCountRef = useRef(0);
  const roundRef = useRef<Round>(1);
  const clearedRef = useRef(false);
  // 마지막으로 통과한 세이브 포인트 — 사망 시 이 지점으로 리스폰한다(스폰 지점 아님).
  const savePointRef = useRef<Point>({ ...stage.spawn });

  useImperativeHandle(
    ref,
    () => ({
      restart: () => {
        characterRef.current = { ...stage.spawn };
        shadowAngleRef.current = naturalAngle(stage.lightPos, stage.spawn);
        savePointRef.current = { ...stage.spawn };
        roundRef.current = 1;
        onRoundChange?.(1);
        clearedRef.current = false;
      },
    }),
    [stage, onRoundChange],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;
    let lastTime = performance.now();

    const draw = (time: number) => {
      const deltaSeconds = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      if (!clearedRef.current) {
        const moveInput = controlsReversed(roundRef.current)
          ? reverseControls(inputRef.current)
          : inputRef.current;
        characterRef.current = moveCharacter(characterRef.current, moveInput, deltaSeconds, canOccupy);

        if (inputRef.current.rotateCW) {
          shadowAngleRef.current += ROTATION_SPEED * deltaSeconds;
        }
        if (inputRef.current.rotateCCW) {
          shadowAngleRef.current -= ROTATION_SPEED * deltaSeconds;
        }

        const tolerance = effectiveAngleTolerance(roundRef.current, SAFE_ANGLE_TOLERANCE);
        const natural = naturalAngle(stage.lightPos, characterRef.current);
        const aligned = isShadowAligned(shadowAngleRef.current, natural, tolerance);

        if (!aligned) {
          characterRef.current = { ...savePointRef.current };
          shadowAngleRef.current = naturalAngle(stage.lightPos, savePointRef.current);
          deathCountRef.current += 1;
          onDeathCountChange?.(deathCountRef.current);
        }

        const target = roundTarget(roundRef.current, stage.checkpoints, stage.goal);
        const distanceToTarget = Math.hypot(characterRef.current.x - target.x, characterRef.current.y - target.y);
        if (distanceToTarget <= TARGET_RADIUS) {
          const { round, stageCleared } = advanceRound(roundRef.current);
          if (stageCleared) {
            clearedRef.current = true;
          } else {
            savePointRef.current = { ...target };
          }
          roundRef.current = round;
          onRoundChange?.(round);
        }
      }

      renderFrame(ctx, stage, characterRef.current, shadowAngleRef.current, roundRef.current, clearedRef.current);

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [inputRef, stage, canOccupy, onDeathCountChange, onRoundChange]);

  return <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />;
});

export default GameCanvas;

function renderFrame(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  characterPos: Point,
  shadowAngle: number,
  round: Round,
  cleared: boolean,
) {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawStage(ctx, stage);

  const tolerance = effectiveAngleTolerance(round, SAFE_ANGLE_TOLERANCE);
  const natural = naturalAngle(stage.lightPos, characterPos);
  const aligned = isShadowAligned(shadowAngle, natural, tolerance);

  // 안전 구역 가이드라인 — 1R에서만 표시 (2R부터 제거, PRD §7-1)
  if (isGuideVisible(round)) {
    ctx.beginPath();
    ctx.moveTo(characterPos.x, characterPos.y);
    ctx.arc(characterPos.x, characterPos.y, SAFE_ZONE_RADIUS, natural - tolerance, natural + tolerance);
    ctx.closePath();
    ctx.fillStyle = "rgba(74, 144, 217, 0.25)";
    ctx.fill();
    ctx.strokeStyle = "#4a90d9";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 광원
  ctx.fillStyle = "#f5d547";
  ctx.beginPath();
  ctx.arc(stage.lightPos.x, stage.lightPos.y, 8, 0, Math.PI * 2);
  ctx.fill();

  // 그림자 — 정렬 여부에 따라 색을 바꿔 즉각적인 시각 피드백을 준다 (라운드 무관 항상 표시)
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
