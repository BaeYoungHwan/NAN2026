import type { Stage } from "../core/stage";

/**
 * feature/render-prototype용 하드코딩 스테이지.
 * 실제 절차적 생성(Procedural Generation)은 별도 태스크에서 구현하며,
 * 이 상수는 Stage 계약의 자리 표시자(placeholder) 역할만 한다.
 */
export const STATIC_STAGE: Stage = {
  lightPos: { x: 400, y: 50 },
  obstacles: [],
  spawn: { x: 400, y: 300 },
};

/** 그림자 길이(ℓ) — 임시 상수. 실제 값은 P1 플레이테스트로 확정한다 (PRD §12 미결). */
export const SHADOW_LENGTH = 80;

/** 안전 구역 허용 각도(라디안, ±) — 임시 상수. 실제 값은 P1 플레이테스트로 확정한다. */
export const SAFE_ANGLE_TOLERANCE = Math.PI / 6; // ±30도

/** 그림자 회전 속도 (라디안/초) — 임시 상수. */
export const ROTATION_SPEED = Math.PI; // 180도/초
