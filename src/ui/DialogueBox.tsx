import { useEffect } from "react";
import type { CSSProperties } from "react";
import type { SfxCue } from "../audio/soundCues";

const PORTRAIT_SRC = `${import.meta.env.BASE_URL}assets/characters/reaper-portrait-neutral.png`;

interface DialogueBoxProps {
  /** 표시할 대사 큐 — 비어있으면 렌더링하지 않는다. */
  queue: readonly string[];
  /** 현재 줄을 넘길 때 호출된다 (클릭·Enter/Space 키, 또는 자동 사라짐 타이머). */
  onAdvance: () => void;
  /** 지정 시 클릭/키 입력 없이도 이 시간(ms) 후 자동으로 다음 줄로 넘어간다 (예: 사망 재촉 대사). */
  autoDismissMs?: number;
  /** 효과음 재생 — 없으면 조용히 동작한다(오디오 없이도 완전히 기능해야 한다). */
  playSound?: (cue: SfxCue) => void;
}

/**
 * 저승사자 대사 박스 (PRD §7-2) — 애니메이션·음성 없는 텍스트 전용 UI.
 * 큐에 대사가 있는 동안 게임 입력을 막아야 하므로, 호출부(App)가 큐 상태로
 * GameCanvas의 inputDisabled를 함께 제어한다.
 */
function DialogueBox({ queue, onAdvance, autoDismissMs, playSound }: DialogueBoxProps) {
  const currentLine = queue[0];

  // 새 대사가 뜰 때마다 등장음을 낸다. 넘김음(dialogueAdvance)과 달리 자동 사라짐으로
  // 넘어간 다음 줄에도 울려야 하므로, 조작 핸들러가 아니라 표시 자체에 묶는다.
  useEffect(() => {
    if (currentLine) playSound?.("dialogueOpen");
  }, [currentLine, playSound]);

  useEffect(() => {
    if (!currentLine) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        // 넘김음은 플레이어가 직접 넘긴 경우에만 낸다 — 자동 사라짐 타이머로 넘어갈
        // 때까지 소리가 나면 조작하지도 않은 피드백이 들린다.
        playSound?.("dialogueAdvance");
        onAdvance();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentLine, onAdvance, playSound]);

  useEffect(() => {
    if (!currentLine || autoDismissMs === undefined) return;

    const timer = setTimeout(onAdvance, autoDismissMs);
    return () => clearTimeout(timer);
  }, [currentLine, autoDismissMs, onAdvance]);

  if (!currentLine) return null;

  return (
    <div style={overlayStyle}>
      <img src={PORTRAIT_SRC} alt="" style={portraitStyle} />
      <div
        style={boxStyle}
        onClick={() => {
          playSound?.("dialogueAdvance");
          onAdvance();
        }}
      >
        <p style={nameStyle}>저승사자</p>
        <p style={lineStyle}>{currentLine}</p>
        {autoDismissMs === undefined && <p style={hintStyle}>클릭 또는 Enter/Space로 계속</p>}
      </div>
    </div>
  );
}

/** 이 div 자체는 클릭을 받지 않는다(pointerEvents: none) — 화면 전체를 덮는 wrapper가
 * RestartButton 등 다른 절대 위치 UI의 클릭을 가로채지 않도록, 실제 클릭 캡처는
 * boxStyle에만 건다. */
const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-end",
  paddingBottom: 32,
  pointerEvents: "none",
};

// 대화 박스 바로 위, 박스 바깥에 크게 띄우는 저승사자 초상 — 시트의 "표정/반응 예시"
// 그리드 중 기본(평상시) 표정 칸을 크롭한 것(scripts/crop-reaper.mjs). 박스 자체는
// 계속 세로로 좁게 유지하고(가독성 우선 레이아웃 그대로), 초상만 그 위에 겹치지 않게
// 별도 요소로 쌓아 "박스 밖에서 말을 거는" 느낌을 준다.
const portraitStyle: CSSProperties = {
  width: 96,
  height: 96,
  objectFit: "contain",
  marginBottom: 8,
  filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5))",
};

const boxStyle: CSSProperties = {
  width: "80%",
  maxWidth: 480,
  background: "rgba(20, 20, 20, 0.92)",
  border: "1px solid #666",
  borderRadius: 8,
  padding: "12px 16px",
  color: "#eee",
  fontFamily: "sans-serif",
  pointerEvents: "auto",
  cursor: "pointer",
};

const nameStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#f5d547",
  fontWeight: "bold",
};

const lineStyle: CSSProperties = {
  margin: "6px 0",
  fontSize: 16,
  lineHeight: 1.4,
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "#999",
  textAlign: "right",
};

export default DialogueBox;
