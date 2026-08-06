import { useEffect, useRef } from "react";

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** ',' — 그림자 시계방향 회전 */
  rotateCW: boolean;
  /** '.' — 그림자 반시계방향 회전 */
  rotateCCW: boolean;
}

/**
 * `event.key`(입력된 문자)가 아니라 `event.code`(물리 키 위치)로 매핑한다 —
 * `audio/useAudio.ts`의 M 키와 같은 이유다.
 *
 * `event.key`를 쓰면 소문자 `w`/`a`/`s`/`d`만 매칭되므로, **Caps Lock이 켜져 있거나
 * Shift를 누르고 있으면 `"W"`가 들어와 이동 입력이 통째로 무시된다** — 회전(`,`/`.`)은
 * 그대로 동작하기 때문에 플레이어는 제자리에 묶인 채 안전 구역이 흘러가는 것을 보며
 * 죽는다. 한글 입력 상태(`"ㅈ"`)에서도 같은 문제가 생긴다. 키 위치로 받으면 둘 다
 * 구조적으로 사라진다.
 *
 * 대가로 `code`는 US 배열 기준 물리 위치라 AZERTY 등에서는 각인된 글자와 다른 키가
 * 잡힌다 — 다만 WASD는 원래 "왼손 아래 사각형"이라는 위치 규약이고, 각인대로 치고
 * 싶은 배열에서는 화살표 키가 그대로 남아 있다.
 */
const KEY_MAP: Record<string, keyof InputState> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Comma: "rotateCW",
  Period: "rotateCCW",
};

/**
 * WASD(이동) + , . (그림자 회전) 입력을 추적하는 훅. 렌더를 유발하지
 * 않도록 ref로 보관하고, 게임 루프(requestAnimationFrame)가 매 프레임 직접 읽는다.
 */
export function useKeyboardInput() {
  const inputRef = useRef<InputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    rotateCW: false,
    rotateCCW: false,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = KEY_MAP[event.code];
      if (key) inputRef.current[key] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = KEY_MAP[event.code];
      if (key) inputRef.current[key] = false;
    };

    // 포커스가 창 밖으로 나가면 눌린 키가 전부 풀린 것으로 친다.
    //
    // 누른 상태로 주소창을 클릭하거나 alt-tab 하면 `keyup`이 다른 곳으로 전달되어
    // 이쪽에 영영 오지 않는다 — 그러면 예를 들어 `rotateCCW`가 true로 **고정**되고,
    // 창이 백그라운드로 내려간 게 아닌 한 rAF는 계속 돌기 때문에 손을 뗀 뒤에도
    // 그림자가 초당 180도로 계속 돌아 죽는다(회전 루프음도 멈추지 않는다).
    // 벽에 붙어 이동키를 누르고 있었다면 `wallBump` 효과음이 끝없이 난다.
    const releaseAll = () => {
      const state = inputRef.current;
      for (const field of Object.keys(state) as Array<keyof InputState>) {
        state[field] = false;
      }
    };

    // 탭 전환은 blur 없이 visibilitychange만 오는 경우가 있어 둘 다 듣는다.
    const handleVisibilityChange = () => {
      if (document.hidden) releaseAll();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return inputRef;
}
