/**
 * 개발용 밸런스 튜닝 패널의 활성화 여부 — URL에 `?tune=1`을 붙였을 때만 켠다.
 *
 * `core/debugRound.ts`와 같은 게이팅 규약이다: `import.meta.env.DEV`로 한 번 더
 * 막아, 프로덕션 빌드(Pages 배포본)에서는 쿼리 파라미터를 붙여도 패널이 절대
 * 뜨지 않는다 — 심사 대상 빌드에서 플레이어가 난이도를 조절할 수 있으면 안 된다.
 *
 * 이 패널이 존재하는 이유: PRD §12 미결 사항(그림자 길이·회전 속도·허용 각도·
 * 가로등 간격·3R 배율)을 플레이테스트로 확정해야 하는데, 값을 바꿀 때마다 코드를
 * 고치고 새로고침하면 라운드 진행 상태가 초기화돼 "3R 체감"을 반복 확인하기가
 * 어렵다. 패널로 즉시 바꿔가며 같은 판 안에서 비교한다.
 */
export function isTuningEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get("tune") === "1";
}
