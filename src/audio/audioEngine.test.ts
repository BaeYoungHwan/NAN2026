import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./audioEngine";
import type { SfxBuffers } from "./audioAssets";
import { SFX_CUES } from "./soundCues";

// WebAudio는 node 환경에 없으므로, 엔진이 실제로 호출하는 노드만 흉내내는 스텁을 쓴다.
// 검증 대상은 재생 정책(쿨다운·루프 중복 방지·뮤트·크로스페이드)이지 오디오 출력이 아니다.

function fakeGain() {
  return {
    gain: { value: 1, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function fakeSource() {
  return {
    buffer: null as AudioBuffer | null,
    loop: false,
    playbackRate: { value: 1 },
    onended: null as (() => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function fakeContext() {
  const sources: ReturnType<typeof fakeSource>[] = [];
  const gains: ReturnType<typeof fakeGain>[] = [];
  const context = {
    currentTime: 0,
    state: "running" as AudioContextState,
    destination: {} as AudioDestinationNode,
    createGain: vi.fn(() => {
      const gain = fakeGain();
      gains.push(gain);
      return gain;
    }),
    createBufferSource: vi.fn(() => {
      const source = fakeSource();
      sources.push(source);
      return source;
    }),
    decodeAudioData: vi.fn(async () => bgmBuffer),
    resume: vi.fn(async () => {}),
  };
  return { context, sources, gains };
}

/** playBgm의 디코딩 Promise 체인(fetch → arrayBuffer → decodeAudioData → then)이 다 풀리게 한다. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const buffer = { duration: 1 } as AudioBuffer;
const bgmBuffer = { duration: 16 } as AudioBuffer;

/** 모든 큐가 로드된 상태. */
function allBuffers(): SfxBuffers {
  return Object.fromEntries(SFX_CUES.map((cue) => [cue, buffer])) as SfxBuffers;
}

/** 에셋이 하나도 없는 상태 — 게임이 무음으로 동작해야 하는 조건. */
function noBuffers(): SfxBuffers {
  return Object.fromEntries(SFX_CUES.map((cue) => [cue, null])) as SfxBuffers;
}

describe("AudioEngine 효과음 재생", () => {
  let clock = 0;
  const now = () => clock;

  beforeEach(() => {
    clock = 0;
  });

  it("에셋이 없으면 재생을 시도하지 않는다 — 무음으로 정상 동작해야 한다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: noBuffers(), now });

    engine.play("death");
    engine.startLoop("rotateLoop");

    expect(sources).toHaveLength(0);
  });

  it("버퍼가 있으면 소스를 만들어 재생한다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers(), now });

    engine.play("death");

    expect(sources).toHaveLength(1);
    expect(sources[0].start).toHaveBeenCalled();
    expect(sources[0].buffer).toBe(buffer);
  });

  it("쿨다운 안에 다시 요청하면 무시한다 — 벽 충돌이 매 프레임 발생해도 도배되지 않는다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers(), now });

    engine.play("wallBump"); // minIntervalMs = 260
    clock = 100;
    engine.play("wallBump");
    clock = 200;
    engine.play("wallBump");

    expect(sources).toHaveLength(1);
  });

  it("쿨다운이 지나면 다시 재생한다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers(), now });

    engine.play("wallBump");
    clock = 300;
    engine.play("wallBump");

    expect(sources).toHaveLength(2);
  });

  it("쿨다운은 큐마다 따로 관리된다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers(), now });

    engine.play("wallBump");
    engine.play("footstep");

    expect(sources).toHaveLength(2);
  });

  it("volumeScale이 큐 기본 음량에 곱해진다", () => {
    const { context, gains } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers(), now });

    engine.play("lightSwitch", { volumeScale: 0.5 }); // 기본 0.5

    // 앞의 3개는 master/sfxBus/bgmBus, 그 다음이 이번 재생의 cueGain이다.
    const cueGain = gains[gains.length - 1];
    expect(cueGain.gain.value).toBeCloseTo(0.25);
  });

  it("pitchJitter가 설정된 큐는 재생 속도를 흔든다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers(), now });

    engine.play("footstep"); // pitchJitter = 0.08

    expect(sources[0].playbackRate.value).toBeGreaterThanOrEqual(0.92);
    expect(sources[0].playbackRate.value).toBeLessThanOrEqual(1.08);
  });

  it("재생이 끝나면 노드를 그래프에서 끊는다 — 발소리처럼 잦은 소리가 쌓이지 않아야 한다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers(), now });

    engine.play("footstep");
    sources[0].onended?.();

    expect(sources[0].disconnect).toHaveBeenCalled();
  });
});

describe("AudioEngine 루프 재생", () => {
  it("이미 재생 중이면 중복해서 시작하지 않는다 — 회전키를 누르는 동안 매 프레임 호출된다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    engine.startLoop("rotateLoop");
    engine.startLoop("rotateLoop");
    engine.startLoop("rotateLoop");

    expect(sources).toHaveLength(1);
    expect(sources[0].loop).toBe(true);
    expect(engine.isLooping("rotateLoop")).toBe(true);
  });

  it("멈추면 소스를 정지시키고 루프 상태를 해제한다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    engine.startLoop("rotateLoop");
    engine.stopLoop("rotateLoop");

    expect(sources[0].stop).toHaveBeenCalled();
    expect(engine.isLooping("rotateLoop")).toBe(false);
  });

  it("재생 중이 아닐 때 멈춰도 오류가 나지 않는다", () => {
    const { context } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    expect(() => engine.stopLoop("rotateLoop")).not.toThrow();
  });

  it("멈춘 뒤 다시 시작할 수 있다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    engine.startLoop("rotateLoop");
    engine.stopLoop("rotateLoop");
    engine.startLoop("rotateLoop");

    expect(sources).toHaveLength(2);
  });
});

describe("AudioEngine BGM", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(fetchImpl?: (url: string) => Promise<unknown>) {
    const fetchMock = vi.fn(fetchImpl ?? (async (_url: string) => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("같은 곡을 다시 요청하면 무시한다 — 매 프레임 호출해도 재시작되지 않아야 한다", async () => {
    stubFetch();
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    engine.playBgm("round1");
    engine.playBgm("round1"); // 디코딩 중 재요청 — pendingBgmCue로 무시돼야 한다
    await flush();
    engine.playBgm("round1"); // 재생 중 재요청
    await flush();

    expect(sources).toHaveLength(1);
    expect(sources[0].start).toHaveBeenCalledTimes(1);
  });

  it("다른 곡으로 바꾸면 새 소스를 만들어 크로스페이드한다", async () => {
    const fetchMock = stubFetch();
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    engine.playBgm("round1");
    await flush();
    engine.playBgm("round2");
    await flush();

    expect(sources).toHaveLength(2);
    expect(fetchMock.mock.calls[1][0]).toContain("round2");
    // 이전 곡은 새 곡이 시작되며 페이드아웃되어 멈춘다.
    expect(sources[0].stop).toHaveBeenCalled();
  });

  it("컷신 곡은 루프하지 않고 라운드 곡은 루프한다", async () => {
    stubFetch();
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    engine.playBgm("opening");
    await flush();
    engine.playBgm("round1");
    await flush();

    expect(sources[0].loop).toBe(false);
    expect(sources[1].loop).toBe(true);
  });

  it("파일이 없어 디코딩이 실패해도 예외가 새어나오지 않는다", async () => {
    stubFetch(async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(8) }));
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    expect(() => engine.playBgm("round1")).not.toThrow();
    await flush();

    expect(sources).toHaveLength(0);
  });
});

describe("AudioEngine 뮤트", () => {
  it("초기 뮤트 상태로 만들면 마스터 음량이 0이다", () => {
    const { context, gains } = fakeContext();
    new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers(), muted: true });

    expect(gains[0].gain.value).toBe(0);
  });

  it("뮤트를 켜고 끄면 마스터 음량을 램프로 바꾼다 — 즉시 대입하면 딸깍거린다", () => {
    const { context, gains } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);
    expect(gains[0].gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, expect.any(Number));

    engine.setMuted(false);
    expect(engine.isMuted()).toBe(false);
    expect(gains[0].gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, expect.any(Number));
  });
});

describe("AudioEngine 정리", () => {
  it("dispose 후에는 재생 요청을 무시한다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    engine.dispose();
    engine.play("death");
    engine.startLoop("rotateLoop");

    expect(sources).toHaveLength(0);
  });

  it("dispose는 재생 중인 루프를 멈춘다", () => {
    const { context, sources } = fakeContext();
    const engine = new AudioEngine({ context: context as unknown as AudioContext, buffers: allBuffers() });

    engine.startLoop("rotateLoop");
    engine.dispose();

    expect(sources[0].stop).toHaveBeenCalled();
  });
});
