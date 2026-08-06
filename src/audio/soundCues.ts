/**
 * 사운드 큐 정의 — 어떤 소리가 어떤 파일에서 오고 어떻게 재생되는지의 단일 출처.
 *
 * 파일은 전부 피크 정규화되어 생성되므로(`scripts/generate-audio.mjs`), 실제 음량
 * 밸런스는 여기 `volume`으로 잡는다. 파일을 교체해도 밸런스가 유지되도록 하기 위함이다.
 */

/** 효과음 — 단발성(또는 키를 누르는 동안 루프)으로 재생되는 짧은 소리. */
export type SfxCue =
  | "rotateLoop"
  | "lightSwitch"
  | "death"
  | "respawn"
  | "checkpoint"
  | "roundUp"
  | "clear"
  | "footstep"
  | "wallBump"
  | "dialogueOpen"
  | "dialogueAdvance"
  | "cutsceneAdvance"
  | "uiClick";

/** 배경음 — 라운드/컷신 단위로 길게 이어지는 소리. */
export type BgmCue = "round1" | "round2" | "round3" | "opening" | "ending";

export interface SfxConfig {
  /** `public/assets/audio/` 기준 상대 경로. 확장자를 포함하므로 나중에 mp3로 바꿔도 여기만 고치면 된다. */
  file: string;
  /** 기본 재생 음량(0~1). */
  volume: number;
  /** 키를 누르고 있는 동안 계속 재생되는지 — `scripts/generate-audio.mjs`의 LOOPING_CUES와 일치해야 한다. */
  loop?: boolean;
  /**
   * 같은 큐를 이 간격(ms) 안에 다시 재생하지 않는다. 매 프레임 발생할 수 있는
   * 이벤트(벽 충돌 등)가 소리를 도배하는 것을 막는다.
   */
  minIntervalMs?: number;
  /**
   * 재생마다 재생 속도를 ±이 비율만큼 무작위로 흔든다 — 같은 파일이 빠르게
   * 반복될 때(발소리) 기계적으로 들리는 것을 완화한다.
   */
  pitchJitter?: number;
}

export interface BgmConfig {
  file: string;
  volume: number;
  /**
   * 곡이 끝나면 처음부터 다시 재생할지 여부.
   *
   * `opening`은 타이틀 화면과 오프닝 컷신을 함께 덮는데(`App.tsx`), 플레이어가 두
   * 화면에 머무는 시간이 정해져 있지 않다 — 루프하지 않으면 곡이 끝난 뒤로 무음이
   * 된다. `ending`은 결과 요약 슬라이드에서 화면이 멈춘 채 유지되므로(CutsceneSlide의
   * `holdAtEnd`) 곡도 한 번 끝나고 조용해지는 편이 마무리로 자연스럽다.
   */
  loop: boolean;
}

export const SFX: Record<SfxCue, SfxConfig> = {
  rotateLoop: { file: "sfx/rotate-loop.wav", volume: 0.3, loop: true },
  lightSwitch: { file: "sfx/light-switch.wav", volume: 0.5, minIntervalMs: 300 },

  death: { file: "sfx/death.wav", volume: 0.8, minIntervalMs: 300 },
  respawn: { file: "sfx/respawn.wav", volume: 0.5, minIntervalMs: 300 },
  checkpoint: { file: "sfx/checkpoint.wav", volume: 0.6, minIntervalMs: 200 },
  roundUp: { file: "sfx/round-up.wav", volume: 0.7, minIntervalMs: 500 },
  clear: { file: "sfx/clear.wav", volume: 0.8, minIntervalMs: 500 },

  // 걷는 동안 초당 여러 번 나므로 음량을 낮게 잡고 피치를 흔든다.
  footstep: { file: "sfx/footstep.wav", volume: 0.22, minIntervalMs: 120, pitchJitter: 0.08 },
  // 벽에 붙어 달리면 매 프레임 발생한다 — 가장 낮은 음량 + 가장 긴 쿨다운.
  wallBump: { file: "sfx/wall-bump.wav", volume: 0.15, minIntervalMs: 260, pitchJitter: 0.1 },

  dialogueOpen: { file: "sfx/dialogue-open.wav", volume: 0.4, minIntervalMs: 80 },
  dialogueAdvance: { file: "sfx/dialogue-advance.wav", volume: 0.3, minIntervalMs: 80 },
  cutsceneAdvance: { file: "sfx/cutscene-advance.wav", volume: 0.35, minIntervalMs: 80 },
  uiClick: { file: "sfx/ui-click.wav", volume: 0.35, minIntervalMs: 80 },
};

/**
 * 배경음 5곡. 전부 OpenGameArt에서 받은 외부 음원이며, 출처·라이선스는
 * `public/assets/ASSET_SOURCES.md`에 곡별로 기록되어 있다(CC-BY 2곡은 게임 내
 * 크레딧 표기 의무가 있어 `ui/TitleScreen.tsx`에 표시한다).
 *
 * 원본은 곡마다 RMS가 최대 23dB까지 벌어져 있었고 라운드 곡은 끝이 페이드아웃돼
 * 루프에 부적합했다. 배치 전에 꼬리를 잘라 심리스 루프로 가공하고 RMS를 -20dB로
 * 맞췄으므로, 아래 volume은 이제 "곡별 보정"이 아니라 순수한 연출 의도다 —
 * 3R만 살짝 높여 압박감을 준다.
 */
export const BGM: Record<BgmCue, BgmConfig> = {
  round1: { file: "bgm/round1.mp3", volume: 0.45, loop: true },
  round2: { file: "bgm/round2.mp3", volume: 0.45, loop: true },
  round3: { file: "bgm/round3.mp3", volume: 0.5, loop: true },
  opening: { file: "bgm/opening.mp3", volume: 0.5, loop: true },
  ending: { file: "bgm/ending.mp3", volume: 0.5, loop: false },
};

export const SFX_CUES = Object.keys(SFX) as SfxCue[];
export const BGM_CUES = Object.keys(BGM) as BgmCue[];

/** 라운드 번호 → 그 라운드의 BGM 큐. `core/round.ts`의 Round와 대응한다. */
export const BGM_FOR_ROUND: Record<1 | 2 | 3, BgmCue> = {
  1: "round1",
  2: "round2",
  3: "round3",
};
