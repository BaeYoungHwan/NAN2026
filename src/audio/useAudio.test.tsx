// @vitest-environment jsdom
import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAudio } from "./useAudio";

/**
 * AudioContext 스텁 — 실제 브라우저처럼 "이미 닫힌 컨텍스트를 다시 닫으면 거부"한다.
 * 이 동작이 있어야 StrictMode 이중 마운트에서 생기는 중복 close를 잡아낼 수 있다.
 */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  closeCount = 0;
  state: AudioContextState = "running";
  destination = {} as AudioDestinationNode;
  currentTime = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    return {
      gain: { value: 1, setTargetAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      playbackRate: { value: 1 },
      onended: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createMediaElementSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  async resume() {}
  close(): Promise<void> {
    this.closeCount++;
    if (this.state === "closed") {
      return Promise.reject(new DOMException("이미 닫힌 컨텍스트", "InvalidStateError"));
    }
    this.state = "closed";
    return Promise.resolve();
  }
}

function Probe() {
  useAudio();
  return null;
}

afterEach(() => {
  FakeAudioContext.instances = [];
  vi.unstubAllGlobals();
});

describe("useAudio 초기화", () => {
  it("StrictMode 이중 마운트에서 같은 AudioContext를 두 번 닫지 않는다", async () => {
    // 이 검증이 필요한 이유: StrictMode는 mount→cleanup→mount를 실행하는데, 첫 cleanup
    // 시점에는 효과음 디코딩이 아직 진행 중이다. 그 Promise가 나중에 resolve되면서
    // 이미 닫힌 컨텍스트를 다시 닫으면 거부되고, 처리하지 않으면 unhandled rejection이 된다.
    const rejections: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent) => rejections.push(event.reason);
    window.addEventListener("unhandledrejection", onRejection);

    vi.stubGlobal("AudioContext", FakeAudioContext);
    // 디코딩이 첫 cleanup보다 늦게 끝나도록 한 틱 미룬다 — 실제 네트워크·디코딩 상황과 같다.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await Promise.resolve();
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
      }),
    );

    const { unmount } = render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );

    await waitFor(() => expect(FakeAudioContext.instances.length).toBeGreaterThan(0));
    unmount();
    // 남아있는 Promise 체인이 전부 정리될 시간을 준다.
    await new Promise((resolve) => setTimeout(resolve, 10));

    for (const instance of FakeAudioContext.instances) {
      expect(instance.closeCount).toBeLessThanOrEqual(1);
    }
    expect(rejections).toEqual([]);

    window.removeEventListener("unhandledrejection", onRejection);
  });

  it("WebAudio를 못 쓰는 환경에서도 렌더가 실패하지 않는다 — 무음으로 진행해야 한다", () => {
    vi.stubGlobal("AudioContext", function () {
      throw new Error("AudioContext 미지원");
    });

    expect(() => render(<Probe />)).not.toThrow();
  });

  it("언마운트 시 컨텍스트를 닫는다 — 페이지를 떠난 뒤 오디오 자원이 남지 않아야 한다", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));

    const { unmount } = render(<Probe />);
    await waitFor(() => expect(FakeAudioContext.instances.length).toBe(1));
    unmount();

    expect(FakeAudioContext.instances[0].state).toBe("closed");
  });
});
