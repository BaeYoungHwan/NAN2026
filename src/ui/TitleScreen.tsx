import { useEffect } from "react";
import type { CSSProperties } from "react";
import type { SfxCue } from "../audio/soundCues";
import { ASSET_SOURCE_SITE, BGM_CREDITS, formatCredit } from "../content/credits";

export const GAME_TITLE = "돌려돌려 그림자";
export const GAME_TAGLINE = "몸과 그림자를 따로 붙잡고 저승의 경계를 건너세요.";

interface TitleScreenProps {
  /** 시작 입력(Enter/Space/클릭)이 들어왔을 때 호출된다. */
  onStart: () => void;
  /** 효과음 재생 — 없으면 조용히 동작한다. */
  playSound?: (cue: SfxCue) => void;
}

/**
 * 타이틀 화면 — 지금까지 페이지를 열면 곧장 오프닝 컷신이 떠서, 게임 제목이
 * 화면에 한 번도 등장하지 않았다(`index.html`의 `<title>`에만 존재).
 *
 * 렌더 구조는 `CutsceneSlide`와 같은 풀스크린 오버레이 패턴이다 — 부모(`.stage`)가
 * `position: relative`라 `inset: 0`이 캔버스 영역을 정확히 덮는다.
 *
 * 부수 효과로 autoplay 잠금 해제 지점 역할도 한다: `useAudio`가 window의 첫
 * `keydown`/`pointerdown`에서 `AudioContext.resume()`을 시도하므로, 여기서 누르는
 * Enter가 자연스럽게 그 제스처가 된다.
 */
function TitleScreen({ onStart, playSound }: TitleScreenProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      playSound?.("uiClick");
      onStart();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onStart, playSound]);

  const handleClick = () => {
    playSound?.("uiClick");
    onStart();
  };

  return (
    <div style={screenStyle} onClick={handleClick}>
      {/* 본문은 남는 공간을 모두 차지하며 그 안에서 가운데 정렬된다 — 크레딧을
          흐름 밖(absolute)에 두면 좁은 화면에서 줄 수가 늘어날 때 본문을 덮는다. */}
      <div style={mainStyle}>
        <h1 style={titleStyle}>{GAME_TITLE}</h1>
        <p style={taglineStyle}>{GAME_TAGLINE}</p>

        <dl style={keyListStyle}>
          <div style={keyRowStyle}>
            <dt style={keyTermStyle}>W A S D</dt>
            <dd style={keyDescStyle}>캐릭터 이동</dd>
          </div>
          <div style={keyRowStyle}>
            <dt style={keyTermStyle}>, .</dt>
            <dd style={keyDescStyle}>그림자 회전</dd>
          </div>
          <div style={keyRowStyle}>
            <dt style={keyTermStyle}>M</dt>
            <dd style={keyDescStyle}>소리 켜기 / 끄기</dd>
          </div>
        </dl>

        <p style={ruleStyle}>
          그림자가 <strong style={{ color: "#ffb057" }}>안전 구역</strong>(광원 반대편)을 벗어나는 순간 즉사합니다.
        </p>

        <p style={startHintStyle}>Enter — 시작</p>
      </div>

      {/* BGM 중 2곡이 CC-BY라 저작자 표시가 라이선스상 의무다 — 지울 수 없는 표기다. */}
      <p style={creditStyle}>
        음악 — {BGM_CREDITS.map(formatCredit).join(" · ")} — {ASSET_SOURCE_SITE}
      </p>
    </div>
  );
}

const screenStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  // 가로등 불빛이 위에서 내려오는 배경 아트와 톤을 맞춘다.
  background: "radial-gradient(ellipse at 50% 15%, #1c1830 0%, #07060c 75%)",
  color: "#e8e4f0",
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  padding: 24,
  textAlign: "center",
  lineHeight: 1.5,
  // 화면이 아주 좁아 본문+크레딧이 다 안 들어가면 잘라내는 대신 스크롤되게 둔다.
  overflowY: "auto",
};

/**
 * 크레딧을 뺀 본문 — 남는 공간을 차지하고 그 안에서 가운데 정렬된다.
 *
 * `minHeight: 0`을 주면 안 된다. flex 아이템의 기본 `min-height: auto`가 "내용보다
 * 작아지지 않는다"를 보장하는데, 이걸 풀면 화면이 좁을 때 본문이 찌그러지면서
 * 내용이 아래(크레딧 자리)로 넘쳐 겹친다. 대신 부모의 `overflowY: auto`로 스크롤한다.
 */
const mainStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 40,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textShadow: "0 0 32px rgba(255, 176, 87, 0.45)",
};

const taglineStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#9a94ad",
};

const keyListStyle: CSSProperties = {
  margin: "8px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
};

const keyRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "baseline",
  justifyContent: "center",
};

const keyTermStyle: CSSProperties = {
  margin: 0,
  minWidth: 88,
  textAlign: "right",
  letterSpacing: "0.14em",
  color: "#ffb057",
};

const keyDescStyle: CSSProperties = {
  margin: 0,
  minWidth: 120,
  textAlign: "left",
  color: "#c9c4d6",
};

const ruleStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "#c9c4d6",
  maxWidth: 420,
};

const startHintStyle: CSSProperties = {
  margin: "14px 0 0",
  fontSize: 13,
  color: "#9a94ad",
  letterSpacing: "0.1em",
};

/**
 * 크레딧 표기 — 본문 아래 흐름에 배치한다(하단 고정이 아니다). 좁은 화면에서 줄 수가
 * 늘어나면 본문이 그만큼 밀려날 뿐 겹치지 않는다.
 *
 * 색은 본문보다 낮은 대비로 두되 읽을 수는 있어야 한다 — 라이선스 의무 이행이
 * 목적이므로, 배경(#07060c) 대비 약 5.4:1로 WCAG AA(4.5:1)를 넘긴다.
 */
const creditStyle: CSSProperties = {
  margin: 0,
  paddingTop: 12,
  maxWidth: 760,
  fontSize: 11,
  lineHeight: 1.5,
  color: "#8a85a0",
  letterSpacing: "0.01em",
  flexShrink: 0,
};

export default TitleScreen;
