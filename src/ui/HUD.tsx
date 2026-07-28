import type { CSSProperties } from "react";
import { isDemeritRound, type Round } from "../core/round";

interface HUDProps {
  round: Round;
  deathCount: number;
}

function HUD({ round, deathCount }: HUDProps) {
  return (
    <div style={hudStyle}>
      <p style={{ margin: 0 }}>WASD 이동 / , . 그림자 회전 — 파란 원(세이브 포인트)을 지나 주황 원(골)까지 이동하세요</p>
      <p style={{ margin: 0 }}>라운드: {round}R</p>
      {isDemeritRound(round) && <p style={{ margin: 0, color: "#e53935" }}>디메리트: 이동키 반전 + 허용 각도 축소</p>}
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
