import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { SfxCue } from "../audio/soundCues";

interface CutsceneSlideProps {
  /** 순서대로 보여줄 슬라이드 텍스트 목록. */
  slides: readonly string[];
  /** 마지막 슬라이드까지 넘긴 뒤 호출된다. */
  onFinish: () => void;
  /** 효과음 재생 — 없으면 조용히 동작한다. */
  playSound?: (cue: SfxCue) => void;
}

/**
 * 오프닝/엔딩 컷신 (PRD §7-2) — 텍스트+정적 이미지 수준의 풀스크린 슬라이드.
 * 배경이 불투명해 GameCanvas·HUD를 완전히 가리지만, RestartButton은 자체
 * z-index로 이 위에서도 보이고 클릭 가능하다 (컷신 표시 중에도 재시작 가능).
 */
function CutsceneSlide({ slides, onFinish, playSound }: CutsceneSlideProps) {
  const [index, setIndex] = useState(0);

  const advance = useCallback(() => {
    playSound?.("cutsceneAdvance");
    setIndex((current) => current + 1);
  }, [playSound]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        advance();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advance]);

  // 마지막 슬라이드를 넘기면 index가 slides.length에 도달해 currentText가 undefined가
  // 되는 시점에 onFinish를 한 번만 호출한다 (DialogueBox의 빈 큐 처리와 동일한 패턴).
  useEffect(() => {
    if (index >= slides.length) onFinish();
  }, [index, slides.length, onFinish]);

  const currentText = slides[index];
  if (!currentText) return null;

  return (
    <div style={screenStyle} onClick={advance}>
      <p style={textStyle}>{currentText}</p>
      <p style={hintStyle}>
        클릭 또는 Enter/Space로 계속 ({index + 1}/{slides.length})
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
  justifyContent: "center",
  gap: 16,
  background: "#000",
  color: "#eee",
  fontFamily: "sans-serif",
  cursor: "pointer",
  padding: 32,
  textAlign: "center",
};

const textStyle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  lineHeight: 1.6,
  maxWidth: 560,
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#888",
};

export default CutsceneSlide;
