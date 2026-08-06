// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InputState } from "./input";
import { useKeyboardInput } from "./input";

afterEach(cleanup);

/** 훅을 마운트하고 현재 입력 상태를 읽을 수 있는 getter를 돌려준다. */
function mountInput(): () => InputState {
  let ref: { current: InputState } | null = null;

  function Probe() {
    ref = useKeyboardInput();
    return null;
  }

  render(<Probe />);
  return () => {
    if (!ref) throw new Error("훅이 마운트되지 않았다");
    return ref.current;
  };
}

/** 실제 브라우저처럼 code와 key를 함께 실은 키 이벤트를 창에 보낸다. */
function sendKey(type: "keydown" | "keyup", code: string, key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true }));
  });
}

describe("useKeyboardInput", () => {
  it("WASD와 화살표 키로 이동 입력이 켜지고, 떼면 꺼진다", () => {
    const input = mountInput();

    sendKey("keydown", "KeyW", "w");
    expect(input().up).toBe(true);
    sendKey("keyup", "KeyW", "w");
    expect(input().up).toBe(false);

    sendKey("keydown", "ArrowRight", "ArrowRight");
    expect(input().right).toBe(true);
  });

  it(", 와 . 로 그림자 회전 입력이 켜진다", () => {
    const input = mountInput();

    sendKey("keydown", "Comma", ",");
    sendKey("keydown", "Period", ".");
    expect(input().rotateCW).toBe(true);
    expect(input().rotateCCW).toBe(true);
  });

  // event.key로 매핑하던 시절의 실제 증상: Caps Lock이 켜져 있으면 이동이 통째로
  // 무시되는데 회전은 살아 있어, 제자리에 묶인 채 안전 구역이 흘러가며 죽는다.
  it("Caps Lock/Shift로 대문자가 들어와도 이동한다 (물리 키 위치 기준)", () => {
    const input = mountInput();

    sendKey("keydown", "KeyW", "W");
    sendKey("keydown", "KeyD", "D");
    expect(input().up).toBe(true);
    expect(input().right).toBe(true);
  });

  it("한글 입력 상태(key가 'ㅈ')에서도 이동한다", () => {
    const input = mountInput();

    sendKey("keydown", "KeyW", "ㅈ");
    expect(input().up).toBe(true);
  });

  // keyup이 다른 창으로 가버리면 눌린 상태가 영영 풀리지 않아, 손을 뗀 뒤에도
  // 그림자가 계속 돌아 죽는다.
  it("창 포커스를 잃으면 눌려 있던 키가 전부 풀린다", () => {
    const input = mountInput();

    sendKey("keydown", "Period", ".");
    sendKey("keydown", "KeyD", "d");
    expect(input().rotateCCW).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(input().rotateCCW).toBe(false);
    expect(input().right).toBe(false);
  });

  it("탭이 숨겨지면 눌려 있던 키가 전부 풀린다", () => {
    const input = mountInput();

    sendKey("keydown", "Comma", ",");
    expect(input().rotateCW).toBe(true);

    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    hidden.mockRestore();

    expect(input().rotateCW).toBe(false);
  });

  it("탭이 다시 보이는 이벤트로는 입력을 건드리지 않는다", () => {
    const input = mountInput();

    sendKey("keydown", "KeyA", "a");
    act(() => {
      // document.hidden 기본값은 false — 다시 보이게 된 상황이다.
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(input().left).toBe(true);
  });
});
