import { BGM, SFX, SFX_CUES, type BgmCue, type SfxCue } from "./soundCues";

/**
 * 오디오 에셋 로더.
 *
 * `ui/backgroundArt.ts`와 같은 폴백 계약을 따른다 — 파일이 없거나 디코딩에 실패한
 * 큐만 `null`로 남기고 나머지는 정상 로드한다. 재생 측이 null을 조용히 무시하므로,
 * `public/assets/audio/`가 통째로 비어 있어도 게임은 무음으로 완전히 동작한다.
 * 배포본에서 에셋 누락이 게임을 멈추게 하지 않기 위한 설계다.
 */

/** `import.meta.env.BASE_URL`은 GitHub Pages 서브패스(`/NAN2026/`)를 포함한다 — 하드코딩하면 배포본에서 404가 난다. */
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/audio/`;

export type SfxBuffers = Record<SfxCue, AudioBuffer | null>;

/** 큐의 실제 요청 URL. BGM은 버퍼로 디코딩하지 않고 이 URL을 그대로 <audio>에 넘긴다. */
export function assetUrl(file: string): string {
  return ASSET_BASE + file;
}

export function bgmUrl(cue: BgmCue): string {
  return assetUrl(BGM[cue].file);
}

async function decodeSfx(ctx: BaseAudioContext, file: string): Promise<AudioBuffer> {
  const response = await fetch(assetUrl(file));
  if (!response.ok) throw new Error(`오디오 로드 실패(${response.status}): ${file}`);
  const encoded = await response.arrayBuffer();
  // decodeAudioData는 Safari 대응으로 콜백형만 지원하던 시절이 있었지만,
  // 대상 브라우저(Chrome/Edge/Firefox/최신 Safari)는 전부 Promise형을 지원한다.
  return await ctx.decodeAudioData(encoded);
}

/**
 * 효과음을 전부 AudioBuffer로 미리 디코딩한다 — 재생 시점에 디코딩하면 첫 재생이
 * 늦어 사망·경고음처럼 즉각적이어야 하는 소리가 밀린다.
 *
 * BGM은 여기서 다루지 않는다: 16~24초짜리를 통째로 메모리에 디코딩할 이유가 없고,
 * HTMLAudioElement로 스트리밍하면 해당 라운드에 진입할 때만 네트워크를 쓴다.
 */
export async function loadSfxBuffers(ctx: BaseAudioContext): Promise<SfxBuffers> {
  const entries = await Promise.all(
    SFX_CUES.map(async (cue) => {
      try {
        return [cue, await decodeSfx(ctx, SFX[cue].file)] as const;
      } catch {
        // 에셋이 아직 없는 것은 정상 상태다 — 경고를 남기지 않는다(빈 폴더로
        // 개발할 때 콘솔이 실패 로그로 가득 차면 진짜 오류를 놓친다).
        return [cue, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as SfxBuffers;
}
