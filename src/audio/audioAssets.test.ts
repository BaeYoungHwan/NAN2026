import { afterEach, describe, expect, it, vi } from "vitest";
import { assetUrl, loadSfxBuffers } from "./audioAssets";
import { SFX, SFX_CUES } from "./soundCues";

/** decodeAudioData만 흉내내는 최소 AudioContext 스텁 — 실제 디코딩은 검증 대상이 아니다. */
function fakeContext(decode: (data: ArrayBuffer) => Promise<AudioBuffer>) {
  return { decodeAudioData: vi.fn(decode) } as unknown as BaseAudioContext;
}

const fakeBuffer = { duration: 1 } as AudioBuffer;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assetUrl", () => {
  it("BASE_URL 아래 assets/audio/ 경로를 만든다 — Pages 서브패스 배포에서도 맞아야 한다", () => {
    expect(assetUrl("sfx/death.wav")).toBe(`${import.meta.env.BASE_URL}assets/audio/sfx/death.wav`);
  });
});

describe("loadSfxBuffers", () => {
  it("모든 효과음 큐를 디코딩해 돌려준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    const ctx = fakeContext(async () => fakeBuffer);

    const buffers = await loadSfxBuffers(ctx);

    expect(Object.keys(buffers).sort()).toEqual([...SFX_CUES].sort());
    for (const cue of SFX_CUES) expect(buffers[cue]).toBe(fakeBuffer);
  });

  it("파일이 없으면(404) 그 큐만 null로 남기고 나머지는 정상 로드한다", async () => {
    const missing = SFX.death.file;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: !url.endsWith(missing),
        status: 404,
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    const ctx = fakeContext(async () => fakeBuffer);

    const buffers = await loadSfxBuffers(ctx);

    expect(buffers.death).toBeNull();
    expect(buffers.footstep).toBe(fakeBuffer);
  });

  it("에셋 폴더가 통째로 비어 있어도 예외를 던지지 않고 전부 null을 돌려준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("네트워크 없음"); }));
    const ctx = fakeContext(async () => fakeBuffer);

    const buffers = await loadSfxBuffers(ctx);

    for (const cue of SFX_CUES) expect(buffers[cue]).toBeNull();
  });

  it("디코딩이 실패해도(손상된 파일) 그 큐만 null이 된다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    const ctx = fakeContext(async () => {
      throw new Error("디코딩 불가");
    });

    const buffers = await loadSfxBuffers(ctx);

    for (const cue of SFX_CUES) expect(buffers[cue]).toBeNull();
  });
});
