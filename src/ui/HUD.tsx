import type { CSSProperties } from "react";
import type { Round } from "../core/round";

interface HUDProps {
  deathCount: number;
  round: Round;
}

function HUD({ deathCount, round }: HUDProps) {
  return (
    <div style={hudStyle}>
      <p style={{ margin: 0 }}>WASD 이동 / , . 그림자 회전 — 주황 원(골)까지 이동하세요</p>
      <p style={{ margin: 0 }}>라운드: {round}R</p>
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
