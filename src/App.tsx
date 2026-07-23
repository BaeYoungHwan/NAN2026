import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Round } from "./core/round";
import GameCanvas, { type GameCanvasHandle } from "./ui/GameCanvas";
import HUD from "./ui/HUD";
import RestartButton from "./ui/RestartButton";

function App() {
  const [deathCount, setDeathCount] = useState(0);
  const [round, setRound] = useState<Round>(1);
  const gameCanvasRef = useRef<GameCanvasHandle>(null);

  return (
    <div style={containerStyle}>
      <GameCanvas ref={gameCanvasRef} onDeathCountChange={setDeathCount} onRoundChange={setRound} />
      <HUD deathCount={deathCount} round={round} />
      <RestartButton onRestart={() => gameCanvasRef.current?.restart()} />
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "relative",
  display: "inline-block",
};

export default App;
