import type { Stage } from "../core/stage";

/**
 * feature/render-prototype용 하드코딩 스테이지.
 * 실제 절차적 생성(Procedural Generation)은 별도 태스크에서 구현하며,
 * 이 상수는 Stage 계약의 자리 표시자(placeholder) 역할만 한다.
 */
export const STATIC_STAGE: Stage = {
  lightPos: { x: 400, y: 50 },
  boundaryPolygon: [
    { x: 150, y: 150 },
    { x: 650, y: 150 },
    { x: 650, y: 550 },
    { x: 150, y: 550 },
  ],
  obstacles: [],
  // 광원이 (400,50)이라 스폰에서 그림자는 수직 아래로 뻗는다.
  // SHADOW_LENGTH(80)를 더해도 경계 하단(y=550) 안에 들어오도록 여유를 둔다.
  spawn: { x: 400, y: 400 },
};

/** 그림자 길이(ℓ) — 임시 상수. 실제 값은 P1 플레이테스트로 확정한다 (PRD §12 미결). */
export const SHADOW_LENGTH = 80;
