import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import GameCanvas, { type GameCanvasHandle } from "./ui/GameCanvas";
import HUD from "./ui/HUD";
import RestartButton from "./ui/RestartButton";

function App() {
  const [deathCount, setDeathCount] = useState(0);
  const gameCanvasRef = useRef<GameCanvasHandle>(null);

  return (
    <div style={containerStyle}>
      <GameCanvas ref={gameCanvasRef} onDeathCountChange={setDeathCount} />
      <HUD deathCount={deathCount} />
      <RestartButton onRestart={() => gameCanvasRef.current?.restart()} />
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "relative",
  display: "inline-block",
};

export default App;
