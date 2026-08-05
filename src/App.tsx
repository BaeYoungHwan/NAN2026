import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Round } from "./core/round";
import { BGM_FOR_ROUND } from "./audio/soundCues";
import { useAudio } from "./audio/useAudio";
import { debugRoundFromQuery } from "./core/debugRound";
import { isTuningEnabled } from "./core/debugTuning";
import { buildClearSummary } from "./content/clearSummary";
import { ENDING_SLIDES, OPENING_SLIDES } from "./content/cutsceneSlides";
import { DEATH_LINES, pickRandomLine, ROUND_ADVANCE_LINES, TUTORIAL_LINES } from "./content/reaperLines";
import CutsceneSlide from "./ui/CutsceneSlide";
import DialogueBox from "./ui/DialogueBox";
import GameCanvas, { type GameCanvasHandle } from "./ui/GameCanvas";
import HUD from "./ui/HUD";
import MuteButton from "./ui/MuteButton";
import RestartButton from "./ui/RestartButton";
import TitleScreen, { GAME_TAGLINE, GAME_TITLE } from "./ui/TitleScreen";

/**
 * 개발 전용 튜닝 패널은 지연 로드한다 — 정적 import면 `isTuningEnabled()`가 런타임
 * 분기라 트리셰이킹이 안 돼 패널 코드가 심사용 메인 번들에 그대로 실린다.
 * 동적 import는 아래 `tuningEnabled` 분기 뒤에서만 실행되므로, 프로덕션에서는
 * 청크를 내려받는 일 자체가 없다(청크 파일은 dist에 남는다 — tech-debt TD-005).
 */
const TuningPanel = lazy(() => import("./ui/TuningPanel"));

const DEATH_LINE_AUTO_DISMISS_MS = 1500;

function App() {
  const [deathCount, setDeathCount] = useState(0);
  const [round, setRound] = useState<Round>(debugRoundFromQuery);
  const [dialogueQueue, setDialogueQueue] = useState<string[]>([]);
  const [dialogueAutoDismissMs, setDialogueAutoDismissMs] = useState<number | undefined>(undefined);
  // ?round=2/3 디버그 프리뷰로 들어온 경우(개발 빌드 한정 — debugRoundFromQuery
  // 참고) 타이틀 화면과 오프닝 컷신을 건너뛴다. 절차적 생성 맵을 빠르게 확인하려는
  // 목적과 오프닝이 항상 뜨는 게 어긋난다는 지적(PR #17 리뷰) 반영.
  const [showTitle, setShowTitle] = useState(() => round === 1);
  // 개발 빌드 + ?tune=1 일 때만 true — 프로덕션에서는 항상 false다(core/debugTuning.ts).
  // 한 번만 평가한다: 플레이 도중 URL이 바뀔 일이 없고, 패널이 붙었다 떨어졌다 하면
  // 오히려 계측(경과 시간)이 끊긴다.
  const [tuningEnabled] = useState(isTuningEnabled);
  const [showOpening, setShowOpening] = useState(false);
  const [showEnding, setShowEnding] = useState(false);
  // 전체 클리어 시점에 확정되는 총 플레이 시간(ms). 엔딩 결과 요약에만 쓴다.
  const [clearElapsedMs, setClearElapsedMs] = useState<number | null>(null);
  const playStartedAtRef = useRef<number | null>(null);
  const gameCanvasRef = useRef<GameCanvasHandle>(null);
  const audio = useAudio();
  const { engineRef: audioEngineRef, muted, toggleMute, play, playBgm, ready: audioReady } = audio;

  /**
   * 화면 상태에 맞는 배경음으로 전환한다. 같은 곡을 다시 요청하면 엔진이 무시하므로
   * 렌더마다 실행돼도 재시작되지 않는다.
   *
   * 타이틀 화면은 오프닝과 같은 곡을 쓴다 — 별도 타이틀 BGM을 만들지 않고 세계관
   * 도입부의 분위기를 그대로 이어간다.
   *
   * `audioReady`가 의존성에 있어야 한다 — 오디오 초기화는 비동기라, 앱이 처음 뜨는
   * 시점(타이틀 화면)에는 아직 엔진이 없어 이 호출이 그냥 무시된다. 준비가 끝나면
   * 다시 실행되어 그때 재생된다.
   */
  useEffect(() => {
    if (showTitle || showOpening) playBgm("opening");
    else if (showEnding) playBgm("ending");
    else playBgm(BGM_FOR_ROUND[round]);
  }, [showTitle, showOpening, showEnding, round, playBgm, audioReady]);

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
        // 플레이 시간은 실제 조작이 시작된 시점(튜토리얼 대사 표시 직전)부터 잰다.
        // 타이틀·오프닝을 읽는 시간은 플레이 시간이 아니다.
        const startedAt = playStartedAtRef.current;
        setClearElapsedMs(startedAt === null ? null : performance.now() - startedAt);
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

  const handleTitleStart = useCallback(() => {
    setShowTitle(false);
    setShowOpening(true);
  }, []);

  const handleOpeningFinish = useCallback(() => {
    setShowOpening(false);
    setDialogueQueue([...TUTORIAL_LINES]);
    playStartedAtRef.current = performance.now();
  }, []);

  // 엔딩은 `holdAtEnd`로 마지막 슬라이드에서 멈추므로 실제로는 호출되지 않는다 —
  // CutsceneSlide의 필수 prop이고, holdAtEnd를 떼면 곧바로 옛 동작으로 돌아가는 안전망이다.
  const handleEndingFinish = useCallback(() => {
    setShowEnding(false);
  }, []);

  const handleRestart = useCallback(() => {
    play("uiClick");
    setRound(1);
    setDialogueQueue([]);
    setDialogueAutoDismissMs(undefined);
    setShowEnding(false);
    setClearElapsedMs(null);
    playStartedAtRef.current = performance.now();
    gameCanvasRef.current?.restart();
  }, [play]);

  /** 엔딩 슬라이드 뒤에 결과 요약 한 장을 덧붙인다 — `buildClearSummary` 참고. */
  const endingSlides = useMemo(
    () => [...ENDING_SLIDES, buildClearSummary(deathCount, clearElapsedMs)],
    [clearElapsedMs, deathCount],
  );

  return (
    <div className="page">
      {/* 타이틀 화면이 떠 있는 동안에는 페이지 헤더를 감춘다 — 같은 제목이 캔버스
          안팎에 두 번 보이면 지저분하다. DOM에서 빼지 않고 visibility로 숨기는 이유는
          자리를 그대로 차지하게 해서, 게임이 시작될 때 레이아웃이 튀지 않게 하기 위함이다. */}
      <header className={showTitle ? "page__header page__header--hidden" : "page__header"}>
        <h1 className="page__title">{GAME_TITLE}</h1>
        <p className="page__tagline">{GAME_TAGLINE}</p>
      </header>

      {/* .stage-area는 헤더·푸터를 뺀 남는 공간을 그대로 차지하는 **측정용** 영역이다.
          시각적 테두리인 .stage-frame은 콘텐츠를 감싸므로(margin: auto) 폭이 .stage를
          따라가는데, 그걸 재면 "프레임 폭 ← 스테이지 폭 ← 프레임 폭" 순환이 되어
          창을 넓혀도 캔버스가 커지지 않는다(실측 확인). */}
      <div className="stage-area">
        <div className="stage-frame">
          <div className="stage">
            <GameCanvas
              ref={gameCanvasRef}
              onDeathCountChange={handleDeathCountChange}
              onRoundChange={handleRoundChange}
              inputDisabled={dialogueQueue.length > 0 || showTitle || showOpening || showEnding}
              audioEngineRef={audioEngineRef}
            />
            <HUD round={round} deathCount={deathCount} />
            <div className="overlay-buttons">
              <MuteButton muted={muted} onToggle={toggleMute} />
              <RestartButton onRestart={handleRestart} />
            </div>
            <DialogueBox
              queue={dialogueQueue}
              onAdvance={handleDialogueAdvance}
              autoDismissMs={dialogueAutoDismissMs}
              playSound={play}
            />
            {showTitle && <TitleScreen onStart={handleTitleStart} playSound={play} />}
            {showOpening && <CutsceneSlide slides={OPENING_SLIDES} onFinish={handleOpeningFinish} playSound={play} />}
            {/* 엔딩은 결과 요약에서 멈춰 있는다(holdAtEnd) — 넘길 다음 화면이 없어서,
                사라지면 조작이 멈춘 게임 화면만 남는다. 다시 하려면 재시작 버튼을 쓴다. */}
            {showEnding && (
              <CutsceneSlide slides={endingSlides} onFinish={handleEndingFinish} holdAtEnd playSound={play} />
            )}
          </div>
        </div>
      </div>

      <p className="page__footer">
        <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> 이동 · <kbd>,</kbd> <kbd>.</kbd> 그림자 회전 ·{" "}
        <kbd>M</kbd> 소리
        <br />
        NHN NAN2026 AI 게임 개발 해커톤 사전과제 — 키보드 전용
      </p>

      {/* 개발 전용 — 스테이지 재생성이 필요한 값을 바꾸면 재시작으로 새 스테이지를 만든다.
          지연 로드라 Suspense가 필요한데, 로딩 중 보여줄 것이 없으므로 fallback은 null이다. */}
      {tuningEnabled && (
        <Suspense fallback={null}>
          <TuningPanel round={round} deathCount={deathCount} onRegenerate={handleRestart} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
