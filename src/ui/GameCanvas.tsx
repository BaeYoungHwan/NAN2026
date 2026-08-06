import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import type { AudioEngine } from "../audio/audioEngine";
import type { Point, Stage } from "../core/stage";
import { useKeyboardInput } from "../core/input";
import { debugRoundFromQuery } from "../core/debugRound";
import {
  controlsReversed,
  effectiveAngleTolerance,
  hasTouchedCheckpoint,
  isGuideVisible,
  respawnPointFor,
  roundAfterClear,
  type Round,
} from "../core/round";
import { CHARACTER_RADIUS, moveCharacter, reverseMoveInput } from "../physics/character";
import { createGridCollider } from "../physics/collider";
import { naturalAngle, nearestLight } from "../shadow/shadowCaster";
import { alignmentMargin } from "../shadow/containmentJudge";
import { getTuning } from "../core/tuning";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_SEED,
  generateStage,
  seedForRound,
} from "../procgen/stageGenerator";
import { drawStage, hexToRgbString } from "./drawStage";
import { loadBackgroundArt } from "./backgroundArt";
import { loadTileArt, type TileArt } from "./tileArt";
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

/**
 * 1R 안전 구역 가이드(부채꼴)의 반지름 — 그림자 길이보다 조금 크게 그려 그림자
 * 끝이 부채꼴 안에 들어오게 한다. 그림자 길이가 튜닝 대상이라 상수가 아니라
 * 함수다(모듈 로드 시점에 계산해 두면 튜닝 패널로 길이를 바꿔도 부채꼴만 옛 크기로 남는다).
 */
function safeZoneRadius(): number {
  return getTuning().shadowLength + 20;
}
// 광원(가로등) 불빛 색 — hex 하나로만 두고 rgb 문자열(그라디언트용)은
// hexToRgbString으로 파생시킨다. 예전엔 이 색을 hex/rgb 리터럴로 여러 곳에
// (빛 웅덩이, 광선, 랜턴 몸통, 그림자, 웅덩이 반사) 따로 박아넣어 하나만
// 바꾸면 나머지가 조용히 어긋나는 구조였다(PR #17 리뷰).
const LANTERN_COLOR_ACTIVE = "#f5d547";
const LANTERN_COLOR_INACTIVE = "#8a7a3a";
const DEATH_ANIM_MS = 1600; // 사망 시 4단계 애니메이션을 보여주는 동안 멈추는 시간
/**
 * 라운드 전환 시 검은 화면에서 밝아지는 시간(ms).
 *
 * 라운드가 올라가면 완전히 다른 지형의 스테이지가 같은 프레임에 갈아끼워져
 * (`loadStage`) 화면이 툭 튄다. 스테이지 교체 자체를 지연시키면 골 접촉·정렬
 * 판정 순서까지 건드려야 하므로, 교체는 지금처럼 즉시 하고 **교체 직후 한 번
 * 검게 덮었다가 걷어내는** 방식으로 이음매를 가린다. 이 동안에는 App이
 * 라운드 승급 대사를 띄우고 있어(`inputDisabled`) 조작도 어차피 멈춰 있다.
 */
const ROUND_FADE_MS = 550;
const BODY_DISPLAY_HEIGHT = 42; // 충돌 판정(CHARACTER_RADIUS)과 무관한 순수 표시 크기
const CAMERA_ZOOM = 2.2; // 캐릭터를 따라다니며 확대하는 배율 — 맵 전체 대신 주변만 크게 보여준다

/**
 * 캔버스 백킹 스토어 배율 상한. 3x 디스플레이에서 800×600을 그대로 곱하면
 * 2400×1800이 되는데, 매 프레임 `ctx.filter = blur()`/`shadowBlur`를 여러 번 쓰는
 * 렌더 경로(그림자 실루엣·먼지·촛불)에서는 그 픽셀 수가 곧바로 프레임 타임이 된다.
 * 2배면 육안상 충분히 선명하다.
 */
const MAX_RENDER_SCALE = 2;
/** 백킹 스토어 배율 하한 — 캔버스가 잠시 0px로 잡히는 경우에 대한 방어값이다. */
const MIN_RENDER_SCALE = 0.25;

/**
 * 실제로 그릴 백킹 스토어 배율 — 캔버스가 화면에서 차지하는 CSS 폭과 논리 폭
 * (`CANVAS_WIDTH`)의 비에 기기 픽셀비를 곱한 값. 1이면 예전과 완전히 동일하다.
 *
 * **크기는 CSS가 정한다**(`src/index.css`의 `.stage`). 이 함수는 그렇게 정해진
 * 결과를 받아 백킹 스토어 해상도만 환산한다 — 예전처럼 뷰포트를 재서 페이지
 * 헤더·푸터 높이를 상수로 빼는 계산은 더 이상 없다.
 *
 * 논리 좌표계(800×600)는 그대로라 게임 로직·카메라 클램프·오프스크린 캐시에는
 * 아무 영향이 없고, `renderFrame`이 이 값을 기준 변환으로 한 번 깔아둔다.
 * 상한을 두는 이유는 `MAX_RENDER_SCALE` 주석 참고.
 */
export function canvasRenderScale(stageCssWidth: number, devicePixelRatio: number): number {
  const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return clamp((stageCssWidth / CANVAS_WIDTH) * ratio, MIN_RENDER_SCALE, MAX_RENDER_SCALE);
}

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

interface Rgb {
  r: number;
  g: number;
  b: number;
}

// 안전 구역 가이드 부채꼴(1R 전용)의 3단계 색 — background-art-prompt-guide.md가
// "안전구역 경계선 UI 전용"으로 예약한 #dcafbe를 안전 단계 기준색으로 그대로 쓰고,
// 경고·위험 단계는 selectBodyPose/selectShadowExpression과 같은 위험도 신호에서
// 파생시킨다(새 판정 없음).
const SAFE_ZONE_COLOR_SAFE: Rgb = { r: 220, g: 175, b: 190 }; // #dcafbe
const SAFE_ZONE_COLOR_WARN: Rgb = { r: 224, g: 168, b: 61 }; // #e0a83d
const SAFE_ZONE_COLOR_DANGER: Rgb = { r: 214, g: 86, b: 79 }; // #d6564f

function lerpRgb(from: Rgb, to: Rgb, t: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

/**
 * 안전 구역 가이드 부채꼴의 채우기/테두리 색 — 위험도(alignmentMargin)에 따라
 * 안전(#dcafbe) → 경고(#e0a83d) → 위험(#d6564f)로 서서히 물든다. selectBodyPose/
 * selectShadowExpression과 동일한 0.6/0.85 임계값에서 색 전이가 시작되므로 몸
 * 포즈가 idle→flinch로 바뀌는 순간 부채꼴도 함께 물들기 시작한다 — 다만 몸
 * 포즈(계단 함수)와 달리 부채꼴 색은 각 구간을 선형 보간해서 완전한 위험색에는
 * margin=1(이탈 직전)에야 도달한다. 하드 컷 대신 보간을 쓴 이유: 임계값에서
 * 색이 뚝 끊기면 그 자체가 판정처럼 오독될 수 있다.
 *
 * margin이 1을 넘는 경우(이탈 직후)는 부채꼴 자체가 곧 사망 연출로 가려지지만,
 * 방어적으로 1로 clamp해 색이 계속 위험색에 머물게 한다.
 */
export function safeZoneWedgeColor(margin: number): { fill: string; stroke: string } {
  const clamped = Math.min(1, Math.max(0, margin));
  const rgb =
    clamped < 0.6
      ? SAFE_ZONE_COLOR_SAFE
      : clamped < 0.85
        ? lerpRgb(SAFE_ZONE_COLOR_SAFE, SAFE_ZONE_COLOR_WARN, (clamped - 0.6) / 0.25)
        : lerpRgb(SAFE_ZONE_COLOR_WARN, SAFE_ZONE_COLOR_DANGER, (clamped - 0.85) / 0.15);
  const r = Math.round(rgb.r);
  const g = Math.round(rgb.g);
  const b = Math.round(rgb.b);
  return {
    fill: `rgba(${r}, ${g}, ${b}, 0.25)`,
    stroke: `rgb(${r}, ${g}, ${b})`,
  };
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

/**
 * 라운드 전환 페이드의 현재 불투명도(0~1)를 구한다 — 1(완전히 검음)에서 시작해
 * `ROUND_FADE_MS` 동안 선형으로 0까지 걷힌다.
 *
 * `startedAt`이 null이면(페이드 중이 아님) 0. 전환 직후 첫 프레임은 `now`와
 * `startedAt`이 같아 정확히 1이 되고, 시간이 지나면 0에서 멈춘다(음수로 내려가지
 * 않는다). rAF timestamp가 뒤로 가는 경우는 없지만, 방어적으로 clamp한다.
 */
export function roundFadeAlpha(startedAt: number | null, now: number): number {
  if (startedAt === null) return 0;
  const progress = (now - startedAt) / ROUND_FADE_MS;
  return clamp(1 - progress, 0, 1);
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
  /**
   * 효과음 재생용 오디오 엔진 참조 (`audio/useAudio.ts`). 엔진은 비동기로 준비되고
   * 에셋이 없으면 아예 만들어지지 않으므로 항상 null일 수 있다 — 게임 진행은 이
   * 값과 무관하게 동작해야 한다.
   *
   * 엔진 자체가 아니라 ref를 받는 이유: 뮤트 토글 등으로 오디오 상태가 바뀔 때마다
   * 게임 루프(rAF)가 재시작되면 안 되는데, ref는 참조가 불변이라 아래 useEffect의
   * 의존성에 들어가도 루프를 다시 만들지 않는다.
   */
  audioEngineRef?: MutableRefObject<AudioEngine | null>;
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
  { onDeathCountChange, onRoundChange, inputDisabled = false, audioEngineRef },
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
  // 이 스테이지의 세이브 포인트를 직접 밟아 활성화했는지 — `stage.checkpoints`와
  // 순서·길이가 같다. 한 번 true가 되면 그 스테이지가 끝날 때까지 유지되고(래치),
  // 사망 리스폰 지점(`respawnPointFor`)과 화면 표시가 모두 이 값만 본다.
  const checkpointsReachedRef = useRef<boolean[]>(stageRef.current.checkpoints.map(() => false));
  // 직전 프레임의 최근접(활성) 광원 — 바뀌는 순간을 감지해 판정 유예를 주기 위함 (ADR-004).
  const activeLightRef = useRef<Point>(nearestLight(stageRef.current.lightSources, stageRef.current.spawn));
  // 광원 전환 유예 남은 시간(초) — 0보다 크면 이번 프레임 정렬 판정을 건너뛴다.
  const lightSwitchGraceRef = useRef(0);
  // stage 참조가 바뀔 때만(=재시작 시) 충돌판정 함수를 새로 만든다 — 매 프레임 재생성 방지.
  const colliderCacheRef = useRef<{ stage: Stage; canOccupy: (point: Point) => boolean } | null>(null);
  // 사망 시퀀스 진행 상태 — true인 동안 게임플레이가 멈추고 죽음 모션이 재생된다.
  const dyingRef = useRef(false);
  const deathAnimStartRef = useRef(0);
  // 라운드 전환 페이드가 시작된 시각(rAF timestamp). null이면 페이드 중이 아니다 — ROUND_FADE_MS 참고.
  const roundFadeStartRef = useRef<number | null>(null);
  // 현재 백킹 스토어 배율 — 리사이즈 효과가 갱신하고 렌더 루프가 매 프레임 읽는다.
  // state가 아니라 ref인 이유는, 창 크기를 바꿀 때마다 rAF 루프가 취소·재생성되는 걸 막기 위함이다.
  const renderScaleRef = useRef(1);
  // 마지막 수평 이동 방향 — 스프라이트가 원본은 오른쪽을 보고 있으므로 왼쪽 이동 시 좌우 반전한다.
  const facingRightRef = useRef(true);
  // --- 오디오 타이밍 상태 (렌더에 영향을 주지 않으므로 전부 ref) ---
  // 마지막으로 발소리를 낸 걷기 프레임 번호 — 걷기 애니메이션(WALK_FRAME_MS)과 발소리를
  // 같은 주기로 묶어 발이 땅에 닿는 타이밍에 소리가 나게 한다. 멈추면 -1로 리셋한다.
  const lastFootstepFrameRef = useRef(-1);
  const [sprites, setSprites] = useState<CharacterSprites | null>(null);
  const [background, setBackground] = useState<HTMLImageElement | null>(null);
  const [tiles, setTiles] = useState<TileArt>({ floor: null, wall: null });

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

  useEffect(() => {
    let cancelled = false;
    loadTileArt()
      .then((loaded) => {
        if (!cancelled) setTiles(loaded);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 게임 화면(`.stage`)을 남는 공간에 맞춰 4:3으로 letterbox하고, 캔버스 백킹
   * 스토어를 그 크기 × 기기 픽셀비로 맞춘다.
   *
   * **크기 기준을 실측에서 얻는다** — 예전에는 뷰포트를 재고 페이지 헤더·푸터
   * 높이를 상수(`PAGE_CHROME_HEIGHT = 216`)로 빼서 계산했다. 그 값은 `index.css`
   * 레이아웃의 실측치라, 헤더 폰트 하나만 키워도 조용히 어긋나 스크롤이 생겼다.
   * 이제 `.stage-frame`의 콘텐츠 박스를 직접 재므로 CSS를 어떻게 바꾸든 따라간다.
   *
   * `.stage`에 px를 써넣는 이유(순수 CSS로 안 되는 이유)는 `index.css`의 `.stage`
   * 주석 참고 — 요약하면 `aspect-ratio`는 한 축이 확정되면 다른 축의 max가 걸려도
   * 비율로 되돌리지 않아 letterbox가 깨진다.
   *
   * 렌더 루프와 분리된 별도 효과다 — 창 크기가 바뀌어도 rAF 루프는 그대로 두고
   * 엘리먼트와 `renderScaleRef`만 갱신한다. `canvas.width` 대입은 컨텍스트 상태를
   * 초기화하지만, `renderFrame`이 매 프레임 첫 줄에서 변환을 다시 세팅한다.
   *
   * `window.resize` 대신 `ResizeObserver`를 쓰는 이유:
   * - 프레임당 한 번만 콜백하므로 드래그 리사이즈 중 백킹 스토어를 초당 수십 번
   *   재할당하던 문제가 사라진다(별도 디바운스 불필요).
   * - 창 크기가 그대로여도 레이아웃 변화(헤더 표시/숨김 등)까지 잡아낸다.
   * - 관측 대상은 `.stage`도 `.stage-frame`도 아닌 `.stage-area`다. 앞의 둘은 크기가
   *   `.stage`를 따라가므로(우리가 정하는 값) 관측 → 대입 → 재관측 순환이 된다.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = canvas?.parentElement;
    // App이 렌더하는 바깥 구조: .stage-area(측정용) > .stage-frame(테두리) > .stage
    const frame = canvas?.closest<HTMLElement>(".stage-frame");
    const area = frame?.parentElement;
    if (!canvas || !stage || !frame || !area) return;

    const boxOf = (el: HTMLElement) => {
      // clientWidth/Height는 **패딩 박스**(테두리 제외)라 패딩만 빼면 콘텐츠 박스가
      // 나온다. getBoundingClientRect는 테두리까지 포함해 실제보다 크게 잡힌다.
      const style = getComputedStyle(el);
      return {
        width: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        height: el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      };
    };

    const applyScale = () => {
      const areaBox = boxOf(area);
      // 프레임이 테두리·패딩으로 잡아먹는 몫을 뺀다 — 상수로 박지 않고 실측한다.
      const frameChromeWidth = frame.offsetWidth - boxOf(frame).width;
      const frameChromeHeight = frame.offsetHeight - boxOf(frame).height;
      const availableWidth = areaBox.width - frameChromeWidth;
      const availableHeight = areaBox.height - frameChromeHeight;
      // 아직 레이아웃이 잡히지 않았거나 숨겨진 상태 — 다음 콜백에서 다시 본다.
      if (availableWidth <= 0 || availableHeight <= 0) return;

      // 가로·세로 중 더 빡빡한 쪽에 맞춰 4:3을 유지한다(확대는 하지 않는다 —
      // 논리 해상도보다 키우면 스프라이트가 뭉개진다).
      const fit = Math.min(availableWidth / CANVAS_WIDTH, availableHeight / CANVAS_HEIGHT, 1);
      const cssWidth = Math.floor(CANVAS_WIDTH * fit);
      // 폭만 정한다 — 높이는 `.stage`의 `aspect-ratio`가 서브픽셀까지 정확히 파생한다
      // (양쪽을 각각 내림하면 비율이 0.1%쯤 어긋난다).
      stage.style.width = `${cssWidth}px`;

      const renderScale = canvasRenderScale(cssWidth, window.devicePixelRatio);
      const width = Math.round(CANVAS_WIDTH * renderScale);
      const height = Math.round(CANVAS_HEIGHT * renderScale);
      // 같은 크기면 대입하지 않는다 — 불필요한 백킹 스토어 재할당·컨텍스트 초기화 방지.
      if (canvas.width === width && canvas.height === height) return;

      renderScaleRef.current = renderScale;
      canvas.width = width;
      canvas.height = height;
    };

    applyScale();
    const observer = new ResizeObserver(applyScale);
    observer.observe(area);

    // 배율이 다른 모니터로 창을 옮기면 devicePixelRatio만 바뀌고 CSS 크기는 그대로라
    // ResizeObserver가 뜨지 않는다 — 그 변화를 따로 잡는다. 미디어 쿼리는 현재 dpr에
    // 고정되므로, 한 번 발화하면 새 dpr 기준으로 다시 건다.
    let dprQuery: MediaQueryList | null = null;
    const watchDpr = () => {
      dprQuery?.removeEventListener("change", onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener("change", onDprChange);
    };
    function onDprChange() {
      applyScale();
      watchDpr();
    }
    watchDpr();

    return () => {
      observer.disconnect();
      dprQuery?.removeEventListener("change", onDprChange);
    };
  }, []);

  // 새 스테이지를 로드할 때 재설정해야 하는 상태를 한곳에 모은다 — 수동 재시작(1R부터)과
  // 라운드 전환(다음 라운드 스테이지로) 양쪽이 공유한다.
  function loadStage(nextStage: Stage) {
    stageRef.current = nextStage;
    characterRef.current = { ...nextStage.spawn };
    shadowAngleRef.current = naturalAngle(nextStage.lightSources, nextStage.spawn);
    checkpointsReachedRef.current = nextStage.checkpoints.map(() => false);
    activeLightRef.current = nearestLight(nextStage.lightSources, nextStage.spawn);
    lightSwitchGraceRef.current = 0;
    dyingRef.current = false;
    facingRightRef.current = true;
    // 진행 중이던 라운드 전환 페이드는 여기서 리셋한다 — 라운드 전환 경로는 이
    // 호출 직후 다시 페이드를 걸고, 수동 재시작 경로는 페이드 없이 바로 보인다.
    roundFadeStartRef.current = null;
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
      const audio = audioEngineRef?.current ?? null;

      if (dyingRef.current) {
        if (time - deathAnimStartRef.current >= DEATH_ANIM_MS) {
          // 리스폰은 죽은 자리가 아니라 마지막으로 **직접 밟은** 세이브 포인트로
          // 스냅한다 — 하나도 안 밟았으면 스폰으로 돌아간다(정상 플레이).
          const respawnPoint = respawnPointFor(stage.spawn, stage.checkpoints, checkpointsReachedRef.current);
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
          audio?.play("respawn");
        }
      } else if (!clearedRef.current && !inputDisabled) {
        if (colliderCacheRef.current?.stage !== stage) {
          colliderCacheRef.current = { stage, canOccupy: createGridCollider(stage.grid, CHARACTER_RADIUS) };
        }
        const canOccupy = colliderCacheRef.current.canOccupy;
        const moveInput = controlsReversed(roundRef.current)
          ? reverseMoveInput(inputRef.current)
          : inputRef.current;
        const moveResult = moveCharacter(characterRef.current, moveInput, deltaSeconds, canOccupy);
        characterRef.current = moveResult.position;
        // 벽에 부딪힌 축이 있으면 둔탁한 소리를 낸다 — 벽에 붙어 달리면 매 프레임
        // 발생하므로 실제 재생 빈도는 큐 쿨다운(soundCues.ts)이 제한한다.
        if (moveResult.blockedX || moveResult.blockedY) audio?.play("wallBump");

        if (moveInput.right) facingRightRef.current = true;
        else if (moveInput.left) facingRightRef.current = false;
        isMoving = moveInput.up || moveInput.down || moveInput.left || moveInput.right;

        // 발소리를 걷기 애니메이션과 같은 주기에 묶는다 — 프레임이 바뀌는 순간이
        // 곧 발이 땅에 닿는 순간이라, 별도 타이머를 두면 그림과 소리가 어긋난다.
        if (isMoving) {
          const walkFrame = Math.floor(time / WALK_FRAME_MS);
          if (walkFrame !== lastFootstepFrameRef.current) {
            lastFootstepFrameRef.current = walkFrame;
            audio?.play("footstep");
          }
        } else {
          lastFootstepFrameRef.current = -1;
        }

        if (inputRef.current.rotateCW) {
          shadowAngleRef.current += getTuning().rotationSpeed * deltaSeconds;
        }
        if (inputRef.current.rotateCCW) {
          shadowAngleRef.current -= getTuning().rotationSpeed * deltaSeconds;
        }
        // 회전하는 동안만 이어지는 루프음. 엔진이 중복 호출을 무시하므로 매 프레임 불러도 된다.
        if (inputRef.current.rotateCW || inputRef.current.rotateCCW) {
          audio?.startLoop("rotateLoop");
        } else {
          audio?.stopLoop("rotateLoop");
        }

        // 최근접(활성) 광원이 바뀌는 순간을 감지해 판정 유예를 건다 — 광원 전환
        // 시 요구 각도가 최대 180도 가까이 순간적으로 바뀔 수 있는데, 회전
        // 속도로는 한 프레임 안에 따라잡을 수 없어 그대로 두면 무조건 죽는다
        // (ADR-004). 유예 동안은 정렬이 깨져도 죽지 않는다.
        const currentActiveLight = nearestLight(stage.lightSources, characterRef.current);
        if (currentActiveLight.x !== activeLightRef.current.x || currentActiveLight.y !== activeLightRef.current.y) {
          lightSwitchGraceRef.current = getTuning().lightSwitchGraceSeconds;
          activeLightRef.current = currentActiveLight;
          // 요구 각도가 방금 크게 바뀌었고 잠시 무적이라는 것을 알린다 — 이 소리가
          // 없으면 플레이어는 왜 갑자기 그림자를 크게 돌려야 하는지 알 수 없다.
          audio?.play("lightSwitch");
        }

        // 이번 프레임에 세이브 포인트를 새로 밟았는지 — 활성화(래치)와, 그 프레임의
        // 정렬 판정 스킵에 함께 쓴다. 스킵은 광원 전환 경계선과 체크포인트 근방이
        // 우연히 겹칠 때(ADR-004) 불공정한 사망을 막기 위한 용도다.
        let justReachedSavePoint = false;
        stage.checkpoints.forEach((checkpoint, i) => {
          if (checkpointsReachedRef.current[i]) return;
          if (!hasTouchedCheckpoint(characterRef.current, checkpoint)) return;
          checkpointsReachedRef.current[i] = true;
          justReachedSavePoint = true;
          audio?.play("checkpoint");
        });
        // 이 라운드 스테이지의 골에 실제로 접촉했는지 — 도달하면 다음 라운드용
        // 새 스테이지로 전환하거나(마지막 라운드면) 전체 클리어된다. 세이브
        // 포인트와 동일하게 물리적 접촉(hasTouchedCheckpoint)으로 판정한다 —
        // 이전에는 진척도(스폰 기준 BFS 거리, goalProgress) 스칼라 비교였는데,
        // 통로 폭 2칸이 만드는 막다른 갈래가 골보다 더 먼 BFS 거리를 가질 수 있어
        // 골 근처에도 못 가고 그 갈래에 들어서기만 해도 클리어로 오판됐다(실측
        // 확인). 세이브 포인트가 같은 이유로 이미 이 방식으로 바뀐 전례가 있다
        // (`core/round.ts`의 `respawnPointFor` 주석 참고).
        const justCleared = !clearedRef.current && hasTouchedCheckpoint(characterRef.current, stage.goal);

        // 세이브 포인트 활성화/골 도달 판정을 정렬 판정보다 먼저 확인한다 — 그
        // 프레임에 정렬이 깨져도 "진행했다"는 사실은 항상 인정되어야 한다(스킵).
        // 그 외 구간에서는 기존과 동일하게 매 프레임 정렬을 검사한다.
        if (justReachedSavePoint || justCleared) {
          if (justCleared) {
            const { round: nextRound, cleared } = roundAfterClear(roundRef.current);
            // 진행이 멈추는 순간이므로 이어지던 회전 루프음도 함께 끊는다.
            audio?.stopLoop("rotateLoop");
            if (cleared) {
              // 마지막 라운드(3R) 골 도달 = 전체 클리어 — 스테이지 교체 없이 그대로 둔다.
              clearedRef.current = true;
              audio?.play("clear");
              onRoundChange?.(roundRef.current, true);
            } else {
              const nextStage = generateStage(seedForRound(DEFAULT_SEED, nextRound));
              loadStage(nextStage);
              stage = nextStage; // ★ 이번 프레임 렌더가 새 스테이지를 참조하도록 재할당(위 let 참고)
              roundRef.current = nextRound;
              // 새 지형이 이번 프레임부터 곧장 보이므로, 여기서 페이드를 걸어
              // 검은 화면에서 밝아지게 한다(ROUND_FADE_MS 참고).
              roundFadeStartRef.current = time;
              audio?.play("roundUp");
              onRoundChange?.(nextRound, false);
            }
          }
          // justReachedSavePoint만 true인 경우는 라운드 변화 없이 이번 프레임 정렬 판정만 스킵한다.
        } else {
          const tolerance = effectiveAngleTolerance(roundRef.current, getTuning().safeAngleTolerance);
          const natural = naturalAngle(stage.lightSources, characterRef.current);
          const margin = alignmentMargin(shadowAngleRef.current, natural, tolerance);

          if (margin > 1 && lightSwitchGraceRef.current <= 0) {
            dyingRef.current = true;
            deathAnimStartRef.current = time;
            deathCountRef.current += 1;
            // 죽는 순간 이어지던 회전 루프음을 끊고 사망음으로 넘긴다 — 그대로 두면
            // 죽어서 조작이 멈춘 뒤에도 회전음이 계속 난다.
            audio?.stopLoop("rotateLoop");
            audio?.play("death");
            onDeathCountChange?.(deathCountRef.current);
          }
        }

        if (lightSwitchGraceRef.current > 0) {
          lightSwitchGraceRef.current = Math.max(0, lightSwitchGraceRef.current - deltaSeconds);
        }
      }

      // 렌더용 위험도/포즈 — 사망 리셋 등으로 위치가 막 바뀌었을 수 있어 매 프레임 다시 계산한다.
      const tolerance = effectiveAngleTolerance(roundRef.current, getTuning().safeAngleTolerance);
      const natural = naturalAngle(stage.lightSources, characterRef.current);
      const margin = alignmentMargin(shadowAngleRef.current, natural, tolerance);
      // 게임플레이가 진행 중이 아니면(사망 연출·클리어·대사창 표시 중) 회전 루프음을 끈다 —
      // 조작이 멈춘 상태에서 회전키를 누르고 있었다면 루프음이 그대로 남는다.
      const playing = !dyingRef.current && !clearedRef.current && !inputDisabled;
      if (!playing) {
        audio?.stopLoop("rotateLoop");
      }

      const deathInfo = dyingRef.current
        ? deathFrameInfo(time - deathAnimStartRef.current, DEATH_ANIM_MS, time)
        : undefined;
      const bodyPose: BodyPose = deathInfo ? deathInfo.current : selectBodyPose(margin, isMoving);
      const shadowExpression = selectShadowExpression(margin);
      const fadeAlpha = roundFadeAlpha(roundFadeStartRef.current, time);
      // 페이드가 끝나면 시작 시각을 비워 다음 프레임부터 계산 자체를 건너뛴다.
      if (fadeAlpha <= 0) roundFadeStartRef.current = null;
      // 활성화 상태는 래치라, 한 번 밟은 세이브 포인트는 그 스테이지가 끝날 때까지 유지된다.
      const checkpointsActivated = checkpointsReachedRef.current;

      renderFrame(ctx, stage, sprites, background, tiles, {
        characterPos: characterRef.current,
        shadowAngle: shadowAngleRef.current,
        bodyPose,
        shadowExpression,
        deathInfo,
        checkpointsActivated,
        round: roundRef.current,
        renderScale: renderScaleRef.current,
        fadeAlpha,
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
  }, [inputRef, onDeathCountChange, onRoundChange, inputDisabled, sprites, background, tiles, audioEngineRef]);

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
  /** `stage.checkpoints`와 순서·길이가 같은 활성화 여부 — 직접 밟은 세이브 포인트를 다른 색으로 표시한다. */
  checkpointsActivated: readonly boolean[];
  round: Round;
  /**
   * 백킹 스토어 배율 — 논리 좌표(800×600)를 실제 픽셀로 옮기는 기준 변환 값이다.
   * `canvasRenderScale` 참고. 1이면 예전과 완전히 동일하게 동작한다.
   */
  renderScale: number;
  /**
   * 라운드 전환 페이드의 검은 오버레이 불투명도(0~1). 0이면 오버레이를 그리지 않는다.
   *
   * 예전에는 `cleared: boolean`을 받아 전체 클리어 시 캔버스에 "클리어!" 텍스트를
   * 그렸다. 그 역할은 엔딩 컷신(`App.tsx`의 `endingSlides` — 사망 횟수·클리어 시간
   * 요약 포함)이 대신하므로, 이 자리는 라운드 이음매를 가리는 페이드로 바꿨다.
   */
  fadeAlpha: number;
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
 * shadowAngle 방향으로 그림자 길이(tuning.shadowLength)만큼 떨어진 지점에 오도록 하고, 로컬
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
  const stretch = (getTuning().shadowLength / h) * pulse;
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
  tiles: TileArt,
  state: RenderState,
) {
  const {
    characterPos,
    shadowAngle,
    bodyPose,
    shadowExpression,
    deathInfo,
    checkpointsActivated,
    round,
    renderScale,
    fadeAlpha,
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
  //
  // 단위 행렬 대신 renderScale을 기준 변환으로 깐다 — 아래 모든 그리기는 논리
  // 좌표(800×600)로 그대로 두고, 고DPI 화면에서만 실제 픽셀이 늘어난다.
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 카메라 — 캐릭터를 화면 중앙에 두고 확대해서, 맵 전체를 축소해 보여주는 대신
  // 캐릭터 주변을 크게 보여준다(시트의 "인게임 느낌" 목업 참고). 맵 가장자리를
  // 벗어나 빈 공간이 보이지 않도록 카메라 위치를 맵 범위 안으로 클램프한다.
  // 클램프 기준은 캔버스가 아니라 **맵** 크기다 — 맵이 캔버스보다 커질 수 있게
  // 되면서(`core/tuning.ts`의 `worldCols`/`worldRows`) 둘이 더 이상 같지 않다.
  // stage.grid에서 직접 읽으므로 맵 크기가 바뀌어도 따로 손댈 곳이 없다.
  const mapWidth = stage.grid.cols * stage.grid.tileSize;
  const mapHeight = stage.grid.rows * stage.grid.tileSize;
  const viewW = CANVAS_WIDTH / CAMERA_ZOOM;
  const viewH = CANVAS_HEIGHT / CAMERA_ZOOM;
  // 맵이 화면보다 작으면 clamp의 max가 음수가 되어 min>max로 뒤집힌다 — 그 경우
  // 0으로 눌러 맵 좌상단을 기준으로 보여준다(빈 공간은 배경색으로 남는다).
  const camX = clamp(characterPos.x - viewW / 2, 0, Math.max(0, mapWidth - viewW));
  const camY = clamp(characterPos.y - viewH / 2, 0, Math.max(0, mapHeight - viewH));

  ctx.save();
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-camX, -camY);

  drawStage(ctx, stage, background, checkpointsActivated, round, tiles);

  // 안전 구역 가이드라인 — 1R에서만 표시 (2R부터 제거, PRD §7-1). 기준색
  // (#dcafbe)은 background-art-prompt-guide.md 컬러 팔레트가 "안전구역 경계선
  // UI 전용"으로 예약해 둔 포인트색이다. 벽 오버레이는 이 PR에서 석재 턱
  // 재질(따뜻한 무채색, drawStage.ts의 buildWallLayer 참고)로 바뀌었으므로 더
  // 이상 같은 색 계열이 아니다 — "위험 경계"라는 의미는 형태(부채꼴 vs 턱)로만
  // 구분한다.
  //
  // 색 자체는 고정이 아니라 margin(safeZoneWedgeColor)에 따라 안전→경고→위험으로
  // 물든다 — 몸 포즈·그림자 표정과 같은 신호를 그대로 재사용해, 그림자가 경계에
  // 가까워지는 긴장감을 가이드가 사라지기 전(1R)에 미리 학습시킨다.
  if (isGuideVisible(round)) {
    const wedgeColor = safeZoneWedgeColor(margin);
    ctx.beginPath();
    ctx.moveTo(characterPos.x, characterPos.y);
    ctx.arc(characterPos.x, characterPos.y, safeZoneRadius(), natural - tolerance, natural + tolerance);
    ctx.closePath();
    ctx.fillStyle = wedgeColor.fill;
    ctx.fill();
    ctx.strokeStyle = wedgeColor.stroke;
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
  stage.lightSources.forEach((light) => {
    const isActive = light === activeLight;
    const lanternColor = isActive ? LANTERN_COLOR_ACTIVE : LANTERN_COLOR_INACTIVE;
    const lanternRgb = hexToRgbString(lanternColor);
    const poolRadius = isActive ? 46 : 26;
    const pool = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, poolRadius);
    if (isActive) {
      pool.addColorStop(0, `rgba(${lanternRgb}, 0.85)`);
      pool.addColorStop(0.4, `rgba(${lanternRgb}, 0.35)`);
      pool.addColorStop(1, `rgba(${lanternRgb}, 0)`);
    } else {
      pool.addColorStop(0, `rgba(${lanternRgb}, 0.5)`);
      pool.addColorStop(1, `rgba(${lanternRgb}, 0)`);
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

    if (isActive) {
      const beam = ctx.createLinearGradient(light.x, headY, light.x, light.y);
      beam.addColorStop(0, `rgba(${lanternRgb}, 0.28)`);
      beam.addColorStop(1, `rgba(${lanternRgb}, 0)`);
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
      ctx.shadowColor = LANTERN_COLOR_ACTIVE;
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
  });

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

  // 라운드 전환 페이드 — 새 스테이지가 검은 화면에서 밝아진다(ROUND_FADE_MS 참고).
  // 사망 비네트·플래시보다 뒤에 그려야 전환 순간을 완전히 덮는다.
  if (fadeAlpha > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}
