import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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
import { CHARACTER_RADIUS, moveCharacter, reverseMoveInput } from "../physics/character";
import { createGridCollider } from "../physics/collider";
import { naturalAngle, nearestLight, shadowTip } from "../shadow/shadowCaster";
import { isShadowAligned } from "../shadow/containmentJudge";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_SEED,
  LIGHT_SWITCH_GRACE_SECONDS,
  ROTATION_SPEED,
  SAFE_ANGLE_TOLERANCE,
  SHADOW_LENGTH,
  generateStage,
} from "../procgen/stageGenerator";
import { applyLearning, cellKey, MAX_AI_BLOCKS } from "../ai/pathBlocker";
import { drawStage } from "./drawStage";

const SAFE_ZONE_RADIUS = SHADOW_LENGTH + 20;
const TARGET_RADIUS = 40; // 세이브 포인트·골 도달 판정 반경(px)

export interface GameCanvasHandle {
  /** 캐릭터·그림자 각도·라운드·세이브 포인트를 스폰/1R 상태로 되돌린다 (사망 카운트는 건드리지 않는 수동 재시작용). */
  restart: () => void;
}

interface GameCanvasProps {
  /** 사망(정렬 이탈) 이벤트가 발생할 때만 호출된다 — 매 프레임 호출되지 않음. */
  onDeathCountChange?: (count: number) => void;
  /** 라운드가 바뀔 때만 호출된다(골 도달로 1R→2R→3R 진행 시) — 매 프레임 호출되지 않음. stageCleared는 3R 골 도달(스테이지 전체 클리어) 여부. */
  onRoundChange?: (round: Round, stageCleared: boolean) => void;
  /** true인 동안 캐릭터 이동·그림자 회전·판정을 멈춘다 (저승사자 대사 표시 중 등). */
  inputDisabled?: boolean;
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
 * - 이동 패턴 학습 AI(단순 빈도 기반, PRD §12): 캐릭터가 새 셀에 들어갈 때마다
 *   방문 횟수를 누적하고, 재시작 시 가장 자주 지나간 셀 중 스테이지를 풀 수
 *   없게 만들지 않는 셀만 골라 벽으로 추가한다(`src/ai/pathBlocker.ts`). 학습은
 *   세션 내에서만 누적되며(새로고침 시 초기화), 라운드/사망 리셋에는 영향 없음.
 *
 * 스테이지는 리액트 상태가 아니라 `stageRef`로 들고 있다 — 재시작마다 스테이지
 * 객체 자체가 바뀌는데(학습 반영), 게임 루프(rAF)가 그 시점에 아직 안 바뀐
 * 클로저를 참조해 한두 프레임 옛 스테이지로 렌더링되는 걸 막기 위함이다.
 * 렌더링에 굳이 리액트 리렌더가 필요 없으므로(캔버스 하나만 그리는 구조) 상태로
 * 둘 이유가 없다.
 */
const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(function GameCanvas(
  { onDeathCountChange, onRoundChange, inputDisabled = false },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useKeyboardInput();
  // useState는 세터를 쓰지 않고 "한 번만 계산되는 초기값" 용도로만 쓴다 —
  // 실제 최신값은 항상 stageRef로 읽는다(위 주석 참고).
  const [initialStage] = useState<Stage>(() => generateStage(DEFAULT_SEED));
  const stageRef = useRef<Stage>(initialStage);
  const characterRef = useRef<Point>({ ...stageRef.current.spawn });
  const shadowAngleRef = useRef(naturalAngle(stageRef.current.lightSources, stageRef.current.spawn));
  const deathCountRef = useRef(0);
  const roundRef = useRef<Round>(1);
  const clearedRef = useRef(false);
  // 마지막으로 통과한 세이브 포인트 — 사망 시 이 지점으로 리스폰한다(스폰 지점 아님).
  const savePointRef = useRef<Point>({ ...stageRef.current.spawn });
  // 직전 프레임의 최근접(활성) 광원 — 바뀌는 순간을 감지해 판정 유예를 주기 위함 (ADR-004).
  const activeLightRef = useRef<Point>(nearestLight(stageRef.current.lightSources, stageRef.current.spawn));
  // 광원 전환 유예 남은 시간(초) — 0보다 크면 이번 프레임 정렬 판정을 건너뛴다.
  const lightSwitchGraceRef = useRef(0);
  // 이동 패턴 학습 AI — 캐릭터가 지나간 셀 방문 횟수. 세션 내내 누적(재시작해도 초기화 안 함).
  const visitCountsRef = useRef(new Map<string, number>());
  // 방문 카운트를 "셀에 들어간 순간"에만 올리기 위한 직전 셀 키(가만히 서 있는 시간은 세지 않음).
  const lastVisitedCellKeyRef = useRef<string | null>(null);
  // stage 참조가 바뀔 때만(=재시작 시) 충돌판정 함수를 새로 만든다 — 매 프레임 재생성 방지.
  const colliderCacheRef = useRef<{ stage: Stage; canOccupy: (point: Point) => boolean } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      restart: () => {
        const previousStage = stageRef.current;
        const nextStage = applyLearning(DEFAULT_SEED, previousStage, visitCountsRef.current, MAX_AI_BLOCKS);

        stageRef.current = nextStage;
        characterRef.current = { ...nextStage.spawn };
        shadowAngleRef.current = naturalAngle(nextStage.lightSources, nextStage.spawn);
        savePointRef.current = { ...nextStage.spawn };
        activeLightRef.current = nearestLight(nextStage.lightSources, nextStage.spawn);
        lightSwitchGraceRef.current = 0;
        roundRef.current = 1;
        lastVisitedCellKeyRef.current = null;
        onRoundChange?.(1, false);
        clearedRef.current = false;
      },
    }),
    [onRoundChange],
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
      const stage = stageRef.current;

      if (!clearedRef.current && !inputDisabled) {
        if (colliderCacheRef.current?.stage !== stage) {
          colliderCacheRef.current = { stage, canOccupy: createGridCollider(stage.grid, CHARACTER_RADIUS) };
        }
        const canOccupy = colliderCacheRef.current.canOccupy;
        const moveInput = controlsReversed(roundRef.current)
          ? reverseMoveInput(inputRef.current)
          : inputRef.current;
        characterRef.current = moveCharacter(characterRef.current, moveInput, deltaSeconds, canOccupy);

        const visitKey = cellKey(stage.grid, characterRef.current);
        if (visitKey !== lastVisitedCellKeyRef.current) {
          visitCountsRef.current.set(visitKey, (visitCountsRef.current.get(visitKey) ?? 0) + 1);
          lastVisitedCellKeyRef.current = visitKey;
        }

        if (inputRef.current.rotateCW) {
          shadowAngleRef.current += ROTATION_SPEED * deltaSeconds;
        }
        if (inputRef.current.rotateCCW) {
          shadowAngleRef.current -= ROTATION_SPEED * deltaSeconds;
        }

        // 최근접(활성) 광원이 바뀌는 순간을 감지해 판정 유예를 건다 — 광원 전환
        // 시 요구 각도가 최대 180도 가까이 순간적으로 바뀔 수 있는데, 회전
        // 속도로는 한 프레임 안에 따라잡을 수 없어 그대로 두면 무조건 죽는다
        // (ADR-004). 유예 동안은 정렬이 깨져도 죽지 않는다.
        const currentActiveLight = nearestLight(stage.lightSources, characterRef.current);
        if (currentActiveLight.x !== activeLightRef.current.x || currentActiveLight.y !== activeLightRef.current.y) {
          lightSwitchGraceRef.current = LIGHT_SWITCH_GRACE_SECONDS;
          activeLightRef.current = currentActiveLight;
        }

        // 체크포인트/골 도달 판정을 정렬 판정보다 먼저 확인한다 — 광원 전환
        // 경계선이 체크포인트 포착 반경과 우연히 겹치면(ADR-004), 도달하는 바로
        // 그 프레임에 정렬이 깨질 수 있는데, 그 경우에도 "닿았다"는 사실은
        // 항상 인정되어야 한다(도달 프레임엔 정렬 판정을 건너뜀). 그 외
        // 구간에서는 기존과 동일하게 매 프레임 정렬을 검사한다.
        const target = roundTarget(roundRef.current, stage.checkpoints, stage.goal);
        const distanceToTarget = Math.hypot(characterRef.current.x - target.x, characterRef.current.y - target.y);
        const reachedTarget = distanceToTarget <= TARGET_RADIUS;

        if (reachedTarget) {
          const { round, stageCleared } = advanceRound(roundRef.current);
          if (stageCleared) {
            clearedRef.current = true;
          } else {
            savePointRef.current = { ...target };
          }
          roundRef.current = round;
          onRoundChange?.(round, stageCleared);
        } else {
          const tolerance = effectiveAngleTolerance(roundRef.current, SAFE_ANGLE_TOLERANCE);
          const natural = naturalAngle(stage.lightSources, characterRef.current);
          const aligned = isShadowAligned(shadowAngleRef.current, natural, tolerance);

          if (!aligned && lightSwitchGraceRef.current <= 0) {
            characterRef.current = { ...savePointRef.current };
            shadowAngleRef.current = naturalAngle(stage.lightSources, savePointRef.current);
            deathCountRef.current += 1;
            onDeathCountChange?.(deathCountRef.current);
            activeLightRef.current = nearestLight(stage.lightSources, savePointRef.current);
          }
        }

        if (lightSwitchGraceRef.current > 0) {
          lightSwitchGraceRef.current = Math.max(0, lightSwitchGraceRef.current - deltaSeconds);
        }
      }

      renderFrame(ctx, stage, characterRef.current, shadowAngleRef.current, roundRef.current, clearedRef.current);

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [inputRef, onDeathCountChange, onRoundChange, inputDisabled]);

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
  const natural = naturalAngle(stage.lightSources, characterPos);
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

  // 광원(가로등) — 여러 개 중 지금 판정에 쓰이는(최근접) 광원만 밝게 강조해,
  // 안전 구역이 왜 이동했는지 플레이어가 알아볼 수 있게 한다 (ADR-004). 활성
  // 광원은 캐릭터 반경(10px)보다 큰 바깥 링도 함께 그려, 캐릭터가 광원 바로
  // 위에 서 있어도(예: 스폰 지점) 강조 표시가 가려지지 않게 한다.
  const activeLight = nearestLight(stage.lightSources, characterPos);
  for (const light of stage.lightSources) {
    const isActive = light === activeLight;
    ctx.fillStyle = isActive ? "#f5d547" : "#8a7a3a";
    ctx.beginPath();
    ctx.arc(light.x, light.y, isActive ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();

    if (isActive) {
      ctx.strokeStyle = "#f5d547";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(light.x, light.y, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

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
