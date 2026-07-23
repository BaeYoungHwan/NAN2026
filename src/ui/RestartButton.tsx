import type { CSSProperties } from "react";

interface RestartButtonProps {
  onRestart: () => void;
}

function RestartButton({ onRestart }: RestartButtonProps) {
  return (
    <button type="button" style={buttonStyle} onClick={onRestart}>
      재시작
    </button>
  );
}

const buttonStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  padding: "8px 16px",
  fontSize: 14,
  cursor: "pointer",
};

export default RestartButton;
