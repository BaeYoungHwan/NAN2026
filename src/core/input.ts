import { useEffect, useRef } from "react";
import type { MoveInput } from "../entities/character";

const KEY_MAP: Record<string, keyof MoveInput> = {
  w: "up",
  ArrowUp: "up",
  s: "down",
  ArrowDown: "down",
  a: "left",
  ArrowLeft: "left",
  d: "right",
  ArrowRight: "right",
};

/**
 * WASD/방향키 입력을 추적하는 훅. 렌더를 유발하지 않도록 ref로 보관하고,
 * 게임 루프(requestAnimationFrame)가 매 프레임 직접 읽는다.
 */
export function useKeyboardInput() {
  const inputRef = useRef<MoveInput>({ up: false, down: false, left: false, right: false });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_MAP[event.key];
      if (direction) inputRef.current[direction] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const direction = KEY_MAP[event.key];
      if (direction) inputRef.current[direction] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return inputRef;
}
