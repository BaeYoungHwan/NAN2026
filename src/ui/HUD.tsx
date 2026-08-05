import { isDemeritRound, MAX_ROUND, type Round } from "../core/round";

interface HUDProps {
  round: Round;
  deathCount: number;
}

/**
 * 인게임 HUD — 라운드 진행 상황과 사망 횟수만 보여준다.
 *
 * 예전에는 조작법 전체("WASD 이동 / , . 그림자 회전 — 크림색 촛불을 지나...")가
 * 항상 좌상단에 떠 있었다. 조작 안내는 게임 시작 전(`TitleScreen`)과 튜토리얼
 * 대사(`content/reaperLines.ts`의 `TUTORIAL_LINES`)에서 이미 두 번 전달되므로,
 * 플레이 중에는 화면을 차지할 이유가 없다. 음소거 상태도 클릭 가능한 버튼
 * (`MuteButton`)으로 옮겨 HUD에서 뺐다.
 *
 * 스타일은 `src/index.css`의 `.hud` 클래스 — 배경 아트 위에서 글자가 묻히지
 * 않도록 반투명 패널을 깐다.
 */
function HUD({ round, deathCount }: HUDProps) {
  return (
    <div className="hud">
      <p className="hud__row">
        <span className="hud__label">라운드</span>
        <span className="hud__value">
          {round} / {MAX_ROUND}
        </span>
      </p>
      <p className="hud__row">
        <span className="hud__label">사망</span>
        <span className="hud__value">{deathCount}</span>
      </p>
      {isDemeritRound(round) && <p className="hud__demerit">디메리트: 이동키 반전 + 허용 각도 축소</p>}
    </div>
  );
}

export default HUD;
