import { useEffect } from "react";
import type { CSSProperties } from "react";
import type { SfxCue } from "../audio/soundCues";

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
  );
}

const screenStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  // 가로등 불빛이 위에서 내려오는 배경 아트와 톤을 맞춘다.
  background: "radial-gradient(ellipse at 50% 15%, #1c1830 0%, #07060c 75%)",
  color: "#e8e4f0",
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  padding: 32,
  textAlign: "center",
  lineHeight: 1.5,
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

export default TitleScreen;
