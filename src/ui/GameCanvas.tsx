import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Point, Stage } from "../core/stage";
import { useKeyboardInput } from "../core/input";
import { debugRoundFromQuery } from "../core/debugRound";
import {
  controlsReversed,
  effectiveAngleTolerance,
  isGuideVisible,
  isStageCleared,
  progressAt,
  respawnPointFor,
  roundAfterClear,
  type Round,
} from "../core/round";
import { CHARACTER_RADIUS, moveCharacter, reverseMoveInput } from "../physics/character";
import { createGridCollider } from "../physics/collider";
import { naturalAngle, nearestLight } from "../shadow/shadowCaster";
import { alignmentMargin } from "../shadow/containmentJudge";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_SEED,
  LIGHT_SWITCH_GRACE_SECONDS,
  ROTATION_SPEED,
  SAFE_ANGLE_TOLERANCE,
  SHADOW_LENGTH,
  generateStage,
  seedForRound,
} from "../procgen/stageGenerator";
import { drawStage } from "./drawStage";
import { loadBackgroundArt } from "./backgroundArt";
import {
  loadCharacterSprites,
  WALK_LEGS_OFFSET_X_PX,
  WALK_LEGS_OFFSET_Y_PX,
  WALK_TORSO_PIVOT_OFFSET_PX,
  WALK_REFERENCE_HEIGHT_PX,
  type BodyPose,
  type CharacterSprites,
  type ShadowExpression,
} from "./characterSprites";

const SAFE_ZONE_RADIUS = SHADOW_LENGTH + 20;
const DEATH_ANIM_MS = 1600; // 사망 시 4단계 애니메이션을 보여주는 동안 멈추는 시간
const BODY_DISPLAY_HEIGHT = 42; // 충돌 판정(CHARACTER_RADIUS)과 무관한 순수 표시 크기
const CAMERA_ZOOM = 2.2; // 캐릭터를 따라다니며 확대하는 배율 — 맵 전체 대신 주변만 크게 보여준다

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
const DEATH_FRAMES: readonly Exclude<BodyPose, "walk">[] = ["death1", "death2", "death3", "death4"];

/**
 * 위험도(alignmentMargin)에 따라 몸 포즈를 고른다 — 값이 클수록(경계에 가까울수록)
 * 더 위험한 포즈. 이동 중일 때는 위험도와 무관하게 항상 walk를 우선한다 — danger/
 * flinch로 강제 전환하면 걷는 도중 정지 포즈로 뚝 끊겨 보이는 문제가 있었다.
 * 이동 중 위험 표현은 drawWalkSprite의 떨림 폭을 위험도에 따라 키우는 것으로
 * 대신한다.
 */
export function selectBodyPose(margin: number, isMoving: boolean): BodyPose {
  if (isMoving) return "walk";
  if (margin >= 0.85) return "danger";
  if (margin >= 0.6) return "flinch";
  return "idle";
}

/**
 * 위험도(alignmentMargin)에 따라 그림자(바닥 실루엣)의 표정을 고른다 — selectBodyPose와
 * 동일한 임계값을 써서 몸 포즈·그림자 표정이 항상 같은 위험 구간에서 함께 바뀐다.
 * annoyed/disappointed/delighted 3종은 이번 구현에서는 트리거가 없어 비워둔다(추후 확장 여지).
 */
export function selectShadowExpression(margin: number): ShadowExpression {
  if (margin >= 0.85) return "scared";
  if (margin >= 0.6) return "surprised";
  return "normal";
}

// 4단계를 균등 배분하지 않고, ①(비틀거리다 쓰러짐)은 넉넉히 줘서 회전 연출이
// 읽히게 하고, ②③(그림자가 몸에서 빠져나감)은 길게, ④(빈 인형으로 남음)는
// 끝에서 가장 오래 유지한다 — 각 시트 설명("경계를 벗어나면 크게 흔들린다"
// 등)에 맞춘 타이밍.
const DEATH_PHASE_BOUNDARIES = [0, 0.16, 0.44, 0.7, 1] as const;
const DEATH_BLEND_WINDOW = 0.3; // 각 구간이 끝나기 전 이 비율만큼 다음 프레임과 겹쳐 크로스페이드
const FALL_TILT_MAX = Math.PI / 2.6; // ①구간 동안 캐릭터가 쓰러지며 기우는 최대 각도(약 70도)

export interface DeathFrameInfo {
  current: Exclude<BodyPose, "walk">;
  next: Exclude<BodyPose, "walk">;
  blend: number; // 0이면 current만, 1이면 next로 완전히 전환
  isImpactPhase: boolean; // ① 구간 — 흔들림 연출 적용
  impactFlash: number; // 사망 순간 1에서 시작해 ① 구간이 끝나며 0으로 사그라드는 화면 플래시 강도
  impactPulse: number; // ①→②로 넘어가는 "쓰러지는 순간"에 짧게 솟는 펄스 — 착지 충격 강조
  fallRotation: number; // ①구간 중 death1 프레임에만 적용하는 쓰러짐 회전각(라디안)
  soulBob: number; // ②③구간(그림자가 몸을 빠져나가는 동안) 위아래로 떠다니는 오프셋(px)
  vignette: number; // 사망이 진행될수록 짙어지는 화면 어두움 정도(0~1)
}

/** 사망 시퀀스 경과 시간(ms)으로 죽음 모션의 현재/다음 프레임과 크로스페이드 비율을 계산한다. */
export function deathFrameInfo(elapsedMs: number, totalMs: number, time: number): DeathFrameInfo {
  const t = Math.min(1, elapsedMs / totalMs);
  let phase = DEATH_FRAMES.length - 1;
  for (let i = 0; i < DEATH_FRAMES.length; i++) {
    if (t < DEATH_PHASE_BOUNDARIES[i + 1]) {
      phase = i;
      break;
    }
  }
  const phaseStart = DEATH_PHASE_BOUNDARIES[phase];
  const phaseEnd = DEATH_PHASE_BOUNDARIES[phase + 1] ?? 1;
  const phaseProgress = phaseEnd > phaseStart ? (t - phaseStart) / (phaseEnd - phaseStart) : 1;
  const nextPhase = Math.min(DEATH_FRAMES.length - 1, phase + 1);
  const blendStart = 1 - DEATH_BLEND_WINDOW;
  const blend = phase < DEATH_FRAMES.length - 1 && phaseProgress > blendStart ? (phaseProgress - blendStart) / DEATH_BLEND_WINDOW : 0;
  const impactFlash = phase === 0 ? Math.max(0, 1 - phaseProgress * 1.4) : 0;

  // 쓰러지는 순간(①→② 경계, t=phase0End)에 짧게 솟구쳤다 사그라드는 펄스 — 충격음 없이도 "쿵" 하는 무게감을 준다.
  const phase0End = DEATH_PHASE_BOUNDARIES[1];
  const impactPulse = Math.max(0, 1 - Math.abs(t - phase0End) / 0.05);

  // death1은 원래 그림이 서있는 포즈라, ①구간 동안 가속하며(제자리서 휘청이다
  // 쓰러지듯) 기울여서 death2(이미 누워있는 그림)로의 전환이 "쓰러짐"처럼
  // 읽히게 한다. death2 이후 프레임은 그림 자체가 이미 누운 포즈라 회전을
  // 얹지 않는다.
  let fallRotation = 0;
  if (phase === 0) {
    const p = phaseProgress;
    const wobble = Math.sin(time / 45) * 0.09 * (1 - p);
    fallRotation = FALL_TILT_MAX * p * p + wobble;
  }

  // ②③구간(그림자가 몸에서 빠져나가 떠도는 동안) 전체를 은은하게 위아래로
  // 띄워서 정지 사진 여러 장을 이어붙인 느낌 대신 계속 움직이는 인상을 준다.
  const soulPhaseStart = DEATH_PHASE_BOUNDARIES[1];
  const soulPhaseEnd = DEATH_PHASE_BOUNDARIES[3];
  const soulEnvelope = t > soulPhaseStart && t < soulPhaseEnd ? Math.sin((Math.PI * (t - soulPhaseStart)) / (soulPhaseEnd - soulPhaseStart)) : 0;
  const soulBob = Math.sin(time / 480) * 3 * soulEnvelope;

  // 쓰러진 직후부터 서서히 화면을 어둡게 해 생명이 빠져나가는 분위기를 더한다.
  const vignette = Math.min(1, Math.max(0, (t - phase0End) / (1 - phase0End))) * 0.35;

  return {
    current: DEATH_FRAMES[phase],
    next: DEATH_FRAMES[nextPhase],
    blend,
    isImpactPhase: phase === 0,
    impactFlash,
    impactPulse,
    fallRotation,
    soulBob,
    vignette,
  };
}

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
 * - 그림자 각도가 안전 구역을 벗어나면 사망 시퀀스(4단계 애니메이션, 약 1.6초) 후
 *   이 라운드 스테이지 안의 마지막 세이브 포인트(없으면 스폰)로 리셋
 * - 1R→2R→3R은 각각 독립적으로 생성된 별도 스테이지다(`seedForRound`로 베이스
 *   시드에서 결정론적으로 파생) — 한 라운드의 골에 도달하면 다음 라운드용 새
 *   스테이지를 그 자리에서 생성해 전환한다(`loadStage`). 마지막 라운드(3R)에서
 *   골에 도달하면 스테이지 교체 없이 전체 클리어로 처리한다. 1R은 안전 구역
 *   가이드라인(부채꼴)을 보여주고, 2R부터는 가이드라인을 숨긴다(그림자 색상
 *   피드백은 유지). 3R 디메리트: 허용 각도 축소 + WASD 이동키 상하좌우
 *   반전(그림자 회전키는 영향 없음) — PRD §7-1.
 * - 캐릭터 몸 포즈·그림자 표정은 alignmentMargin(위험도) 기준으로 함께 전환된다 — PRD §7-2.
 *
 * 스테이지는 리액트 상태가 아니라 `stageRef`로 들고 있다 — 라운드 전환·재시작마다
 * 스테이지 객체 자체가 통째로 바뀌는데, 게임 루프(rAF)가 그 시점에 아직 안 바뀐
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
  const [initialRound] = useState<Round>(debugRoundFromQuery);
  const [initialStage] = useState<Stage>(() => generateStage(seedForRound(DEFAULT_SEED, initialRound)));
  const stageRef = useRef<Stage>(initialStage);
  const characterRef = useRef<Point>({ ...stageRef.current.spawn });
  const shadowAngleRef = useRef(naturalAngle(stageRef.current.lightSources, stageRef.current.spawn));
  const deathCountRef = useRef(0);
  const roundRef = useRef<Round>(initialRound);
  const clearedRef = useRef(false);
  // 이 라운드 스테이지 안에서 가장 멀리 도달한 진척도(스폰 기준 BFS 통로 거리,
  // `progressAt`) — 단조증가, 사망해도 줄지 않는다. 라운드 전환(스테이지
  // 자체가 새로 생성되는 것)과는 별개로, "이 스테이지의 세이브 포인트를
  // 지나쳤는지"만 이 값으로 판정한다(`respawnPointFor`) — 정확히 밟지 않고
  // 지나치기만 해도 인정된다. 사망 리스폰 지점은 이 값을 그대로 쓰지 않고
  // `respawnPointFor`로 마지막 체크포인트에 스냅한다 — 그대로 쓰면 "죽은
  // 자리에서 그대로 재개"가 되어 사망 페널티가 없어진다(실제로 겪은 버그,
  // `respawnPointFor` 주석 참고). 라운드가 전환되면(다음 스테이지로 교체)
  // `loadStage`가 0으로 리셋한다.
  const farthestProgressRef = useRef(0);
  // 직전 프레임의 최근접(활성) 광원 — 바뀌는 순간을 감지해 판정 유예를 주기 위함 (ADR-004).
  const activeLightRef = useRef<Point>(nearestLight(stageRef.current.lightSources, stageRef.current.spawn));
  // 광원 전환 유예 남은 시간(초) — 0보다 크면 이번 프레임 정렬 판정을 건너뛴다.
  const lightSwitchGraceRef = useRef(0);
  // stage 참조가 바뀔 때만(=재시작 시) 충돌판정 함수를 새로 만든다 — 매 프레임 재생성 방지.
  const colliderCacheRef = useRef<{ stage: Stage; canOccupy: (point: Point) => boolean } | null>(null);
  // 사망 시퀀스 진행 상태 — true인 동안 게임플레이가 멈추고 죽음 모션이 재생된다.
  const dyingRef = useRef(false);
  const deathAnimStartRef = useRef(0);
  // 마지막 수평 이동 방향 — 스프라이트가 원본은 오른쪽을 보고 있으므로 왼쪽 이동 시 좌우 반전한다.
  const facingRightRef = useRef(true);
  const [sprites, setSprites] = useState<CharacterSprites | null>(null);
  const [background, setBackground] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCharacterSprites()
      .then((loaded) => {
        if (!cancelled) setSprites(loaded);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadBackgroundArt()
      .then((loaded) => {
        if (!cancelled) setBackground(loaded);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, []);

  // 새 스테이지를 로드할 때 재설정해야 하는 상태를 한곳에 모은다 — 수동 재시작(1R부터)과
  // 라운드 전환(다음 라운드 스테이지로) 양쪽이 공유한다.
  function loadStage(nextStage: Stage) {
    stageRef.current = nextStage;
    characterRef.current = { ...nextStage.spawn };
    shadowAngleRef.current = naturalAngle(nextStage.lightSources, nextStage.spawn);
    farthestProgressRef.current = 0;
    activeLightRef.current = nearestLight(nextStage.lightSources, nextStage.spawn);
    lightSwitchGraceRef.current = 0;
    dyingRef.current = false;
    facingRightRef.current = true;
  }

  useImperativeHandle(
    ref,
    () => ({
      // ?round= 디버그 진입점과 무관하게 항상 1R부터 다시 시작한다 — "재시작"은
      // 게임을 처음부터 다시 플레이한다는 의미이지, 프리뷰 중이던 라운드로
      // 돌아오는 버튼이 아니다. ?round=2/3으로 들어와 프리뷰하다 재시작을 누르면
      // 1R로 넘어가는 게 의도된 동작이다. `seedForRound(DEFAULT_SEED, 1) ===
      // DEFAULT_SEED`가 항상 성립해 `generateStage(DEFAULT_SEED)`와 결과가
      // 같지만(초기화 로직 참고), 그 항등식이 나중에 바뀌면 여기가 조용히
      // 어긋날 수 있으므로 `seedForRound`를 명시적으로 거쳐 대칭을 유지한다.
      restart: () => {
        loadStage(generateStage(seedForRound(DEFAULT_SEED, 1)));
        roundRef.current = 1;
        onRoundChange?.(1, false);
        clearedRef.current = false;
      },
    }),
    [onRoundChange],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sprites) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;
    let lastTime = performance.now();

    const draw = (time: number) => {
      const deltaSeconds = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      let stage = stageRef.current; // let: 라운드 전환 시 이 프레임 안에서 재할당된다(아래 참고)

      // 죽음 시퀀스·대사창·클리어 중에는 실제 게임플레이가 멈춰있으므로, 이
      // 시점에 물리적으로 눌려있는 방향키가 그대로 반영돼 캐릭터 방향이 바뀌거나
      // (죽는 도중 반대키를 누르고 있으면 죽음 스프라이트가 반전됨) 정지 상태인데
      // 걷기 포즈가 재생되는(대사창 뜬 사이 이동키가 눌려있으면) 문제가 있었다 —
      // 아래 두 값은 실제 이동 처리가 일어나는 분기 안에서만 갱신한다.
      let isMoving = false;

      if (dyingRef.current) {
        if (time - deathAnimStartRef.current >= DEATH_ANIM_MS) {
          // 리스폰은 farthestProgressRef(현재 위치 기준 진척도)가 아니라 마지막으로
          // 넘은 체크포인트로 스냅한다 — 그대로 쓰면 사망 페널티가 없어진다(위 함수 설명 참고).
          const respawnPoint = respawnPointFor(
            farthestProgressRef.current,
            stage.spawn,
            stage.checkpoints,
            stage.checkpointProgress,
          );
          characterRef.current = { ...respawnPoint };
          shadowAngleRef.current = naturalAngle(stage.lightSources, respawnPoint);
          // 리스폰으로 위치가 세이브 포인트로 튀는 것 자체가 "광원이 바뀐 것"처럼
          // 감지되어 유예가 걸리는 걸 막기 위해, 활성 광원 기준점도 같이 갱신한다.
          activeLightRef.current = nearestLight(stage.lightSources, respawnPoint);
          // 죽기 직전 이동 방향이 남아있으면, 리스폰 직후 실제 이동 방향과 무관하게
          // 죽던 순간 보고 있던 방향을 그대로 유지해 버려서 캐릭터가 엉뚱한 쪽을
          // 보며 달리는 것처럼 보인다 — 리스폰 시 기본 방향(오른쪽)으로 되돌린다.
          facingRightRef.current = true;
          dyingRef.current = false;
        }
      } else if (!clearedRef.current && !inputDisabled) {
        if (colliderCacheRef.current?.stage !== stage) {
          colliderCacheRef.current = { stage, canOccupy: createGridCollider(stage.grid, CHARACTER_RADIUS) };
        }
        const canOccupy = colliderCacheRef.current.canOccupy;
        const moveInput = controlsReversed(roundRef.current)
          ? reverseMoveInput(inputRef.current)
          : inputRef.current;
        characterRef.current = moveCharacter(characterRef.current, moveInput, deltaSeconds, canOccupy);

        if (moveInput.right) facingRightRef.current = true;
        else if (moveInput.left) facingRightRef.current = false;
        isMoving = moveInput.up || moveInput.down || moveInput.left || moveInput.right;

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

        // 진척도(스폰 기준 BFS 통로 거리, `progressAt`)를 먼저 갱신한다 — 이
        // 스테이지(라운드) 안의 세이브 포인트 판정이 전부 이 값 기준이다.
        // 벽을 고려한 그래프 거리라, 캐릭터가 있는 셀 자체의 진행 거리만
        // 인정되고 벽 건너편의 공간적으로 가까운 지점으로는 튀지 않는다(이전
        // 유클리드 최근접 방식의 문제 — ADR-003 "버그 수정 기록" 참고).
        // farthestProgressRef는 단조증가라 사망 리스폰(위 dyingRef 분기)도
        // 되돌아가지 않는다.
        const previousFarthest = farthestProgressRef.current;
        const currentProgress = progressAt(stage.grid, stage.distanceField, characterRef.current);
        if (currentProgress > farthestProgressRef.current) {
          farthestProgressRef.current = currentProgress;
        }

        // 이 스테이지 안의 세이브 포인트를 이번 프레임에 새로 지나쳤는지 — 라운드
        // 전환과는 별개로, 광원 전환 경계선과 체크포인트 근방이 우연히 겹칠 때
        // (ADR-004) 정렬 판정을 스킵해 불공정한 사망을 막기 위한 용도다.
        const justPassedSavePoint = stage.checkpointProgress.some(
          (progress) => previousFarthest < progress && farthestProgressRef.current >= progress,
        );
        // 이 라운드 스테이지의 골(goalProgress)에 도달했는지 — 도달하면
        // 다음 라운드용 새 스테이지로 전환하거나(마지막 라운드면) 전체 클리어된다.
        const justCleared = !clearedRef.current && isStageCleared(farthestProgressRef.current, stage.goalProgress);

        // 세이브 포인트 통과/골 도달 판정을 정렬 판정보다 먼저 확인한다 — 그
        // 프레임에 정렬이 깨져도 "진행했다"는 사실은 항상 인정되어야 한다(스킵).
        // 그 외 구간에서는 기존과 동일하게 매 프레임 정렬을 검사한다.
        if (justPassedSavePoint || justCleared) {
          if (justCleared) {
            const { round: nextRound, cleared } = roundAfterClear(roundRef.current);
            if (cleared) {
              // 마지막 라운드(3R) 골 도달 = 전체 클리어 — 스테이지 교체 없이 그대로 둔다.
              clearedRef.current = true;
              onRoundChange?.(roundRef.current, true);
            } else {
              const nextStage = generateStage(seedForRound(DEFAULT_SEED, nextRound));
              loadStage(nextStage);
              stage = nextStage; // ★ 이번 프레임 렌더가 새 스테이지를 참조하도록 재할당(위 let 참고)
              roundRef.current = nextRound;
              onRoundChange?.(nextRound, false);
            }
          }
          // justPassedSavePoint만 true인 경우는 라운드 변화 없이 이번 프레임 정렬 판정만 스킵한다.
        } else {
          const tolerance = effectiveAngleTolerance(roundRef.current, SAFE_ANGLE_TOLERANCE);
          const natural = naturalAngle(stage.lightSources, characterRef.current);
          const margin = alignmentMargin(shadowAngleRef.current, natural, tolerance);

          if (margin > 1 && lightSwitchGraceRef.current <= 0) {
            dyingRef.current = true;
            deathAnimStartRef.current = time;
            deathCountRef.current += 1;
            onDeathCountChange?.(deathCountRef.current);
          }
        }

        if (lightSwitchGraceRef.current > 0) {
          lightSwitchGraceRef.current = Math.max(0, lightSwitchGraceRef.current - deltaSeconds);
        }
      }

      // 렌더용 위험도/포즈 — 사망 리셋 등으로 위치가 막 바뀌었을 수 있어 매 프레임 다시 계산한다.
      const tolerance = effectiveAngleTolerance(roundRef.current, SAFE_ANGLE_TOLERANCE);
      const natural = naturalAngle(stage.lightSources, characterRef.current);
      const margin = alignmentMargin(shadowAngleRef.current, natural, tolerance);
      const deathInfo = dyingRef.current
        ? deathFrameInfo(time - deathAnimStartRef.current, DEATH_ANIM_MS, time)
        : undefined;
      const bodyPose: BodyPose = deathInfo ? deathInfo.current : selectBodyPose(margin, isMoving);
      const shadowExpression = selectShadowExpression(margin);
      // farthestProgressRef는 단조증가이므로, 통과한 세이브 포인트는 이후 계속 true로 유지된다.
      const checkpointsPassed = stage.checkpointProgress.map((p) => farthestProgressRef.current >= p);

      renderFrame(ctx, stage, sprites, background, {
        characterPos: characterRef.current,
        shadowAngle: shadowAngleRef.current,
        bodyPose,
        shadowExpression,
        deathInfo,
        checkpointsPassed,
        round: roundRef.current,
        cleared: clearedRef.current,
        dying: dyingRef.current,
        aligned: margin <= 1,
        margin,
        tolerance,
        natural,
        time,
        facingRight: facingRightRef.current,
      });

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [inputRef, onDeathCountChange, onRoundChange, inputDisabled, sprites, background]);

  return (
    <>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      {/* 스프라이트 로딩 완료 전에는 게임 루프가 시작되지 않아 캔버스가 비어
          보인다 — 이미지 20여 장을 순차 로드하는 배포 환경(GitHub Pages)에서
          "멈춘 화면"으로 오인되지 않도록 안내 텍스트를 겹쳐 보여준다. */}
      {!sprites && <div style={loadingStyle}>불러오는 중...</div>}
    </>
  );
});

export default GameCanvas;

const loadingStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  color: "#eee",
  fontFamily: "sans-serif",
  fontSize: 16,
  pointerEvents: "none",
};

interface RenderState {
  characterPos: Point;
  shadowAngle: number;
  bodyPose: BodyPose;
  /** 위험도에 따라 바뀌는 그림자(바닥 실루엣)의 표정 — selectShadowExpression 참고. */
  shadowExpression: ShadowExpression;
  /** 사망 시퀀스 중일 때만 존재 — 프레임 간 크로스페이드·흔들림 연출에 쓴다. */
  deathInfo?: DeathFrameInfo;
  /** `stage.checkpoints`와 순서·길이가 같은 통과 여부 — 통과한 세이브 포인트를 다른 색으로 표시한다. */
  checkpointsPassed: boolean[];
  round: Round;
  cleared: boolean;
  dying: boolean;
  aligned: boolean;
  /** 위험도(alignmentMargin) — 이동 컷아웃의 떨림 강도 계산에 쓴다. */
  margin: number;
  tolerance: number;
  natural: number;
  /** requestAnimationFrame의 timestamp(ms) — 절차적 모션(숨쉬기·걷기 흔들림)의 위상 계산용. */
  time: number;
  /** 마지막 수평 이동 방향(오른쪽=true) — 스프라이트 좌우 반전에 쓴다. */
  facingRight: boolean;
}

/**
 * 정지 이미지 한 장씩만 있어 포즈 전환만으로는 "움직이는 느낌"이 나지 않는 문제를
 * 절차적 모션(바운스·떨림)으로 보완한다 — 새 아트 없이 코드만으로. walk(이동)는
 * 이 함수를 안 거치고 drawWalkSprite로 별도 처리한다(2프레임 걷기 사이클).
 */
function bodyBobOffset(pose: Exclude<BodyPose, "walk">, time: number): { x: number; y: number } {
  switch (pose) {
    case "idle":
      return { x: 0, y: Math.sin(time / 450) * 2 }; // 숨쉬기처럼 느린 상하 흔들림
    case "flinch":
      return { x: Math.sin(time / 60) * 2, y: 0 }; // 미세한 좌우 떨림
    case "danger":
      return { x: Math.sin(time / 35) * 4, y: 0 }; // 더 크고 빠른 떨림
    default:
      return { x: 0, y: 0 }; // 죽음 모션 4단계는 정지 프레임 그대로
  }
}

function drawBodySprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  feetX: number,
  feetY: number,
  pose: Exclude<BodyPose, "walk">,
  time: number,
  facingRight: boolean,
) {
  const scale = BODY_DISPLAY_HEIGHT / img.naturalHeight;
  const w = img.naturalWidth * scale;
  const h = BODY_DISPLAY_HEIGHT;
  const bob = bodyBobOffset(pose, time);

  ctx.save();
  ctx.translate(feetX + bob.x, feetY - bob.y);
  // 스프라이트 원본이 오른쪽을 보고 있다고 가정 — 왼쪽으로 이동 중이면 좌우 반전.
  ctx.scale(facingRight ? 1 : -1, 1);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}

const WALK_FRAME_MS = 160; // 두 프레임을 번갈아 보여주는 간격 — 너무 빠르면 떨림처럼, 너무 느리면 뚝뚝 끊겨 보인다.

const WALK_LEAN_RADIANS = 0.18; // 달리는 동안 몸 전체가 발(축)을 기준으로 진행 방향으로 기울어지는 각도(~10도)

/**
 * 이동(walk) 렌더링 — 시행착오 기록은 characterSprites.ts 상단 주석 참고.
 * 최종적으로는 상체(코트+머리, body-run-torso.png)를 고정으로 그리고, 다리
 * 컷아웃(body-run-legs.png)만 프레임마다 좌우 반전해서 겹친다. 다리는 좌/우가
 * 대략 대칭이라 반전해도 "반대쪽 다리가 앞으로 나온" 자연스러운 스텝으로
 * 읽히지만, 상체는 절대 반전되지 않으므로 걷는 내내 얼굴·몸통 방향이 흔들리지
 * 않는다 — 진짜 좌우 교대 스텝 + 고정된 얼굴 방향을 동시에 만족한다.
 * (facingRight로 인한 전체 반전은 여전히 이동 방향에 따라 매 프레임 적용된다.)
 * 또한 몸 전체를 발을 축으로 진행 방향으로 살짝 기울여(WALK_LEAN_RADIANS)
 * "제자리에서 위치만 바뀌는" 게 아니라 실제로 달리며 앞으로 쏠리는 느낌을 준다.
 * margin(위험도)이 높을수록 좌우 떨림을 더해 이동 중에도 위험을 표현한다.
 */
function drawWalkSprite(
  ctx: CanvasRenderingContext2D,
  torso: HTMLImageElement,
  legs: HTMLImageElement,
  legsMirrored: HTMLImageElement,
  feetX: number,
  feetY: number,
  time: number,
  facingRight: boolean,
  margin: number,
) {
  const isLeftStep = Math.floor(time / WALK_FRAME_MS) % 2 === 0;
  const legsImg = isLeftStep ? legs : legsMirrored;
  const bounce = Math.abs(Math.sin(time / 90)) * 6;
  // 0(안전)~1(경계)은 떨림 없음, 그 이상(이탈 근접)부터 서서히 떨림이 붙는다.
  const danger = clamp((margin - 0.6) / 0.4, 0, 1);
  const jitterX = danger * Math.sin(time / 35) * 3;

  // 상체·다리가 같은 원본 시트에서 나온 크롭이라, 공통 기준 높이(200px =
  // 분리 전 body-run.png 높이)로 스케일을 통일해야 서로 어긋나지 않는다.
  const scale = BODY_DISPLAY_HEIGHT / WALK_REFERENCE_HEIGHT_PX;
  const h = BODY_DISPLAY_HEIGHT;
  const pivotX = -WALK_TORSO_PIVOT_OFFSET_PX * scale;
  const torsoW = torso.naturalWidth * scale;
  const torsoH = torso.naturalHeight * scale;
  const legsW = legsImg.naturalWidth * scale;
  const legsH = legsImg.naturalHeight * scale;
  const legsX = pivotX + WALK_LEGS_OFFSET_X_PX * scale;
  const legsY = -h + WALK_LEGS_OFFSET_Y_PX * scale;

  ctx.save();
  ctx.translate(feetX + jitterX, feetY - bounce);
  // 스프라이트 원본이 오른쪽을 보고 있다고 가정 — 왼쪽으로 이동 중이면 좌우
  // 반전. 반전 다음에 회전을 걸어서, 회전이 항상 "반전 이후의 진행 방향"으로
  // 기울어지게 한다(왼쪽으로 갈 땐 왼쪽으로, 오른쪽으로 갈 땐 오른쪽으로).
  ctx.scale(facingRight ? 1 : -1, 1);
  ctx.rotate(WALK_LEAN_RADIANS);
  // 다리를 먼저 그리고 상체를 위에 덮어, 상체·다리 크롭이 겹치는 hip 부근
  // 이음매(코트 밑단)는 항상 반전되지 않는 상체 쪽 그림이 덮어 가려준다.
  ctx.drawImage(legsImg, legsX, legsY, legsW, legsH);
  ctx.drawImage(torso, pivotX, -h, torsoW, torsoH);
  ctx.restore();
}

// 뭉게뭉게 겹친 원 여러 개로 만화적인 "먼지 구름" 윤곽 하나를 이룬다 — 상대
// 위치(cx,cy)와 반지름 배율(rScale)을 고정 배치해, 매 발걸음마다 같은
// 구름 모양이 커졌다 사그라드는 식으로 반복된다(공 하나짜리 그러데이션과
// 달리 울퉁불퉁한 뭉게구름 실루엣으로 읽힌다).
const DUST_CLOUD_LOBES: readonly [number, number, number][] = [
  [0, 0, 1],
  [-3, -1.5, 0.7],
  [3, -1, 0.75],
  [0.5, -3, 0.6],
  [-1.5, 1.5, 0.55],
];

/**
 * 발을 내딛을 때 발치에서 뭉게뭉게 부풀어 오르는 먼지 구름 — 그러데이션
 * 공 하나(빛나는 구슬 같다는 피드백), 스피드 라인(촌스럽다는 피드백), 흩날리는
 * 작은 알갱이(효과 같지 않다는 피드백)를 모두 거쳐, 만화에서 흔히 쓰는
 * "겹친 원 뭉치 = 뭉게구름" 실루엣으로 다시 만들었다. 다리 회전 변환 밖
 * (독립 좌표계)에서 그려 다리처럼 통째로 흔들리지 않지만, 발이 실제로 딛는
 * 지점에서 부풀어 오르므로 "발에서 생기는" 이펙트로 보인다.
 */
function drawRunDustEffect(ctx: CanvasRenderingContext2D, feetX: number, feetY: number, time: number, facingRight: boolean) {
  const stepPeriod = 90 * Math.PI; // 다리 스윙 반주기(발 교대 간격)와 동일하게 맞춘 값
  const stepAge = (time % stepPeriod) / stepPeriod; // 0(막 디딤)~1(다음 걸음 직전)
  const dir = facingRight ? -1 : 1; // 이동 방향의 반대(뒤)쪽

  const alpha = Math.max(0, 1 - stepAge * 1.3) * 0.42;
  if (alpha <= 0.02) return;

  const baseRadius = 3 + stepAge * 5; // 갓 튀었을 땐 작다가 부풀어 오름
  const cx = dir * (5 + stepAge * 7);
  const cy = -2 - stepAge * 2;

  ctx.save();
  ctx.translate(feetX + cx, feetY + cy);
  ctx.filter = "blur(0.6px)";
  ctx.fillStyle = `rgba(200, 196, 188, ${alpha})`;
  for (const [lobeX, lobeY, lobeScale] of DUST_CLOUD_LOBES) {
    ctx.beginPath();
    ctx.arc(dir * lobeX, lobeY, baseRadius * lobeScale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 그림자 — 위험도(alignmentMargin)에 따라 바뀌는 "그림자 표정" 블롭
 * (face-*.png, selectShadowExpression 참고)을 "해질녘 긴 그림자"처럼
 * 전단(shear) 변환으로 늘여서 그린다. 원래는 캐릭터 몸 전체 실루엣(body.idle)을
 * 늘이는 방식이었지만, 시트에 원래 있던 "그림자 표정" 에셋이 로딩만 되고
 * 어디에도 쓰이지 않는 문제가 있어(PR #9 리뷰), 그림자 실루엣 자체를 이
 * 표정 블롭으로 교체했다 — 위험도가 오를수록 그림자 스스로 겁먹은 표정을
 * 지어 보이는 연출이 된다. 회전(90도로 눕히는) 대신 전단만 쓰는 이유는
 * 여전히 유효하다: 정면 그림을 그대로 눕히면 "그림자 같지 않다"는 피드백이
 * 반복됐었다 — 실제 해질녘 그림자는 눕는 게 아니라 서 있는 실루엣 그대로
 * 광원 반대 방향으로 길게 뻗기만 한다. 그래서 좌우 폭 축은 화면에서 항상
 * 수평으로 두고(회전하지 않음), 아래(원점)부터 위까지의 높이 축만
 * shadowAngle 방향으로 투영해 늘인다.
 *
 * 캔버스 변환으로는 ctx.transform(1, 0, -stretch·cosθ, -stretch·sinθ, 0, 0):
 * 로컬 y(발=0, 머리=-h)에 -stretch·(cosθ, sinθ)를 곱해 머리가 캐릭터 위치에서
 * shadowAngle 방향으로 SHADOW_LENGTH만큼 떨어진 지점에 오도록 하고, 로컬
 * x(폭)는 그대로 둬 폭 축이 화면 수평을 유지한다(shadowTip 공식과 동일한
 * cos/sin 규약).
 *
 * x축(폭)을 항상 (1, 0)으로 고정하는 위 설계상, shadowAngle이 정확히 수평
 * (0°/180°, sinθ≈0)이면 y축(높이) 기저벡터 (-stretch·cosθ, -stretch·sinθ)도
 * 수평이 되어 두 축이 겹친다 — 즉 2D 이미지가 폭 0인 직선으로 찌그러져
 * 화면에서 완전히 사라진다(브라우저 실측 검증 중 발견, 캔버스 픽셀 캡처로
 * 재현). sinθ에 최소 크기(MIN_VERTICAL_RATIO)를 강제해 이 퇴화를 막는다 —
 * 실제 각도가 아주 살짝 어긋나 보이는 대가로, 그림자가 항상 화면에 보이게
 * 한다.
 */
const MIN_VERTICAL_RATIO = 0.12;

/**
 * shadowAngle의 sin 성분에 최소 크기를 강제한다 — drawShadowSprite 주석 참고.
 * sinθ가 0에 가까우면(수평 방향) 전단 변환의 y축 기저벡터가 x축과 겹쳐
 * 그림자가 화면에서 완전히 사라지는 것을 막는다.
 */
export function shadowVerticalComponent(shadowAngle: number): number {
  const sinTheta = Math.sin(shadowAngle);
  const verticalSign = sinTheta < 0 ? -1 : 1;
  return Math.abs(sinTheta) < MIN_VERTICAL_RATIO ? verticalSign * MIN_VERTICAL_RATIO : sinTheta;
}

function drawShadowSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  originX: number,
  originY: number,
  shadowAngle: number,
  aligned: boolean,
  time: number,
) {
  const pulse = 1 + Math.sin(time / 300) * 0.04;
  const scale = BODY_DISPLAY_HEIGHT / img.naturalHeight;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const stretch = (SHADOW_LENGTH / h) * pulse;
  // 전단 변환만 거치면 실루엣이 딱딱한 판때기(사다리꼴) 윤곽으로 보인다는
  // 피드백 — 가장자리를 블러로 부드럽게 풀어 윤곽선을 흐릿하게 만들고,
  // 완전한 검정에 가깝게 어둡혀 그림자다운 무게감을 준다.
  const tint = aligned ? "brightness(0)" : "brightness(0.4) sepia(1) hue-rotate(-50deg) saturate(5)";
  const effectiveSin = shadowVerticalComponent(shadowAngle);

  ctx.save();
  ctx.translate(originX, originY);
  ctx.transform(1, 0, -stretch * Math.cos(shadowAngle), -stretch * effectiveSin, 0, 0);
  ctx.filter = `${tint} blur(2px)`;
  ctx.globalAlpha = 0.88;
  // drawBodySprite와 동일한 앵커(발=원점, 머리=-h 방향)를 그대로 재사용한다.
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  sprites: CharacterSprites,
  background: HTMLImageElement | null,
  state: RenderState,
) {
  const {
    characterPos,
    shadowAngle,
    bodyPose,
    shadowExpression,
    deathInfo,
    checkpointsPassed,
    round,
    cleared,
    dying,
    aligned,
    margin,
    tolerance,
    natural,
    time,
    facingRight,
  } = state;

  // 매 프레임 시작 시 변환 행렬을 단위 행렬로 강제 초기화 — save/restore가
  // 코드상 균형이 맞더라도(각 draw 함수 내부에서 항상 짝을 맞춤), 이 값에
  // 의존하지 않고 방어적으로 리셋해 프레임 간 변환이 누적되는 것을 막는다.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 카메라 — 캐릭터를 화면 중앙에 두고 확대해서, 맵 전체를 축소해 보여주는 대신
  // 캐릭터 주변을 크게 보여준다(시트의 "인게임 느낌" 목업 참고). 맵 가장자리를
  // 벗어나 빈 공간이 보이지 않도록 카메라 위치를 맵 범위 안으로 클램프한다.
  const viewW = CANVAS_WIDTH / CAMERA_ZOOM;
  const viewH = CANVAS_HEIGHT / CAMERA_ZOOM;
  const camX = clamp(characterPos.x - viewW / 2, 0, CANVAS_WIDTH - viewW);
  const camY = clamp(characterPos.y - viewH / 2, 0, CANVAS_HEIGHT - viewH);

  ctx.save();
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-camX, -camY);

  drawStage(ctx, stage, background, checkpointsPassed, round);

  // 안전 구역 가이드라인 — 1R에서만 표시 (2R부터 제거, PRD §7-1). 이 연분홍
  // (#dcafbe)은 background-art-prompt-guide.md 컬러 팔레트가 "안전구역 경계선
  // UI 전용"으로 예약해 둔 포인트색이다. 벽 오버레이는 이 PR에서 석재 턱
  // 재질(따뜻한 무채색, drawStage.ts의 buildWallLayer 참고)로 바뀌었으므로 더
  // 이상 같은 색 계열이 아니다 — "위험 경계"라는 의미는 형태(부채꼴 vs 턱)로만
  // 구분한다.
  if (isGuideVisible(round)) {
    ctx.beginPath();
    ctx.moveTo(characterPos.x, characterPos.y);
    ctx.arc(characterPos.x, characterPos.y, SAFE_ZONE_RADIUS, natural - tolerance, natural + tolerance);
    ctx.closePath();
    ctx.fillStyle = "rgba(220, 175, 190, 0.25)";
    ctx.fill();
    ctx.strokeStyle = "#dcafbe";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 광원(가로등) — 배경 이미지가 더 이상 가로등 기둥/구조를 그리지 않으므로
  // (background-art-prompt-guide.md 2026-08-03 수정: "The lamps themselves should
  // NOT be drawn as visible fixtures/posts... since the game engine renders actual
  // lamp sprites separately"), 실제 가로등 형태를 그리는 책임이 전적으로 이 코드로
  // 넘어왔다. 바닥 빛 웅덩이(방사형 그라디언트)만으로는 "여기 물리적으로 가로등이
  // 서 있다"가 전달되지 않아, 캐릭터 스프라이트와 같은 정면 실루엣 관습으로 얇은
  // 기둥 + 램프 머리를 웅덩이 중심 위에 세워 그린다. 여러 광원 중 지금 판정에
  // 쓰이는(최근접) 광원만 밝게 강조해, 안전 구역이 왜 이동했는지 플레이어가
  // 알아볼 수 있게 한다 (ADR-004).
  const activeLight = nearestLight(stage.lightSources, characterPos);
  for (const light of stage.lightSources) {
    const isActive = light === activeLight;
    const poolRadius = isActive ? 46 : 26;
    const pool = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, poolRadius);
    if (isActive) {
      pool.addColorStop(0, "rgba(245, 213, 71, 0.85)");
      pool.addColorStop(0.4, "rgba(245, 213, 71, 0.35)");
      pool.addColorStop(1, "rgba(245, 213, 71, 0)");
    } else {
      pool.addColorStop(0, "rgba(138, 122, 58, 0.5)");
      pool.addColorStop(1, "rgba(138, 122, 58, 0)");
    }
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(light.x, light.y, poolRadius, 0, Math.PI * 2);
    ctx.fill();

    // 가로등 실루엣 — 발판(기둥이 땅에 박힌 지점) + 위로 갈수록 가늘어지는 기둥 +
    // 브래킷 + 캡 + 육각 랜턴(속 코어+헤일로) 구조로, 캐릭터 스프라이트와 같은
    // 정면 실루엣 관습을 따른다. 기둥과 랜턴을 잇는 은은한 세로 광선으로 "이 빛
    // 웅덩이가 바로 이 기둥에서 뿜어져 나온다"는 인과관계를 시각적으로 이어준다.
    const poleHeight = isActive ? 22 : 15;
    const poleColor = isActive ? "#2e2e2e" : "#1c1c1c";
    const headY = light.y - poleHeight;
    const r = isActive ? 7 : 5;
    const lanternColor = isActive ? "#f5d547" : "#8a7a3a";

    if (isActive) {
      const beam = ctx.createLinearGradient(light.x, headY, light.x, light.y);
      beam.addColorStop(0, "rgba(245, 213, 71, 0.28)");
      beam.addColorStop(1, "rgba(245, 213, 71, 0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(light.x - 5, headY);
      ctx.lineTo(light.x + 5, headY);
      ctx.lineTo(light.x + 1.5, light.y);
      ctx.lineTo(light.x - 1.5, light.y);
      ctx.closePath();
      ctx.fill();
    }

    // 발판 — 기둥이 땅에 서 있는 지점을 눌러주는 얕은 타원 그림자
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(light.x, light.y, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 기둥 — 아래가 넓고 위가 좁은 사다리꼴로 그려 원기둥의 부피감을 흉내낸다.
    ctx.fillStyle = poleColor;
    ctx.beginPath();
    ctx.moveTo(light.x - 2, light.y);
    ctx.lineTo(light.x + 2, light.y);
    ctx.lineTo(light.x + 1, headY + 3);
    ctx.lineTo(light.x - 1, headY + 3);
    ctx.closePath();
    ctx.fill();

    // 브래킷 — 랜턴이 기둥에 걸리는 지점의 작은 가로대
    ctx.fillRect(light.x - r * 0.6, headY + 1, r * 1.2, 2);

    // 캡 — 랜턴 위를 덮는 작은 삼각 지붕
    ctx.fillStyle = poleColor;
    ctx.beginPath();
    ctx.moveTo(light.x, headY - r - 4);
    ctx.lineTo(light.x - r, headY - r * 0.3);
    ctx.lineTo(light.x + r, headY - r * 0.3);
    ctx.closePath();
    ctx.fill();

    // 랜턴 몸통 — 육각형, 불빛이 채워진 안쪽 + 어두운 뼈대 테두리
    if (isActive) {
      ctx.shadowColor = "#f5d547";
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = lanternColor;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const px = light.x + Math.cos(angle) * r;
      const py = headY + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = poleColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 필라멘트 코어 — 랜턴 한가운데 더 밝은 점을 얹어 실제로 빛을 뿜는
    // 광원처럼 보이게 한다(육각형 채우기만으로는 평면 스티커처럼 보임).
    ctx.fillStyle = isActive ? "#fff3c4" : "#c9b96a";
    ctx.beginPath();
    ctx.arc(light.x, headY, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // 그림자 — 죽음 시퀀스 중에는 그리지 않는다(몸만 죽음 모션으로 표시)
  if (!dying) {
    drawShadowSprite(ctx, sprites.shadow[shadowExpression], characterPos.x, characterPos.y, shadowAngle, aligned, time);
  }

  // 캐릭터 — 사망 시퀀스 중에는 현재/다음 죽음 프레임을 크로스페이드한다.
  // 임팩트 구간(①)에서는 짧게 떨고, ①→②로 넘어가며 쓰러지는 순간(impactPulse)엔
  // 더 크게 흔들려 "쿵" 하는 충격을 준다. death1(서있는 그림)에만 fallRotation을
  // 얹어 death2(이미 누운 그림)로의 전환이 쓰러지는 동작처럼 보이게 하고,
  // ②③구간에는 soulBob으로 은은하게 떠다니는 움직임을 더한다.
  if (deathInfo) {
    const jolt = deathInfo.impactPulse * 8;
    const shakeAmount = (deathInfo.isImpactPhase ? deathInfo.impactFlash * 6 : 0) + jolt;
    const shakeX = Math.sin(time / 20) * shakeAmount;
    const shakeY = Math.cos(time / 27) * shakeAmount * 0.6 + deathInfo.soulBob;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (deathInfo.fallRotation !== 0) {
      ctx.save();
      ctx.translate(characterPos.x, characterPos.y);
      ctx.rotate(deathInfo.fallRotation);
      ctx.translate(-characterPos.x, -characterPos.y);
    }
    drawBodySprite(ctx, sprites.body[deathInfo.current], characterPos.x, characterPos.y, deathInfo.current, time, facingRight);
    if (deathInfo.fallRotation !== 0) ctx.restore();

    if (deathInfo.blend > 0) {
      ctx.globalAlpha = deathInfo.blend;
      drawBodySprite(ctx, sprites.body[deathInfo.next], characterPos.x, characterPos.y, deathInfo.next, time, facingRight);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  } else if (bodyPose === "walk") {
    drawRunDustEffect(ctx, characterPos.x, characterPos.y, time, facingRight);
    drawWalkSprite(
      ctx,
      sprites.walkTorso,
      sprites.walkLegs,
      sprites.walkLegsMirrored,
      characterPos.x,
      characterPos.y,
      time,
      facingRight,
      margin,
    );
  } else {
    drawBodySprite(ctx, sprites.body[bodyPose], characterPos.x, characterPos.y, bodyPose, time, facingRight);
  }

  ctx.restore();

  // 비네트 — 쓰러진 뒤부터 서서히 화면을 어둡게 해 생명이 빠져나가는 분위기를 준다.
  if (deathInfo && deathInfo.vignette > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${deathInfo.vignette})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // 임팩트 플래시 — 카메라 변환과 무관한 화면 전체 오버레이(경계 이탈 순간 붉게 번쩍).
  if (deathInfo && deathInfo.impactFlash > 0) {
    ctx.fillStyle = `rgba(180, 20, 20, ${deathInfo.impactFlash * 0.5})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

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
