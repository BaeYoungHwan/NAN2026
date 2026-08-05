import { useEffect } from "react";
import type { CSSProperties } from "react";
import type { SfxCue } from "../audio/soundCues";

const PORTRAIT_SRC = `${import.meta.env.BASE_URL}assets/characters/reaper-portrait-neutral.png`;

interface DialogueBoxProps {
  /** 표시할 대사 큐 — 비어있으면 렌더링하지 않는다. */
  queue: readonly string[];
  /** 현재 줄을 넘길 때 호출된다 (클릭·Enter/Space 키, 또는 자동 사라짐 타이머). */
  onAdvance: () => void;
  /** 지정 시 클릭/키 입력 없이도 이 시간(ms) 후 자동으로 다음 줄로 넘어간다 (예: 사망 재촉 대사). */
  autoDismissMs?: number;
  /** 효과음 재생 — 없으면 조용히 동작한다(오디오 없이도 완전히 기능해야 한다). */
  playSound?: (cue: SfxCue) => void;
}

/**
 * 저승사자 대사 박스 (PRD §7-2) — 애니메이션·음성 없는 텍스트 전용 UI.
 * 큐에 대사가 있는 동안 게임 입력을 막아야 하므로, 호출부(App)가 큐 상태로
 * GameCanvas의 inputDisabled를 함께 제어한다.
 */
function DialogueBox({ queue, onAdvance, autoDismissMs, playSound }: DialogueBoxProps) {
  const currentLine = queue[0];

  // 새 대사가 뜰 때마다 등장음을 낸다. 넘김음(dialogueAdvance)과 달리 자동 사라짐으로
  // 넘어간 다음 줄에도 울려야 하므로, 조작 핸들러가 아니라 표시 자체에 묶는다.
  useEffect(() => {
    if (currentLine) playSound?.("dialogueOpen");
  }, [currentLine, playSound]);

  useEffect(() => {
    if (!currentLine) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        // 넘김음은 플레이어가 직접 넘긴 경우에만 낸다 — 자동 사라짐 타이머로 넘어갈
        // 때까지 소리가 나면 조작하지도 않은 피드백이 들린다.
        playSound?.("dialogueAdvance");
        onAdvance();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentLine, onAdvance, playSound]);

  useEffect(() => {
    if (!currentLine || autoDismissMs === undefined) return;

    const timer = setTimeout(onAdvance, autoDismissMs);
    return () => clearTimeout(timer);
  }, [currentLine, autoDismissMs, onAdvance]);

  if (!currentLine) return null;

  return (
    <div style={overlayStyle}>
      <div
        style={boxStyle}
        onClick={() => {
          playSound?.("dialogueAdvance");
          onAdvance();
        }}
      >
        <p style={nameStyle}>저승사자</p>
        <p style={lineStyle}>{currentLine}</p>
        {autoDismissMs === undefined && <p style={hintStyle}>클릭 또는 Enter/Space로 계속</p>}
        <img src={PORTRAIT_SRC} alt="" style={portraitStyle} />
      </div>
    </div>
  );
}

/** 이 div 자체는 클릭을 받지 않는다(pointerEvents: none) — 화면 전체를 덮는 wrapper가
 * RestartButton 등 다른 절대 위치 UI의 클릭을 가로채지 않도록, 실제 클릭 캡처는
 * boxStyle에만 건다. */
const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  paddingBottom: 32,
  pointerEvents: "none",
};

// 대화 박스 안, 오른쪽 끝에 배치하는 저승사자 초상 — 시트의 "표정/반응 예시" 그리드
// 중 기본(평상시) 표정 칸을 크롭한 것(scripts/crop-reaper.mjs). 박스 높이(세로 크기)는
// 텍스트 기준 그대로 유지하면서 초상 크기도 그대로 키우고 싶다는 요구라, 메이플스토리류
// NPC 대화창처럼 초상을 박스 레이아웃 흐름 밖으로 빼서(position: absolute) 박스
// 오른쪽 위 테두리를 뚫고 튀어나오게 배치한다 — 박스 자체 높이는 텍스트만으로 결정되고
// (portrait가 flex/grid 흐름에 안 끼므로 box를 늘리지 않는다), 초상은 원하는 크기(180px)
// 그대로 유지된다. bottom을 박스 안쪽에 걸어 "박스 위에 서 있는" 느낌을 준다.
const portraitStyle: CSSProperties = {
  position: "absolute",
  right: 8,
  bottom: 0,
  width: 180,
  aspectRatio: "122 / 118",
  objectFit: "contain",
  pointerEvents: "none",
  filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5))",
};

const boxStyle: CSSProperties = {
  position: "relative",
  // boxSizing 없이 content-box(기본값)였을 때는 padding이 width/maxWidth 위에 그대로
  // 더해져서, 오른쪽 padding을 키우자 박스 전체 가로 크기가 그만큼 커져 버렸다 —
  // border-box로 바꿔 width/maxWidth가 padding 포함 "전체" 크기를 뜻하게 고정한다.
  boxSizing: "border-box",
  width: "80%",
  maxWidth: 480,
  // 오른쪽에 튀어나온 초상과 텍스트가 겹치지 않도록 텍스트 쪽만 오른쪽 여백을 크게 둔다 —
  // 초상 폭(180) + 오른쪽 오프셋(8) = 188px보다 넉넉하게 커야 한다(196으로 여유 8px 추가).
  padding: "12px 196px 12px 16px",
  background: "rgba(20, 20, 20, 0.92)",
  border: "1px solid #666",
  borderRadius: 8,
  color: "#eee",
  fontFamily: "sans-serif",
  pointerEvents: "auto",
  cursor: "pointer",
};

const nameStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#f5d547",
  fontWeight: "bold",
};

const lineStyle: CSSProperties = {
  margin: "6px 0",
  fontSize: 16,
  lineHeight: 1.4,
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "#999",
  textAlign: "right",
};

export default DialogueBox;
