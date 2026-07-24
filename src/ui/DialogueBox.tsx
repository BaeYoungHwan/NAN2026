import { useEffect } from "react";
import type { CSSProperties } from "react";

interface DialogueBoxProps {
  /** 표시할 대사 큐 — 비어있으면 렌더링하지 않는다. */
  queue: readonly string[];
  /** 현재 줄을 넘길 때 호출된다 (클릭·Enter/Space 키, 또는 자동 사라짐 타이머). */
  onAdvance: () => void;
  /** 지정 시 클릭/키 입력 없이도 이 시간(ms) 후 자동으로 다음 줄로 넘어간다 (예: 사망 재촉 대사). */
  autoDismissMs?: number;
}

/**
 * 저승사자 대사 박스 (PRD §7-2) — 애니메이션·음성 없는 텍스트 전용 UI.
 * 큐에 대사가 있는 동안 게임 입력을 막아야 하므로, 호출부(App)가 큐 상태로
 * GameCanvas의 inputDisabled를 함께 제어한다.
 */
function DialogueBox({ queue, onAdvance, autoDismissMs }: DialogueBoxProps) {
  const currentLine = queue[0];

  useEffect(() => {
    if (!currentLine) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onAdvance();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentLine, onAdvance]);

  useEffect(() => {
    if (!currentLine || autoDismissMs === undefined) return;

    const timer = setTimeout(onAdvance, autoDismissMs);
    return () => clearTimeout(timer);
  }, [currentLine, autoDismissMs, onAdvance]);

  if (!currentLine) return null;

  return (
    <div style={overlayStyle} onClick={onAdvance}>
      <div style={boxStyle}>
        <p style={nameStyle}>저승사자</p>
        <p style={lineStyle}>{currentLine}</p>
        {autoDismissMs === undefined && <p style={hintStyle}>클릭 또는 Enter/Space로 계속</p>}
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  paddingBottom: 32,
  cursor: "pointer",
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
