/**
 * 엔딩 결과 요약 텍스트 — 전체 클리어 후 마지막 슬라이드에 붙는다.
 *
 * `App.tsx`가 아니라 `content/`에 두는 이유: 이 두 함수는 순수 문자열 조립이라
 * React·DOM에 전혀 의존하지 않는데, `App.tsx`에 두면 테스트가 `./App`을 import하면서
 * GameCanvas·오디오 등 UI 그래프 전체를 (기본 환경인 node에서) 끌고 온다. 지금은
 * 그 모듈들이 우연히 모듈 스코프에서 DOM을 안 건드려 통과하지만, 누가 상단에
 * `new Image()` 한 줄만 추가해도 문자열 포맷 테스트가 엉뚱한 이유로 깨진다.
 * `reaperLines.ts`·`cutsceneSlides.ts`와 같은 계층(화면에 나갈 텍스트)이기도 하다.
 */

/** 경과 시간(ms)을 `m분 s초`로. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

/**
 * 엔딩 마지막에 붙일 결과 요약 슬라이드 텍스트를 만든다.
 *
 * 전체 클리어 연출이 캔버스에 "클리어!" 텍스트 한 줄뿐이던 것을 대체한다 —
 * 3라운드를 통과한 보상으로는 너무 빈약했다.
 *
 * `elapsedMs`가 null이면 시간 줄을 생략한다: `?round=2/3` 디버그 진입으로 들어오면
 * 튜토리얼 대사(계측 시작 지점)를 거치지 않아 잰 시간이 없다. 없는 값을 0초로
 * 보여주면 "0초 클리어"라는 거짓말이 된다.
 *
 * 줄 단위로 구성되고 `CutsceneSlide`가 `white-space: pre-line`으로 렌더한다.
 */
export function buildClearSummary(deathCount: number, elapsedMs: number | null): string {
  return [
    "— 결과 —",
    `사망 횟수: ${deathCount}회`,
    elapsedMs === null ? null : `클리어 시간: ${formatDuration(elapsedMs)}`,
    deathCount === 0 ? "무사망 클리어. 그림자를 정말 잘 다루시네요." : "다시 도전하면 더 빨라질 겁니다.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
