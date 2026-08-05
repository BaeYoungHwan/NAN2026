import type { CSSProperties } from "react";
import { isDemeritRound, type Round } from "../core/round";

interface HUDProps {
  round: Round;
  deathCount: number;
  /** 음소거 상태 — M 키로 토글된다(`audio/useAudio.ts`). */
  muted?: boolean;
}

function HUD({ round, deathCount, muted = false }: HUDProps) {
  return (
    <div style={hudStyle}>
      <p style={{ margin: 0 }}>
        WASD 이동 / , . 그림자 회전 — 크림색 촛불(세이브 포인트)을 지나 주황 촛불(골)까지 이동하세요. 세이브 포인트를 밟으면 사망 시 그 지점에서
        재개합니다
      </p>
      <p style={{ margin: 0 }}>라운드: {round}R</p>
      {isDemeritRound(round) && <p style={{ margin: 0, color: "#e53935" }}>디메리트: 이동키 반전 + 허용 각도 축소</p>}
      <p style={{ margin: 0 }}>사망 횟수: {deathCount}</p>
      <p style={{ margin: 0, color: muted ? "#e53935" : "#999" }}>M: 소리 {muted ? "꺼짐" : "켜짐"}</p>
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
