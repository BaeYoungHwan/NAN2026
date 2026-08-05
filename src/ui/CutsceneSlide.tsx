import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { SfxCue } from "../audio/soundCues";

interface CutsceneSlideProps {
  /** 순서대로 보여줄 슬라이드 텍스트 목록. */
  slides: readonly string[];
  /** 마지막 슬라이드까지 넘긴 뒤 호출된다. `holdAtEnd`가 true면 호출되지 않는다. */
  onFinish: () => void;
  /**
   * 마지막 슬라이드에서 멈춘 채 유지할지 여부 — 엔딩(게임의 종료 상태)에서 쓴다.
   *
   * 오프닝은 다 넘기면 사라지고 게임이 시작돼야 하지만, 엔딩은 넘길 다음 화면이
   * 없다. 여기서 사라지면 조작이 멈춘 게임 화면만 덩그러니 남아 "멈춘 것"처럼
   * 보인다(예전에는 캔버스에 "클리어!" 텍스트를 그려 그 자리를 메웠다). 결과
   * 요약을 그대로 띄워두고, 다시 하려면 재시작 버튼을 쓰게 한다.
   */
  holdAtEnd?: boolean;
  /** 효과음 재생 — 없으면 조용히 동작한다. */
  playSound?: (cue: SfxCue) => void;
}

/**
 * 오프닝/엔딩 컷신 (PRD §7-2) — 텍스트+정적 이미지 수준의 풀스크린 슬라이드.
 * 배경이 불투명해 GameCanvas·HUD를 완전히 가리지만, RestartButton은 자체
 * z-index로 이 위에서도 보이고 클릭 가능하다 (컷신 표시 중에도 재시작 가능).
 */
function CutsceneSlide({ slides, onFinish, holdAtEnd = false, playSound }: CutsceneSlideProps) {
  const [index, setIndex] = useState(0);
  const atLastSlide = index >= slides.length - 1;

  const advance = useCallback(() => {
    // 마지막 슬라이드에서 붙잡아 두는 모드면 더 넘기지 않는다 — 효과음도 내지
    // 않아야 아무 반응 없이 소리만 나는 상황을 피한다.
    if (holdAtEnd && atLastSlide) return;
    playSound?.("cutsceneAdvance");
    setIndex((current) => current + 1);
  }, [atLastSlide, holdAtEnd, playSound]);

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
  // holdAtEnd면 index가 거기까지 가지 않으므로 자연히 호출되지 않는다.
  useEffect(() => {
    if (index >= slides.length) onFinish();
  }, [index, slides.length, onFinish]);

  const currentText = slides[index];
  if (!currentText) return null;

  return (
    <div style={screenStyle} onClick={advance}>
      <p style={textStyle}>{currentText}</p>
      <p style={hintStyle}>
        {holdAtEnd && atLastSlide
          ? "우측 상단 재시작 버튼으로 처음부터 다시 플레이할 수 있어요"
          : `클릭 또는 Enter/Space로 계속 (${index + 1}/${slides.length})`}
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
  // 엔딩 결과 요약 슬라이드처럼 개행이 의미를 갖는 텍스트가 있다(`App.tsx`의
  // endingSlides). 일반 슬라이드는 개행이 없어 영향받지 않는다.
  whiteSpace: "pre-line",
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#888",
};

export default CutsceneSlide;
