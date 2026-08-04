import type { SfxBuffers } from "./audioAssets";
import { bgmUrl } from "./audioAssets";
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
  /**
   * BGM용 <audio> 생성 지점. AudioContext.currentTime은 컨텍스트가 suspended면
   * 흐르지 않으므로 쿨다운 기준으로 쓸 수 없고, 스트리밍 재생도 <audio>가 맡는다.
   */
  createAudioElement?: () => HTMLAudioElement;
}

interface ActiveLoop {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

interface ActiveBgm {
  cue: BgmCue;
  element: HTMLAudioElement;
  gain: GainNode;
}

export class AudioEngine {
  private readonly context: AudioContext;
  private readonly buffers: SfxBuffers;
  private readonly now: () => number;
  private readonly createAudioElement: () => HTMLAudioElement;

  private readonly masterGain: GainNode;
  private readonly sfxBus: GainNode;
  private readonly bgmBus: GainNode;

  private readonly lastPlayedAt = new Map<SfxCue, number>();
  private readonly activeLoops = new Map<SfxCue, ActiveLoop>();
  private activeBgm: ActiveBgm | null = null;
  private muted: boolean;
  private disposed = false;

  constructor({ context, buffers, muted = false, now, createAudioElement }: AudioEngineOptions) {
    this.context = context;
    this.buffers = buffers;
    this.now = now ?? (() => performance.now());
    this.createAudioElement = createAudioElement ?? (() => new Audio());
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
   * autoplay 잠금이 풀린 직후 호출된다 — 잠겨 있는 동안 거부됐던 BGM 재생을 다시 밀어준다.
   *
   * 컨텍스트를 깨우는 일(resume) 자체는 여기서 하지 않는다. 엔진은 효과음 디코딩이
   * 끝나야 만들어지는데 첫 사용자 입력은 그보다 먼저 오는 것이 보통이라, 잠금 해제를
   * 엔진에 맡기면 그 입력을 놓친다 — 컨텍스트를 소유한 `useAudio`가 담당한다.
   */
  resumeBgm(): void {
    if (this.disposed) return;
    this.activeBgm?.element.play().catch(() => {});
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
   * BGM을 전환한다. 이미 같은 곡이 재생 중이면 아무 일도 하지 않으므로, 매 프레임
   * 호출해도 안전하다. 다른 곡이 재생 중이면 크로스페이드로 넘어간다.
   */
  playBgm(cue: BgmCue): void {
    if (this.disposed || this.activeBgm?.cue === cue) return;

    const previous = this.activeBgm;
    const config = BGM[cue];
    const element = this.createAudioElement();
    element.src = bgmUrl(cue);
    element.loop = config.loop;
    // 크로스페이드는 GainNode가 담당하므로 element 자체 음량은 최대로 둔다.
    element.volume = 1;

    const gain = this.context.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(config.volume, this.context.currentTime, BGM_FADE / 3);

    const source = this.context.createMediaElementSource(element);
    source.connect(gain);
    gain.connect(this.bgmBus);

    // 파일이 없거나 autoplay가 아직 막혀 있으면 reject된다 — 둘 다 정상 상태로 넘긴다.
    element.play().catch(() => {});

    this.activeBgm = { cue, element, gain };
    if (previous) this.fadeOutBgm(previous);
  }

  /** 현재 BGM을 페이드아웃하고 멈춘다. */
  stopBgm(): void {
    if (!this.activeBgm) return;
    this.fadeOutBgm(this.activeBgm);
    this.activeBgm = null;
  }

  private fadeOutBgm(bgm: ActiveBgm): void {
    bgm.gain.gain.setTargetAtTime(0, this.context.currentTime, BGM_FADE / 3);
    // 페이드가 끝난 뒤 실제로 멈춘다 — 바로 pause하면 소리가 뚝 끊긴다.
    setTimeout(() => {
      bgm.element.pause();
      bgm.gain.disconnect();
    }, BGM_FADE * 1000);
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
    for (const cue of [...this.activeLoops.keys()]) this.stopLoop(cue);
    if (this.activeBgm) {
      this.activeBgm.element.pause();
      this.activeBgm = null;
    }
  }
}
