// 1회성 개발 스크립트 — 게임 효과음·BGM을 신스로 합성해 WAV로 생성한다.
// 사용법:
//   node scripts/generate-audio.mjs        → public/assets/audio/ 전체 생성
//   node scripts/generate-audio.mjs death  → 특정 큐만 재생성(레시피 조정 반복용)
//
// 외부 음원을 받아오지 않고 직접 합성하는 이유: 이 프로젝트는 파일별 출처·라이선스를
// public/assets/ASSET_SOURCES.md에 기재하고 그 목록을 AI활용기술문서(제출물)에 반영한다.
// 자체 생성하면 라이선스가 팀 소유로 확정되어 그 기재가 사실과 일치한다.
//
// 포맷이 mp3가 아니라 WAV인 이유: 개발 환경에 ffmpeg가 없어 mp3 인코딩이 불가능하고,
// npm 인코더 추가는 기술 스택 고정 규칙에 걸린다. 브라우저 decodeAudioData는 WAV를
// 완전히 지원하므로 재생에는 차이가 없다(효과음 1초 ≈ 44KB).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SAMPLE_RATE = 22050; // 모노 16bit — 효과음/앰비언트에 충분하고 용량이 절반
const OUT_DIR = "public/assets/audio";

// ---------------------------------------------------------------------------
// WAV 출력
// ---------------------------------------------------------------------------

/** Float32(-1..1) 샘플 배열을 44바이트 RIFF 헤더 + PCM signed 16-bit LE로 인코딩한다. */
function encodeWav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt 청크 크기
  buffer.writeUInt16LE(1, 20); // 1 = PCM(무압축)
  buffer.writeUInt16LE(1, 22); // 채널 수 = 모노
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // 초당 바이트
  buffer.writeUInt16LE(2, 32); // 블록 정렬(모노 16bit = 2바이트)
  buffer.writeUInt16LE(16, 34); // 비트 심도
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// 신스 프리미티브 — 전부 Float32Array를 만들거나 변환하는 순수 함수
// ---------------------------------------------------------------------------

/** 길이 계산용 — 0초짜리 버퍼가 나오지 않도록 최소 1샘플을 보장한다. */
const secondsToSamples = (seconds) => Math.max(1, Math.round(seconds * SAMPLE_RATE));

/** 오프셋 계산용 — 0초는 0샘플이어야 하므로 최소값을 두지 않는다. */
const offsetToSamples = (seconds) => Math.max(0, Math.round((seconds ?? 0) * SAMPLE_RATE));

/**
 * 오실레이터. freq/amp는 상수 또는 t(초)를 받는 함수로 줄 수 있다.
 * 주파수를 변조할 때 sin(2π·f(t)·t)로 계산하면 위상이 불연속해져 지직거리므로,
 * 위상을 매 샘플 누적한다.
 */
function osc({ duration, freq, amp = 1, wave = "sine", phase = 0 }) {
  const length = secondsToSamples(duration);
  const out = new Float32Array(length);
  const freqAt = typeof freq === "function" ? freq : () => freq;
  const ampAt = typeof amp === "function" ? amp : () => amp;
  let currentPhase = phase;

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    currentPhase += (2 * Math.PI * freqAt(t)) / SAMPLE_RATE;
    out[i] = waveform(wave, currentPhase) * ampAt(t);
  }
  return out;
}

function waveform(wave, phase) {
  const normalized = phase % (2 * Math.PI);
  switch (wave) {
    case "square":
      return Math.sin(normalized) >= 0 ? 1 : -1;
    case "saw":
      return normalized / Math.PI - 1;
    case "triangle":
      return 1 - 4 * Math.abs(Math.round(normalized / (2 * Math.PI)) - normalized / (2 * Math.PI));
    default:
      return Math.sin(normalized);
  }
}

/** 화이트 노이즈 / 브라운 노이즈(저역이 강해 바람·마찰음에 적합). */
function noise({ duration, type = "white", amp = 1 }) {
  const length = secondsToSamples(duration);
  const out = new Float32Array(length);
  const ampAt = typeof amp === "function" ? amp : () => amp;
  let brown = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    let value = white;
    if (type === "brown") {
      brown = (brown + white * 0.02) / 1.02;
      value = brown * 12; // 적분으로 줄어든 진폭 보정
    }
    out[i] = value * ampAt(i / SAMPLE_RATE);
  }
  return out;
}

/** 원폴 로우패스 — cutoff(Hz) 위쪽을 6dB/oct로 깎는다. */
function lowpass(input, cutoff) {
  const out = new Float32Array(input.length);
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = 1 / SAMPLE_RATE / (rc + 1 / SAMPLE_RATE);
  let previous = 0;
  for (let i = 0; i < input.length; i++) {
    previous += alpha * (input[i] - previous);
    out[i] = previous;
  }
  return out;
}

/** 원폴 하이패스 — cutoff(Hz) 아래쪽을 깎는다. */
function highpass(input, cutoff) {
  const out = new Float32Array(input.length);
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = rc / (rc + 1 / SAMPLE_RATE);
  let previousIn = 0;
  let previousOut = 0;
  for (let i = 0; i < input.length; i++) {
    previousOut = alpha * (previousOut + input[i] - previousIn);
    previousIn = input[i];
    out[i] = previousOut;
  }
  return out;
}

const bandpass = (input, low, high) => lowpass(highpass(input, low), high);

/**
 * comb 딜레이 — 짧은 반복 반사로 잔향을 흉내낸다.
 * 진짜 리버브는 아니지만 22kHz 모노 효과음에서는 충분히 공간감이 붙는다.
 */
function reverb(input, { delaySeconds = 0.045, feedback = 0.45, mix = 0.35, tail = 0 } = {}) {
  const delay = secondsToSamples(delaySeconds);
  const length = input.length + offsetToSamples(tail);
  const out = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const dry = i < input.length ? input[i] : 0;
    const delayed = i >= delay ? out[i - delay] * feedback : 0;
    out[i] = dry + delayed * mix;
  }
  return out;
}

/** 지수 감쇠 엔벨로프 + 클릭 방지용 짧은 어택. */
function decayEnv(rate, attackSeconds = 0.003) {
  return (t) => {
    const attack = attackSeconds > 0 ? Math.min(1, t / attackSeconds) : 1;
    return attack * Math.exp(-t * rate);
  };
}

/** 선형 ADSR 엔벨로프. */
function adsrEnv({ duration, attack = 0.01, decay = 0.05, sustain = 0.7, release = 0.1 }) {
  return (t) => {
    if (t < attack) return t / attack;
    if (t < attack + decay) return 1 - ((1 - sustain) * (t - attack)) / decay;
    const releaseStart = duration - release;
    if (t >= releaseStart) return Math.max(0, sustain * (1 - (t - releaseStart) / release));
    return sustain;
  };
}

/** 여러 버퍼를 겹친다. 길이가 다르면 가장 긴 것에 맞춘다. offset(초)으로 시작 시점을 밀 수 있다. */
function mix(...layers) {
  const normalized = layers.map((layer) => (ArrayBuffer.isView(layer) ? { buffer: layer, offset: 0, gain: 1 } : layer));
  const length = Math.max(...normalized.map((l) => offsetToSamples(l.offset) + l.buffer.length));
  const out = new Float32Array(length);

  for (const layer of normalized) {
    const start = offsetToSamples(layer.offset);
    const gain = layer.gain ?? 1;
    for (let i = 0; i < layer.buffer.length; i++) {
      const target = start + i;
      if (target < out.length) out[target] += layer.buffer[i] * gain;
    }
  }
  return out;
}

/** 피크를 목표값으로 맞춘다 — 파일 간 음량 편차를 없애고, 실제 밸런스는 런타임 volume으로 잡는다. */
function normalize(input, peak = 0.9) {
  let max = 0;
  for (const sample of input) max = Math.max(max, Math.abs(sample));
  if (max === 0) return input;
  const scale = peak / max;
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] * scale;
  return out;
}

/** 앞뒤 끝을 짧게 페이드해 재생 시작·종료 클릭 노이즈를 없앤다. */
function fadeEdges(input, fadeSeconds = 0.005) {
  const fade = Math.min(secondsToSamples(fadeSeconds), Math.floor(input.length / 2));
  const out = Float32Array.from(input);
  for (let i = 0; i < fade; i++) {
    const gain = i / fade;
    out[i] *= gain;
    out[out.length - 1 - i] *= gain;
  }
  return out;
}

/**
 * 끝단만 페이드아웃한다 — 감쇠 엔벨로프가 0에 닿기 전에 파일이 끝나면 재생 종료
 * 순간 파형이 수직으로 잘려 딸깍거린다. 시작단은 각 레시피의 어택에 맡긴다.
 */
function fadeOut(input, fadeSeconds = 0.004) {
  const fade = Math.min(secondsToSamples(fadeSeconds), input.length);
  const out = Float32Array.from(input);
  for (let i = 0; i < fade; i++) {
    out[out.length - fade + i] *= 1 - i / fade;
  }
  return out;
}

/**
 * 심리스 루프 변환 — 버퍼 끝 fadeSeconds 구간을 잘라내 시작 구간에 크로스페이드로
 * 섞는다. 결과 버퍼는 마지막 샘플에서 첫 샘플로 이어져도 파형이 연속되므로,
 * loop 재생 시 이음매에서 딸깍거리지 않는다(rotate-loop과 BGM에 필수).
 */
function seamlessLoop(input, fadeSeconds = 0.25) {
  const fade = Math.min(secondsToSamples(fadeSeconds), Math.floor(input.length / 3));
  const outLength = input.length - fade;
  const out = new Float32Array(outLength);
  out.set(input.subarray(0, outLength));

  for (let i = 0; i < fade; i++) {
    const weight = i / fade; // 0 → 1
    out[i] = out[i] * weight + input[outLength + i] * (1 - weight);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 큐별 레시피
// ---------------------------------------------------------------------------

/**
 * 드론 한 겹 — 사인 기음 + 약한 배음 + 미세 디튠 레이어(비팅으로 살아있는 느낌).
 * BGM 5개가 전부 이 함수를 공유하므로 라운드가 바뀌어도 음색 계열이 유지된다.
 */
function drone({ duration, freq, amp = 1, lfoHz = 0.125, lfoDepth = 0.3 }) {
  const ampAt = typeof amp === "function" ? amp : () => amp;
  const modulated = (t) => ampAt(t) * (1 - lfoDepth + lfoDepth * (0.5 + 0.5 * Math.sin(2 * Math.PI * lfoHz * t)));

  return mix(
    { buffer: osc({ duration, freq, amp: modulated }), gain: 1 },
    // 0.25Hz 어긋난 레이어 — 느린 비팅으로 정적인 사인을 덜 기계적으로 만든다.
    // 0.25Hz는 16초 루프에 정확히 4주기라 이음매에서 비팅 위상이 어긋나지 않는다.
    { buffer: osc({ duration, freq: freq + 0.25, amp: modulated }), gain: 0.7 },
    // 옥타브 위 배음을 약하게 얹어 저역만 남지 않게 한다
    { buffer: osc({ duration, freq: freq * 2, amp: modulated }), gain: 0.12 },
    { buffer: osc({ duration, freq: freq * 3, amp: modulated, wave: "triangle" }), gain: 0.05 },
  );
}

/** 사인 한 음 — 차임·아르페지오용. */
function tone({ duration, freq, decay = 8, gain = 1, wave = "sine" }) {
  const buffer = osc({ duration, freq, wave, amp: decayEnv(decay) });
  const out = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) out[i] = buffer[i] * gain;
  return out;
}

// 음이름 → 주파수 (A4 = 440Hz 기준 12평균율)
const NOTES = {
  D2: 73.42, Eb3: 155.56, F3: 174.61, A2: 110.0, A3: 220.0, D3: 146.83, D4: 293.66,
  A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
  C6: 1046.5, D6: 1174.66,
};

/**
 * 루프 재생되는 큐 — 런타임(`src/audio/soundCues.ts`)의 loop 설정과 반드시 일치해야
 * 한다. 여기 빠지면 끝단 페이드아웃이 걸려 루프 한 바퀴마다 음량이 꺼졌다 켜진다.
 */
const LOOPING_CUES = new Set(["sfx/rotate-loop", "bgm/round1", "bgm/round2", "bgm/round3"]);

const RECIPES = {
  // --- 그림자 판정 ---------------------------------------------------------

  // 회전 키를 누르고 있는 동안 계속 재생 — 브라운 노이즈를 좁게 필터링해 맷돌이
  // 갈리는 질감을 만들고, 5Hz 진폭 변조로 "돌아가는" 주기감을 준다.
  // 5Hz는 1초 버퍼에 정확히 5주기라 크로스페이드 후에도 주기가 어긋나지 않는다.
  "sfx/rotate-loop": () => {
    const raw = noise({ duration: 1.0, type: "brown" });
    const filtered = bandpass(raw, 120, 900);
    const modulated = new Float32Array(filtered.length);
    for (let i = 0; i < filtered.length; i++) {
      const t = i / SAMPLE_RATE;
      modulated[i] = filtered[i] * (0.55 + 0.45 * Math.sin(2 * Math.PI * 5 * t));
    }
    return normalize(seamlessLoop(modulated, 0.2), 0.55);
  },

  // 광원이 바뀌어 1.2초 무적 유예가 걸리는 순간 — 전등 스위치 딸깍 + 링잉.
  "sfx/light-switch": () =>
    normalize(
      mix(
        { buffer: lowpass(noise({ duration: 0.012, amp: decayEnv(300, 0) }), 4000), gain: 1 },
        { buffer: osc({ duration: 0.35, freq: 1200, amp: decayEnv(14) }), gain: 0.5 },
        { buffer: osc({ duration: 0.35, freq: 1802, amp: decayEnv(18) }), gain: 0.2 },
      ),
      0.7,
    ),

  // --- 사망 / 리스폰 -------------------------------------------------------

  // 사망 시퀀스가 1.6초라 그 안에 들어가야 한다. 노이즈 버스트(충격) 뒤에
  // 400→60Hz로 떨어지는 스윕(영혼이 빠져나가는 느낌)을 얹고 잔향으로 끌어준다.
  "sfx/death": () => {
    const impact = lowpass(noise({ duration: 0.25, amp: decayEnv(16, 0.001) }), 1800);
    const sweep = osc({
      duration: 1.2,
      freq: (t) => 60 + 340 * Math.exp(-t * 1.9),
      amp: (t) => Math.min(1, t / 0.01) * Math.exp(-t * 2.2),
    });
    const shimmer = osc({ duration: 1.2, freq: (t) => 900 - 500 * t, amp: decayEnv(4) });
    return normalize(reverb(mix({ buffer: impact, gain: 0.9 }, { buffer: sweep, gain: 1 }, { buffer: shimmer, gain: 0.12 }), {
      delaySeconds: 0.07,
      feedback: 0.5,
      mix: 0.4,
      tail: 0.3,
    }), 0.9);
  },

  "sfx/respawn": () =>
    normalize(
      mix(
        osc({
          duration: 0.5,
          freq: (t) => 200 + 400 * Math.min(1, t / 0.35),
          amp: (t) => Math.min(1, t / 0.06) * Math.exp(-Math.max(0, t - 0.3) * 9),
        }),
        { buffer: osc({ duration: 0.5, freq: (t) => 400 + 800 * Math.min(1, t / 0.35), amp: decayEnv(6) }), gain: 0.18 },
      ),
      0.7,
    ),

  // --- 진행 이벤트 ---------------------------------------------------------

  "sfx/checkpoint": () =>
    normalize(
      reverb(
        mix(
          tone({ duration: 0.35, freq: NOTES.C5, decay: 9 }),
          { buffer: tone({ duration: 0.45, freq: NOTES.G5, decay: 7 }), offset: 0.14 },
        ),
        { delaySeconds: 0.06, feedback: 0.4, mix: 0.3, tail: 0.2 },
      ),
      0.75,
    ),

  // 라운드 승급 — 상승 아르페지오지만 단3도를 써서 "다음이 더 어렵다"는 불안을 남긴다.
  "sfx/round-up": () =>
    normalize(
      reverb(
        mix(
          tone({ duration: 0.4, freq: NOTES.A4, decay: 7 }),
          { buffer: tone({ duration: 0.4, freq: NOTES.C5, decay: 7 }), offset: 0.16 },
          { buffer: tone({ duration: 0.8, freq: NOTES.E5, decay: 4.5 }), offset: 0.32 },
          { buffer: tone({ duration: 0.8, freq: NOTES.E5 + 0.6, decay: 4.5, gain: 0.5 }), offset: 0.32 },
        ),
        { delaySeconds: 0.08, feedback: 0.45, mix: 0.35, tail: 0.35 },
      ),
      0.85,
    ),

  // 최종 클리어 — 유일하게 장조로 해결해 해방감을 준다.
  "sfx/clear": () =>
    normalize(
      reverb(
        mix(
          tone({ duration: 0.35, freq: NOTES.D5, decay: 8 }),
          { buffer: tone({ duration: 0.35, freq: NOTES.F5, decay: 8 }), offset: 0.14 },
          { buffer: tone({ duration: 0.35, freq: NOTES.A5, decay: 8 }), offset: 0.28 },
          { buffer: tone({ duration: 1.2, freq: NOTES.D6, decay: 3 }), offset: 0.42 },
          { buffer: tone({ duration: 1.6, freq: NOTES.D4, decay: 2.2, gain: 0.6 }), offset: 0.42 },
          { buffer: tone({ duration: 1.6, freq: NOTES.A4, decay: 2.2, gain: 0.4 }), offset: 0.42 },
        ),
        { delaySeconds: 0.1, feedback: 0.55, mix: 0.4, tail: 0.7 },
      ),
      0.9,
    ),

  // --- 캐릭터 이동 ---------------------------------------------------------

  // 런타임이 재생마다 playbackRate를 ±8% 흔들어 같은 파일 반복의 기계적인 느낌을 줄인다.
  "sfx/footstep": () =>
    normalize(bandpass(noise({ duration: 0.12, amp: decayEnv(38, 0.001) }), 180, 1400), 0.6),

  // 벽에 붙어 달리면 자주 나므로 저역만 남긴 둔탁한 소리로 만들고, 런타임 볼륨도 낮게 잡는다.
  "sfx/wall-bump": () => normalize(lowpass(noise({ duration: 0.1, amp: decayEnv(45, 0.001) }), 220), 0.45),

  // --- UI ------------------------------------------------------------------

  "sfx/dialogue-open": () =>
    normalize(mix(
      osc({ duration: 0.15, freq: 300, amp: decayEnv(18) }),
      { buffer: osc({ duration: 0.15, freq: 452, amp: decayEnv(22) }), gain: 0.3 },
    ), 0.5),

  "sfx/dialogue-advance": () => normalize(osc({ duration: 0.1, freq: 600, amp: decayEnv(30) }), 0.4),

  "sfx/cutscene-advance": () =>
    normalize(
      highpass(noise({ duration: 0.25, amp: (t) => Math.sin(Math.PI * Math.min(1, t / 0.25)) * 0.8 }), 900),
      0.45,
    ),

  "sfx/ui-click": () => normalize(osc({ duration: 0.06, freq: 800, wave: "square", amp: decayEnv(60, 0.001) }), 0.4),

  // --- BGM -----------------------------------------------------------------
  // D 마이너 계열 드론. 1R→3R은 같은 근음(D2)에 레이어만 더해 파생시킨다 —
  // 라운드 전환 시 크로스페이드해도 음색이 튀지 않는다.
  // LFO 주기는 전부 16초의 정수 약수로 잡아 루프 이음매에서 위상이 어긋나지 않게 한다.

  "bgm/round1": () =>
    normalize(
      seamlessLoop(
        mix(
          { buffer: drone({ duration: 17, freq: NOTES.D2, lfoHz: 0.125, lfoDepth: 0.35 }), gain: 1 },
          { buffer: drone({ duration: 17, freq: NOTES.A2, lfoHz: 0.0625, lfoDepth: 0.4 }), gain: 0.45 },
          // 아주 옅은 바람 노이즈 — 야외 거리 분위기(ADR-004 배경 세계관)
          { buffer: lowpass(noise({ duration: 17, type: "brown" }), 500), gain: 0.05 },
        ),
        1.0,
      ),
      0.5,
    ),

  "bgm/round2": () =>
    normalize(
      seamlessLoop(
        mix(
          { buffer: drone({ duration: 17, freq: NOTES.D2, lfoHz: 0.25, lfoDepth: 0.35 }), gain: 1 },
          { buffer: drone({ duration: 17, freq: NOTES.A2, lfoHz: 0.125, lfoDepth: 0.4 }), gain: 0.45 },
          // 단3도(F3)를 더해 마이너 색채를 뚜렷하게 — 긴장 상승
          { buffer: drone({ duration: 17, freq: NOTES.F3, lfoHz: 0.25, lfoDepth: 0.5 }), gain: 0.3 },
          { buffer: lowpass(noise({ duration: 17, type: "brown" }), 500), gain: 0.05 },
        ),
        1.0,
      ),
      0.5,
    ),

  "bgm/round3": () => {
    // 1Hz 저역 펄스 — 심박처럼 깔려 압박감을 만든다. 16초에 정확히 16주기.
    // 반송파는 D2 한 옥타브 아래(36.71Hz)에서 36.75Hz로 미세 조정했다 — 16초에
    // 정확히 588주기가 되어 루프 이음매에서 위상이 어긋나지 않는다(음정 차이는 2 cent로
    // 들리지 않는 수준이고, 조정 전에는 이음매 점프가 다른 BGM의 30배였다).
    const pulse = osc({
      duration: 17,
      freq: 36.75,
      amp: (t) => {
        const phase = t % 1;
        return Math.exp(-phase * 9) * 0.9;
      },
    });
    return normalize(
      seamlessLoop(
        mix(
          { buffer: drone({ duration: 17, freq: NOTES.D2, lfoHz: 0.5, lfoDepth: 0.35 }), gain: 1 },
          { buffer: drone({ duration: 17, freq: NOTES.A2, lfoHz: 0.25, lfoDepth: 0.4 }), gain: 0.45 },
          { buffer: drone({ duration: 17, freq: NOTES.F3, lfoHz: 0.5, lfoDepth: 0.5 }), gain: 0.3 },
          // 반음 불협(Eb3) — 아주 낮게 깔아 불안정한 느낌만 남긴다
          { buffer: drone({ duration: 17, freq: NOTES.Eb3, lfoHz: 0.125, lfoDepth: 0.7 }), gain: 0.14 },
          { buffer: pulse, gain: 0.35 },
          { buffer: lowpass(noise({ duration: 17, type: "brown" }), 500), gain: 0.06 },
        ),
        1.0,
      ),
      0.55,
    );
  },

  // 컷신 2곡은 루프하지 않는다 — 페이드인/아웃으로 시작과 끝이 분명하다.
  "bgm/opening": () =>
    normalize(
      fadeEdges(
        mix(
          { buffer: drone({ duration: 24, freq: NOTES.D2, amp: (t) => Math.min(1, t / 4), lfoHz: 0.125 }), gain: 1 },
          { buffer: drone({ duration: 24, freq: NOTES.A2, amp: (t) => Math.max(0, Math.min(1, (t - 6) / 5)), lfoHz: 0.0625 }), gain: 0.5 },
          { buffer: drone({ duration: 24, freq: NOTES.D3, amp: (t) => Math.max(0, Math.min(1, (t - 13) / 6)), lfoHz: 0.125 }), gain: 0.22 },
          { buffer: lowpass(noise({ duration: 24, type: "brown" }), 400), gain: 0.06 },
        ),
        1.5,
      ),
      0.5,
    ),

  "bgm/ending": () =>
    normalize(
      fadeEdges(
        mix(
          // D 마이너에서 시작해 A3를 더하며 열린 화음으로 해결한다
          { buffer: drone({ duration: 24, freq: NOTES.D2, amp: (t) => Math.min(1, t / 2) * Math.min(1, (24 - t) / 5), lfoHz: 0.125 }), gain: 1 },
          { buffer: drone({ duration: 24, freq: NOTES.F3, amp: (t) => Math.min(1, t / 3) * Math.max(0, Math.min(1, (14 - t) / 4)), lfoHz: 0.125 }), gain: 0.3 },
          { buffer: drone({ duration: 24, freq: NOTES.A3, amp: (t) => Math.max(0, Math.min(1, (t - 8) / 5)) * Math.min(1, (24 - t) / 6), lfoHz: 0.0625 }), gain: 0.28 },
          { buffer: drone({ duration: 24, freq: NOTES.D4, amp: (t) => Math.max(0, Math.min(1, (t - 12) / 6)) * Math.min(1, (24 - t) / 6), lfoHz: 0.125 }), gain: 0.16 },
        ),
        1.5,
      ),
      0.5,
    ),
};

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------

async function main() {
  const requested = process.argv.slice(2);
  const targets = requested.length > 0
    ? Object.keys(RECIPES).filter((name) => requested.some((arg) => name.includes(arg)))
    : Object.keys(RECIPES);

  if (targets.length === 0) {
    console.error(`일치하는 큐가 없습니다: ${requested.join(", ")}`);
    console.error(`사용 가능: ${Object.keys(RECIPES).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  await mkdir(path.join(OUT_DIR, "sfx"), { recursive: true });
  await mkdir(path.join(OUT_DIR, "bgm"), { recursive: true });

  let totalBytes = 0;
  for (const name of targets) {
    const raw = RECIPES[name]();
    // 루프 재생되는 큐는 끝단을 건드리면 안 된다 — seamlessLoop이 맞춰둔 이음매가
    // 깨져 오히려 매 바퀴 딸깍거린다. 나머지는 종료 클릭 방지용으로 끝만 페이드한다.
    const samples = LOOPING_CUES.has(name) ? raw : fadeOut(raw);
    const encoded = encodeWav(samples);
    const filePath = path.join(OUT_DIR, `${name}.wav`);
    await writeFile(filePath, encoded);
    totalBytes += encoded.length;
    const seconds = (samples.length / SAMPLE_RATE).toFixed(2);
    console.log(`${filePath.padEnd(42)} ${seconds}s  ${(encoded.length / 1024).toFixed(0)}KB`);
  }
  console.log(`\n${targets.length}개 생성, 합계 ${(totalBytes / 1024 / 1024).toFixed(2)}MB`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
