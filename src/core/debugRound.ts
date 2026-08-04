import type { Round } from "./round";

/**
 * 개발용 임시 진입점 — URL에 ?round=2 또는 ?round=3을 붙이면 해당 라운드로 바로
 * 시작한다(절차적 생성 맵 확인용, 정식 기능 아님). App/GameCanvas 양쪽이 같은
 * 시작 라운드를 봐야 하므로(HUD 표시 vs 실제 스테이지) 한곳에서만 정의한다.
 *
 * `import.meta.env.DEV`로 게이팅해 프로덕션 빌드(Pages 배포본)에서는 쿼리
 * 파라미터를 완전히 무시한다 — 심사 대상 빌드에서 ?round=3으로 1R/2R을
 * 건너뛸 수 있으면 안 되기 때문(PR #17 리뷰). Vite/Vitest는 프로덕션
 * 모드(`vite build`)가 아닌 한 `DEV`가 true이므로 dev 서버·테스트 실행에는
 * 영향이 없다.
 */
export function debugRoundFromQuery(): Round {
  if (!import.meta.env.DEV) return 1;
  const value = Number(new URLSearchParams(window.location.search).get("round"));
  return value === 2 || value === 3 ? value : 1;
}
