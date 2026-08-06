import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { SfxCue } from "../audio/soundCues";

const PORTRAIT_SRC = `${import.meta.env.BASE_URL}assets/characters/reaper-portrait-neutral.png`;

// 초상 표시 폭 + 박스 오른쪽 안쪽 오프셋 — portraitStyle.width와 boxStyle의 오른쪽
// padding이 이 두 값에서 각각 파생된다(아래 두 스타일 선언 참고). 하나로 묶어서
// 값이 어긋나 텍스트가 초상 밑에 깔리는 회귀를 구조적으로 막는다(PR #23 리뷰).
//
// 고정 180px이 아니라 clamp()인 이유 — `.stage`(src/index.css)가 남는 공간에 맞춰
// CSS로 축소되면 이 박스(width:80%)도 함께 좁아지고, 하한인 320px까지 줄어들 수
// 있다. 고정 180px 초상이면 그때 텍스트 컬럼이 108px(16px 폰트 기준 한 줄 6~7자)
// 까지 밀려 가독성이 무너진다. 박스 폭의 40%를 기준으로 두면 박스가 넓을 때
// (480px 근방)는 180px 상한에 걸려 기존과 동일하게 보이고, 좁아질수록 초상도 같이
// 줄어 텍스트 폭을 어느 정도 지켜준다(320px 기준 초상 128px → 텍스트 컬럼 160px,
// 108px보다 훨씬 낫다) (PR #23 리뷰).
const PORTRAIT_WIDTH_CSS = "clamp(120px, 40%, 180px)";
const PORTRAIT_RIGHT_OFFSET_PX = 8;
// 원본 크롭 좌표(scripts/crop-reaper.mjs REGIONS[0].w/h = 122/118)와 짝을 이루는
// aspectRatio — 크롭 좌표를 바꾸면 이 값도 함께 고쳐야 한다.
const PORTRAIT_ASPECT_RATIO = "122 / 118";

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
  // backgroundArt.ts/tileArt.ts와 같은 "에셋 없어도 정상 동작" 계약 — 초상 PNG가
  // 404거나 손상됐으면 깨진 이미지 아이콘 대신 조용히 숨긴다(PR #23 리뷰).
  const [portraitFailed, setPortraitFailed] = useState(false);

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

  const handleAdvanceClick = () => {
    playSound?.("dialogueAdvance");
    onAdvance();
  };

  return (
    <div style={overlayStyle}>
      <div style={boxStyle} onClick={handleAdvanceClick}>
        <p style={nameStyle}>저승사자</p>
        <p style={lineStyle}>{currentLine}</p>
        {autoDismissMs === undefined && <p style={hintStyle}>클릭 또는 Enter/Space로 계속</p>}
        {/* 초상이 박스 위 테두리를 뚫고 튀어나온 부분은 box의 레이아웃 박스 밖이라,
            portraitStyle에 pointerEvents:none을 주면 그 부분 클릭이 캔버스로 그냥
            통과해버린다(PR #23 리뷰) — pointerEvents를 기본값(auto)으로 둬서 클릭이
            img에서 시작하되, DOM상 box의 자식이므로 버블링으로 box의 onClick까지
            그대로 이어지게 한다(별도 onClick을 달면 버블링과 겹쳐 두 번 호출된다). */}
        {!portraitFailed && (
          <img
            src={PORTRAIT_SRC}
            alt=""
            data-testid="reaper-portrait"
            style={portraitStyle}
            onError={() => setPortraitFailed(true)}
          />
        )}
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
// 중 기본(평상시) 표정 칸을 크롭한 것(scripts/crop-reaper.mjs). 초상을 박스 레이아웃
// 흐름 밖으로 빼서(position: absolute) 박스 오른쪽 위 테두리를 뚫고 튀어나오게
// 배치한다 — 박스 자체 높이는 텍스트로만 결정되고(portrait가 flex/grid 흐름에
// 안 끼므로 텍스트 줄 수 이상으로 box를 늘리지 않는다), 초상은 박스 폭에 비례해
// (PORTRAIT_WIDTH_CSS) 크기가 정해진다. bottom을 박스 안쪽에 걸어 "박스 위에 서
// 있는" 느낌을 준다.
const portraitStyle: CSSProperties = {
  position: "absolute",
  right: PORTRAIT_RIGHT_OFFSET_PX,
  bottom: 0,
  width: PORTRAIT_WIDTH_CSS,
  aspectRatio: PORTRAIT_ASPECT_RATIO,
  objectFit: "contain",
  pointerEvents: "auto", // 기본값과 같지만, 위 주석의 "왜 auto여야 하는지"를 명시하려고 적어둔다.
  cursor: "pointer",
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
  // 좁은 화면(캔버스 축소 렌더링 등)에서 콘텐츠 폭이 0 이하로 밀리는 것을 막는
  // 최소 안전장치(PR #23 리뷰) — PORTRAIT_WIDTH_CSS가 반응형이라도, 박스 자체가
  // 극단적으로 좁아지는 경우에 대한 마지막 방어선으로 유지한다.
  minWidth: 320,
  // 오른쪽에 튀어나온 초상과 텍스트가 겹치지 않도록 텍스트 쪽만 오른쪽 여백을 크게
  // 둔다 — 초상 폭(PORTRAIT_WIDTH_CSS)과 같은 식을 재사용한다. 겹칠 여지가 없는
  // 이유: CSS 스펙상 padding의 %는 이 요소의 부모(overlayStyle) 너비를 기준으로
  // 계산되고, portraitStyle.width의 %는 box 자신의 렌더링된 너비를 기준으로
  // 계산된다 — 서로 다른 기준값이지만, box 너비는 항상 부모 너비 이하이고
  // clamp()는 입력에 대해 단조증가이므로 "부모 기준 40%"는 항상 "box 기준 40%"
  // 이상이 된다. 즉 이 padding은 항상 실제 필요한 최소치보다 넉넉하게 계산된다
  // (box가 minWidth/maxWidth에 걸려 부모의 정확히 80%가 아닐 때는 더 넉넉해짐) —
  // 손해는 텍스트 컬럼이 이론상 최소치보다 살짝 좁아지는 정도뿐, 겹침은
  // 구조적으로 불가능하다(PR #23 리뷰).
  padding: `12px calc(${PORTRAIT_WIDTH_CSS} + ${PORTRAIT_RIGHT_OFFSET_PX + 8}px) 12px 16px`,
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
