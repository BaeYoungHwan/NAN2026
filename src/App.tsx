import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Round } from "./core/round";
import {
  DEATH_LINES,
  pickRandomLine,
  ROUND_ADVANCE_LINES,
  STAGE_CLEAR_LINE,
  TUTORIAL_LINES,
} from "./content/reaperLines";
import DialogueBox from "./ui/DialogueBox";
import GameCanvas, { type GameCanvasHandle } from "./ui/GameCanvas";
import HUD from "./ui/HUD";
import RestartButton from "./ui/RestartButton";

const DEATH_LINE_AUTO_DISMISS_MS = 1500;

function App() {
  const [deathCount, setDeathCount] = useState(0);
  const [round, setRound] = useState<Round>(1);
  const [dialogueQueue, setDialogueQueue] = useState<string[]>([...TUTORIAL_LINES]);
  const [dialogueAutoDismissMs, setDialogueAutoDismissMs] = useState<number | undefined>(undefined);
  const gameCanvasRef = useRef<GameCanvasHandle>(null);

  const handleDeathCountChange = (count: number) => {
    setDeathCount(count);
    setDialogueQueue([pickRandomLine(DEATH_LINES)]);
    setDialogueAutoDismissMs(DEATH_LINE_AUTO_DISMISS_MS);
  };

  const handleRoundChange = (nextRound: Round, stageCleared: boolean) => {
    setRound(nextRound);
    setDialogueQueue([stageCleared ? STAGE_CLEAR_LINE : ROUND_ADVANCE_LINES[nextRound]]);
    setDialogueAutoDismissMs(undefined);
  };

  const handleDialogueAdvance = () => {
    setDialogueQueue((queue) => queue.slice(1));
  };

  const handleRestart = () => {
    setRound(1);
    gameCanvasRef.current?.restart();
  };

  return (
    <div style={containerStyle}>
      <GameCanvas
        ref={gameCanvasRef}
        onDeathCountChange={handleDeathCountChange}
        onRoundChange={handleRoundChange}
        inputDisabled={dialogueQueue.length > 0}
      />
      <HUD round={round} deathCount={deathCount} />
      <RestartButton onRestart={handleRestart} />
      <DialogueBox queue={dialogueQueue} onAdvance={handleDialogueAdvance} autoDismissMs={dialogueAutoDismissMs} />
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "relative",
  display: "inline-block",
};

export default App;
