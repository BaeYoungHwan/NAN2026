/**
 * 위험 경고음 매핑 — `alignmentMargin`(0=완벽 정렬, 1=허용 경계, 1 초과=사망)을
 * 이산적인 비프 재생 스펙으로 바꾼다.
 *
 * margin은 매 프레임 계산되는 연속값이라 그대로는 소리로 만들 수 없다. 게임 루프는
 * 이 함수가 돌려준 `intervalMs`만큼 시간이 지났을 때만 비프를 재생하고, 위험할수록
 * 간격이 좁아지고 음량이 커져 "얼마나 위험한지"가 귀로 읽힌다.
 *
 * 2R부터는 안전 구역 가이드라인(부채꼴)이 사라져(`core/round.ts`의 `isGuideVisible`)
 * 시각 피드백이 그림자 색상 하나로 줄어든다 — 이 경고음이 그 공백을 메운다.
 */

/**
 * 경고음이 시작되는 위험도. `ui/GameCanvas.tsx`의 `selectBodyPose`·
 * `selectShadowExpression`이 몸 포즈를 flinch로, 그림자 표정을 surprised로 바꾸는
 * 값과 같다 — 시각과 청각이 같은 순간에 함께 반응해야 플레이어가 두 신호를
 * 하나로 읽는다. 한쪽을 바꾸면 다른 쪽도 함께 바꿔야 한다.
 */
export const DANGER_THRESHOLD = 0.6;

/** 경고 시작 지점의 재생 간격(ms) — 여유가 있을 때는 띄엄띄엄 울린다. */
const MAX_INTERVAL_MS = 500;
/** 경계 직전의 재생 간격(ms). 파일 길이(80ms)보다 길어야 소리가 겹쳐 뭉치지 않는다. */
const MIN_INTERVAL_MS = 120;

const MIN_VOLUME = 0.2;
const MAX_VOLUME = 1;

export interface DangerBeepSpec {
  /** false면 이번 프레임에는 경고음을 내지 않는다. */
  active: boolean;
  /** 다음 비프까지 기다릴 시간(ms). */
  intervalMs: number;
  /** 이번 비프의 음량 배율(0~1) — 큐 기본 음량에 곱해진다. */
  volume: number;
}

const INACTIVE: DangerBeepSpec = { active: false, intervalMs: MAX_INTERVAL_MS, volume: 0 };

/**
 * 위험도에 따른 비프 재생 스펙. 경계(margin=1)에서 가장 빠르고 크게 울리며,
 * margin이 1을 넘으면(=이미 사망 판정) 경고를 멈추고 사망음에 자리를 넘긴다.
 *
 * 방어적으로 NaN·Infinity를 걸러낸다 — `alignmentMargin`은 허용 각도로 나누는
 * 연산이라, 허용 각도가 0이 되는 설정에서는 유한하지 않은 값이 나올 수 있다.
 */
export function dangerBeepSpec(margin: number): DangerBeepSpec {
  if (!Number.isFinite(margin)) return INACTIVE;
  if (margin < DANGER_THRESHOLD || margin > 1) return INACTIVE;

  // DANGER_THRESHOLD..1 구간을 0..1로 정규화한다.
  const intensity = (margin - DANGER_THRESHOLD) / (1 - DANGER_THRESHOLD);

  return {
    active: true,
    intervalMs: MAX_INTERVAL_MS + (MIN_INTERVAL_MS - MAX_INTERVAL_MS) * intensity,
    volume: MIN_VOLUME + (MAX_VOLUME - MIN_VOLUME) * intensity,
  };
}

/**
 * 위험 구간에서 안전으로 막 빠져나온 순간인지 — 안도음(safeReturn)을 한 번만
 * 재생하기 위한 판정이다. 경계를 오가며 떨릴 때 소리가 연발되는 것은 큐 쿨다운
 * (`soundCues.ts`의 minIntervalMs)이 막는다.
 */
export function justReturnedToSafety(previousMargin: number, currentMargin: number): boolean {
  if (!Number.isFinite(previousMargin) || !Number.isFinite(currentMargin)) return false;
  return previousMargin >= DANGER_THRESHOLD && currentMargin < DANGER_THRESHOLD;
}
