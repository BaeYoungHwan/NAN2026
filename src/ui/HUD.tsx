import type { CSSProperties } from "react";

interface HUDProps {
  deathCount: number;
}

function HUD({ deathCount }: HUDProps) {
  return (
    <div style={hudStyle}>
      <p style={{ margin: 0 }}>WASD 이동 / , . 그림자 회전 — 파란 부채꼴을 벗어나면 리셋</p>
      <p style={{ margin: 0 }}>사망 횟수: {deathCount}</p>
    </div>
  );
}

const hudStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  color: "#eee",
  fontFamily: "sans-serif",
  fontSize: 16,
  pointerEvents: "none",
};

export default HUD;
