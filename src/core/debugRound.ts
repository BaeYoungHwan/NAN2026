import type { Round } from "./round";

/**
 * 개발용 임시 진입점 — URL에 ?round=2 또는 ?round=3을 붙이면 해당 라운드로 바로
 * 시작한다(절차적 생성 맵 확인용, 정식 기능 아님). App/GameCanvas 양쪽이 같은
 * 시작 라운드를 봐야 하므로(HUD 표시 vs 실제 스테이지) 한곳에서만 정의한다.
 */
export function debugRoundFromQuery(): Round {
  const value = Number(new URLSearchParams(window.location.search).get("round"));
  return value === 2 || value === 3 ? value : 1;
}
