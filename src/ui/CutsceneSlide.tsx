import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";

interface CutsceneSlideProps {
  /** 순서대로 보여줄 슬라이드 텍스트 목록. */
  slides: readonly string[];
  /** 마지막 슬라이드까지 넘긴 뒤 호출된다. */
  onFinish: () => void;
}

/**
 * 오프닝/엔딩 컷신 (PRD §7-2) — 텍스트+정적 이미지 수준의 풀스크린 슬라이드.
 * DialogueBox와 달리 게임 화면 전체를 덮어 진행 중인 조작을 완전히 막는다
 * (컷신 중엔 다른 UI를 조작할 이유가 없으므로 pointerEvents 분리가 불필요).
 */
function CutsceneSlide({ slides, onFinish }: CutsceneSlideProps) {
  const [index, setIndex] = useState(0);

  const advance = useCallback(() => {
    setIndex((current) => current + 1);
  }, []);

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
