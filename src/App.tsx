import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Round } from "./core/round";
import { BGM_FOR_ROUND } from "./audio/soundCues";
import { useAudio } from "./audio/useAudio";
import { debugRoundFromQuery } from "./core/debugRound";
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
  const [round, setRound] = useState<Round>(debugRoundFromQuery);
  const [dialogueQueue, setDialogueQueue] = useState<string[]>([]);
  const [dialogueAutoDismissMs, setDialogueAutoDismissMs] = useState<number | undefined>(undefined);
  // ?round=2/3 디버그 프리뷰로 들어온 경우(개발 빌드 한정 — debugRoundFromQuery
  // 참고) 오프닝 컷신을 건너뛴다. 절차적 생성 맵을 빠르게 확인하려는 목적과
  // 오프닝이 항상 뜨는 게 어긋난다는 지적(PR #17 리뷰) 반영.
  const [showOpening, setShowOpening] = useState(() => round === 1);
  const [showEnding, setShowEnding] = useState(false);
  const gameCanvasRef = useRef<GameCanvasHandle>(null);
  const audio = useAudio();
  const { engineRef: audioEngineRef, muted, play, playBgm, ready: audioReady } = audio;

  /**
   * 화면 상태에 맞는 배경음으로 전환한다. 같은 곡을 다시 요청하면 엔진이 무시하므로
   * 렌더마다 실행돼도 재시작되지 않는다.
   *
   * `audioReady`가 의존성에 있어야 한다 — 오디오 초기화는 비동기라, 앱이 처음 뜨는
   * 시점(오프닝 컷신)에는 아직 엔진이 없어 이 호출이 그냥 무시된다. 준비가 끝나면
   * 다시 실행되어 그때 재생된다.
   */
  useEffect(() => {
    if (showOpening) playBgm("opening");
    else if (showEnding) playBgm("ending");
    else playBgm(BGM_FOR_ROUND[round]);
  }, [showOpening, showEnding, round, playBgm, audioReady]);

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
    play("uiClick");
    setRound(1);
    setDialogueQueue([]);
    setDialogueAutoDismissMs(undefined);
    setShowEnding(false);
    gameCanvasRef.current?.restart();
  }, [play]);

  return (
    <div style={containerStyle}>
      <GameCanvas
        ref={gameCanvasRef}
        onDeathCountChange={handleDeathCountChange}
        onRoundChange={handleRoundChange}
        inputDisabled={dialogueQueue.length > 0 || showOpening || showEnding}
        audioEngineRef={audioEngineRef}
      />
      <HUD round={round} deathCount={deathCount} muted={muted} />
      <RestartButton onRestart={handleRestart} />
      <DialogueBox
        queue={dialogueQueue}
        onAdvance={handleDialogueAdvance}
        autoDismissMs={dialogueAutoDismissMs}
        playSound={play}
      />
      {showOpening && <CutsceneSlide slides={OPENING_SLIDES} onFinish={handleOpeningFinish} playSound={play} />}
      {showEnding && <CutsceneSlide slides={ENDING_SLIDES} onFinish={handleEndingFinish} playSound={play} />}
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "relative",
  display: "inline-block",
};

export default App;
