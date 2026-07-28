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
  // 대사 박스·컷신 등 다른 오버레이가 z-index 없이 DOM 순서로 위에 그려지는 것과
  // 무관하게 재시작 버튼은 항상 보이고 클릭 가능해야 한다.
  zIndex: 10,
};

export default RestartButton;
