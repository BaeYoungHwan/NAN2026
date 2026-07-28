import { useCallback, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Round } from "./core/round";
import { ENDING_SLIDES, OPENING_SLIDES } from "./content/cutsceneSlides";
import { DEATH_LINES, pickRandomLine, ROUND_ADVANCE_LINES, TUTORIAL_LINES } from "./content/reaperLines";
import CutsceneSlide from "./ui/CutsceneSlide";
import DialogueBox from "./ui/DialogueBox";
import GameCanvas, { type GameCanvasHandle } from "./ui/GameCanvas";
import HUD from "./ui/HUD";
import RestartButton from "./ui/RestartButton";

const DEATH_LINE_AUTO_DISMISS_MS = 1500;

function App() {
  const [deathCount, setDeathCount] = useState(0);
  const [round, setRound] = useState<Round>(1);
  const [dialogueQueue, setDialogueQueue] = useState<string[]>([]);
  const [dialogueAutoDismissMs, setDialogueAutoDismissMs] = useState<number | undefined>(undefined);
  const [showOpening, setShowOpening] = useState(true);
  const [showEnding, setShowEnding] = useState(false);
  const gameCanvasRef = useRef<GameCanvasHandle>(null);

  const handleDeathCountChange = useCallback((count: number) => {
    setDeathCount(count);
    setDialogueQueue([pickRandomLine(DEATH_LINES)]);
    setDialogueAutoDismissMs(DEATH_LINE_AUTO_DISMISS_MS);
  }, []);

  const handleRoundChange = useCallback((nextRound: Round, stageCleared: boolean) => {
    setRound(nextRound);
    // onRoundChange는 라운드가 실제로 승급/클리어된 프레임에만 호출되므로 nextRound는 항상 2R 또는 3R이다.
    if (nextRound !== 1) {
      if (stageCleared) {
        setShowEnding(true);
      } else {
        setDialogueQueue([ROUND_ADVANCE_LINES[nextRound]]);
        setDialogueAutoDismissMs(undefined);
      }
    }
  }, []);

  const handleDialogueAdvance = useCallback(() => {
    setDialogueQueue((queue) => queue.slice(1));
  }, []);

  const handleOpeningFinish = useCallback(() => {
    setShowOpening(false);
    setDialogueQueue([...TUTORIAL_LINES]);
  }, []);

  const handleEndingFinish = useCallback(() => {
    setShowEnding(false);
  }, []);

  const handleRestart = useCallback(() => {
    setRound(1);
    setDialogueQueue([]);
    setDialogueAutoDismissMs(undefined);
    setShowEnding(false);
    gameCanvasRef.current?.restart();
  }, []);

  return (
    <div style={containerStyle}>
      <GameCanvas
        ref={gameCanvasRef}
        onDeathCountChange={handleDeathCountChange}
        onRoundChange={handleRoundChange}
        inputDisabled={dialogueQueue.length > 0 || showOpening || showEnding}
      />
      <HUD round={round} deathCount={deathCount} />
      <RestartButton onRestart={handleRestart} />
      <DialogueBox queue={dialogueQueue} onAdvance={handleDialogueAdvance} autoDismissMs={dialogueAutoDismissMs} />
      {showOpening && <CutsceneSlide slides={OPENING_SLIDES} onFinish={handleOpeningFinish} />}
      {showEnding && <CutsceneSlide slides={ENDING_SLIDES} onFinish={handleEndingFinish} />}
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "relative",
  display: "inline-block",
};

export default App;
