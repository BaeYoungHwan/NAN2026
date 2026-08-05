import type { SfxBuffers } from "./audioAssets";
import { decodeAudioFile } from "./audioAssets";
import { BGM, SFX, type BgmCue, type SfxCue } from "./soundCues";

/**
 * 오디오 재생 엔진 — 믹서 그래프와 재생 정책(쿨다운·루프·크로스페이드·뮤트)을 담당한다.
 *
 * 믹서는 3단이다:
 *   source → cueGain → busGain(sfx | bgm) → masterGain → destination
 * 뮤트는 masterGain을 0으로 내리는 것이고, 위험 시 BGM을 낮추는 덕킹은 bgmBus만
 * 건드린다 — 어느 쪽도 개별 소리의 음량 설정을 훼손하지 않는다.
 *
 * 모든 음량 변화는 `setTargetAtTime`으로 램프한다. 값을 즉시 대입하면 파형이 수직으로
 * 끊겨 딸깍거린다.
 *
 * 에셋이 없을 때(버퍼가 null) 모든 재생 요청은 조용히 무시된다 — 게임은 무음으로
 * 완전히 동작해야 한다(`audioAssets.ts` 폴백 계약).
 */

/** 음량 램프 시간 상수(초) — setTargetAtTime의 시정수. 짧을수록 즉각적이지만 클릭 위험이 커진다. */
const VOLUME_RAMP = 0.015;
/** BGM 크로스페이드 시정수(초) — 라운드 전환이 자연스럽게 넘어가도록 길게 잡는다. */
const BGM_FADE = 0.8;
/** 루프 효과음을 멈출 때 페이드아웃에 쓰는 시간(초). */
const LOOP_STOP_FADE = 0.06;

export interface AudioEngineOptions {
  context: AudioContext;
  buffers: SfxBuffers;
  muted?: boolean;
  /** 테스트에서 시간을 고정하기 위한 주입 지점. 기본은 performance.now(). */
  now?: () => number;
}

interface ActiveLoop {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

interface ActiveBgm {
  cue: BgmCue;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class AudioEngine {
  private readonly context: AudioContext;
  private readonly buffers: SfxBuffers;
  private readonly now: () => number;

  private readonly masterGain: GainNode;
  private readonly sfxBus: GainNode;
  private readonly bgmBus: GainNode;

  private readonly lastPlayedAt = new Map<SfxCue, number>();
  private readonly activeLoops = new Map<SfxCue, ActiveLoop>();
  private readonly bgmBufferCache = new Map<BgmCue, AudioBuffer>();
  private activeBgm: ActiveBgm | null = null;
  /** 디코딩 중인 BGM 요청 큐 — 끝나기 전에 dispose되거나 다른 곡이 요청되면 결과를 버린다. */
  private pendingBgmCue: BgmCue | null = null;
  private muted: boolean;
  private disposed = false;

  constructor({ context, buffers, muted = false, now }: AudioEngineOptions) {
    this.context = context;
    this.buffers = buffers;
    this.now = now ?? (() => performance.now());
    this.muted = muted;

    this.masterGain = context.createGain();
    this.masterGain.gain.value = muted ? 0 : 1;
    this.masterGain.connect(context.destination);

    this.sfxBus = context.createGain();
    this.sfxBus.connect(this.masterGain);

    this.bgmBus = context.createGain();
    this.bgmBus.connect(this.masterGain);
  }

  /**
   * 단발성 효과음 재생. `volumeScale`은 큐 기본 음량에 곱해진다(위험 경고음처럼
   * 상황에 따라 세기가 달라지는 소리에 쓴다).
   */
  play(cue: SfxCue, { volumeScale = 1 }: { volumeScale?: number } = {}): void {
    if (this.disposed) return;
    const buffer = this.buffers[cue];
    if (!buffer) return; // 에셋 없음 — 무음으로 동작

    const config = SFX[cue];
    const currentTime = this.now();
    const minInterval = config.minIntervalMs ?? 0;
    const lastPlayed = this.lastPlayedAt.get(cue);
    // 쿨다운 — 벽 충돌·발소리처럼 매 프레임 발생할 수 있는 이벤트가 소리를 도배하는 것을 막는다.
    if (lastPlayed !== undefined && currentTime - lastPlayed < minInterval) return;
    this.lastPlayedAt.set(cue, currentTime);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    if (config.pitchJitter) {
      source.playbackRate.value = 1 + (Math.random() * 2 - 1) * config.pitchJitter;
    }

    const gain = this.context.createGain();
    gain.gain.value = config.volume * volumeScale;

    source.connect(gain);
    gain.connect(this.sfxBus);
    // 재생이 끝난 노드를 끊지 않으면 그래프에 계속 쌓인다(발소리는 분당 수백 개가 생긴다).
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }

  /** 키를 누르고 있는 동안 이어지는 루프 재생을 시작한다 — 이미 재생 중이면 아무 일도 하지 않는다. */
  startLoop(cue: SfxCue): void {
    if (this.disposed || this.activeLoops.has(cue)) return;
    const buffer = this.buffers[cue];
    if (!buffer) return;

    const config = SFX[cue];
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.context.createGain();
    // 0에서 시작해 램프로 올린다 — 루프 시작 순간의 클릭을 없앤다.
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(config.volume, this.context.currentTime, VOLUME_RAMP);

    source.connect(gain);
    gain.connect(this.sfxBus);
    source.start();

    this.activeLoops.set(cue, { source, gain });
  }

  /** 루프 재생을 멈춘다. 즉시 끊지 않고 짧게 페이드아웃한다. */
  stopLoop(cue: SfxCue): void {
    const active = this.activeLoops.get(cue);
    if (!active) return;
    this.activeLoops.delete(cue);

    const stopAt = this.context.currentTime + LOOP_STOP_FADE;
    active.gain.gain.setTargetAtTime(0, this.context.currentTime, LOOP_STOP_FADE / 3);
    active.source.stop(stopAt);
    active.source.onended = () => {
      active.source.disconnect();
      active.gain.disconnect();
    };
  }

  /** 현재 그 큐가 루프 재생 중인지 — 호출부가 상태를 따로 들고 있지 않아도 되게 한다. */
  isLooping(cue: SfxCue): boolean {
    return this.activeLoops.has(cue);
  }

  /**
   * BGM을 전환한다. 이미 같은 곡이 재생 중이거나 로딩 중이면 아무 일도 하지 않으므로,
   * 매 프레임 호출해도 안전하다. 다른 곡이 재생 중이면 크로스페이드로 넘어간다.
   *
   * `<audio>` + `loop`가 아니라 디코딩한 버퍼를 `AudioBufferSourceNode.loop`로 재생한다.
   * HTMLMediaElement의 네이티브 루프는 파형이 완전히 이어져 있어도 재생을 재시작하는
   * 과정에서 미세하게 끊긴다 — 라운드 BGM처럼 16초 안팎으로 짧게 도는 트랙에서는 이
   * 끊김이 매 바퀴 "치직" 소리로 들릴 만큼 두드러진다. AudioBufferSourceNode는 같은
   * 오디오 그래프 안에서 샘플 단위로 이어 재생하므로 이 문제가 없다.
   */
  playBgm(cue: BgmCue): void {
    if (this.disposed || this.activeBgm?.cue === cue || this.pendingBgmCue === cue) return;
    this.pendingBgmCue = cue;

    this.loadBgmBuffer(cue)
      .then((buffer) => {
        // 디코딩하는 동안 dispose됐거나 다른 곡이 다시 요청됐으면 이 결과는 버린다.
        if (this.disposed || this.pendingBgmCue !== cue) return;
        this.pendingBgmCue = null;
        this.startBgm(cue, buffer);
      })
      .catch(() => {
        // 파일이 없거나 디코딩이 실패해도 무음으로 넘어간다(에셋 폴백 계약).
        if (this.pendingBgmCue === cue) this.pendingBgmCue = null;
      });
  }

  /** BGM 버퍼는 처음 요청될 때만 디코딩해 캐시한다 — 안 쓰는 라운드 곡까지 미리 받지 않는다. */
  private async loadBgmBuffer(cue: BgmCue): Promise<AudioBuffer> {
    const cached = this.bgmBufferCache.get(cue);
    if (cached) return cached;
    const buffer = await decodeAudioFile(this.context, BGM[cue].file);
    this.bgmBufferCache.set(cue, buffer);
    return buffer;
  }

  private startBgm(cue: BgmCue, buffer: AudioBuffer): void {
    const previous = this.activeBgm;
    const config = BGM[cue];

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = config.loop;

    const gain = this.context.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(config.volume, this.context.currentTime, BGM_FADE / 3);

    source.connect(gain);
    gain.connect(this.bgmBus);
    source.start();

    this.activeBgm = { cue, source, gain };
    if (previous) this.fadeOutBgm(previous);
  }

  /** 현재 BGM을 페이드아웃하고 멈춘다. */
  stopBgm(): void {
    this.pendingBgmCue = null; // 로딩 중이던 요청도 취소한다
    if (!this.activeBgm) return;
    this.fadeOutBgm(this.activeBgm);
    this.activeBgm = null;
  }

  private fadeOutBgm(bgm: ActiveBgm): void {
    bgm.gain.gain.setTargetAtTime(0, this.context.currentTime, BGM_FADE / 3);
    // 페이드가 끝난 뒤 실제로 멈춘다 — 바로 stop하면 소리가 뚝 끊긴다.
    const stopAt = this.context.currentTime + BGM_FADE;
    bgm.source.stop(stopAt);
    bgm.source.onended = () => {
      bgm.source.disconnect();
      bgm.gain.disconnect();
    };
  }

  /**
   * 위험할 때 BGM만 잠시 낮춘다(덕킹) — 경고음이 배경음에 묻히지 않게 한다.
   * `level`은 1이 원래 음량, 0이 무음이다.
   */
  duckBgm(level: number): void {
    if (this.disposed) return;
    this.bgmBus.gain.setTargetAtTime(level, this.context.currentTime, VOLUME_RAMP * 4);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, VOLUME_RAMP);
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** 컴포넌트 언마운트 시 호출 — 남아있는 루프·BGM을 정리한다. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pendingBgmCue = null;
    for (const cue of [...this.activeLoops.keys()]) this.stopLoop(cue);
    if (this.activeBgm) {
      this.activeBgm.source.stop();
      this.activeBgm = null;
    }
  }
}
