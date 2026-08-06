// BGM 원본(OpenGameArt 다운로드본)을 게임에 쓸 형태로 가공한다.
//
// 사용법:
//   node scripts/process-bgm.mjs <원본폴더> [출력폴더]
//   node scripts/process-bgm.mjs ./bgm-src            → public/assets/audio/bgm/ 에 출력
//
// 원본 파일은 저장소에 두지 않는다(용량). 아래 SLOTS의 url에서 다시 받아 원본 폴더에
// 넣고 이 스크립트를 돌리면 커밋된 것과 같은 결과가 나온다. 곡별 라이선스·출처는
// `public/assets/ASSET_SOURCES.md` 참고.
//
// 왜 가공이 필요한가:
//   - 라운드 곡은 끝이 페이드아웃·무음으로 끝나 그대로는 루프할 수 없다(제목에 "Loop"가
//     붙은 곡조차 끝 0.5초가 완전 무음이었다). 꼬리를 잘라내고 끝 구간을 시작에
//     크로스페이드로 겹쳐 파형을 연속시킨다 — `generate-audio.mjs`의 seamlessLoop()과
//     같은 원리이며, 대상이 합성 버퍼가 아니라 외부 음원일 뿐이다.
//   - 원본은 곡 간 RMS가 최대 23dB까지 벌어져 있어(한 곡은 -40dB로 거의 안 들렸다)
//     같은 volume 값을 줄 수 없었다. -20dBFS로 맞춰 soundCues.ts의 volume이 곡별
//     보정이 아니라 순수한 연출 의도로 남게 한다.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 저장소 루트 — 출력 경로를 여기 기준으로 잡는다(실행 위치와 무관하게 같은 곳에 쓰기 위함). */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SR = 44100;

/** 정규화 목표 RMS(dBFS). 게임 BGM으로 흔히 쓰는 대역이다. */
const TARGET_RMS_DB = -20;
/** 정규화 후 피크 상한(dBFS). 넘으면 전체를 낮춰 클리핑을 막는다. */
const PEAK_CEILING_DB = -1;
/** 루프 이음매 크로스페이드 길이(초). 짧으면 이음매가 들리고, 길면 음악이 뭉개진다. */
const CROSSFADE_SEC = 2;
/** 출력 비트레이트. BGM에는 128k면 충분하고, 5곡 합계가 5.5MB 수준으로 유지된다. */
const BITRATE = "128k";

/**
 * 슬롯 정의. `source`는 원본 폴더 안의 파일명이다 — OpenGameArt 다운로드본의 이름을
 * 그대로 적었다(`game.mp3`는 확장자가 mp3지만 내용은 무압축 WAV다. 업로더가 잘못
 * 이름 붙인 것으로, ffmpeg는 내용을 보고 디코딩하므로 그대로 둔다).
 */
const SLOTS = [
  {
    slot: "opening",
    source: "game.mp3",
    loop: true,
    title: "Intro Music",
    url: "https://opengameart.org/content/intro-music-0",
  },
  {
    slot: "round1",
    source: "theme.ogg",
    loop: true,
    title: "Dark Theme",
    url: "https://opengameart.org/content/dark-theme",
  },
  {
    slot: "round2",
    source: "qubodup-yd-DarkShrineLoop-OpenGameArt.mp3",
    loop: true,
    title: "Dark Shrine Loop",
    url: "https://opengameart.org/content/dark-shrine-loop",
  },
  {
    slot: "round3",
    source: "мистичная тема.mp3",
    loop: true,
    title: "Mystical Theme",
    url: "https://opengameart.org/content/mystical-theme",
  },
  {
    // 엔딩은 결과 요약 슬라이드에서 화면이 멈춘 채 유지되므로(soundCues의 loop:false)
    // 페이드아웃이 그대로 마무리가 된다 — 루프 가공을 하지 않는다.
    slot: "ending",
    source: "epilogue.mp3",
    loop: false,
    title: "Epilogue",
    url: "https://opengameart.org/content/epilogue",
  },
];

const dbToGain = (d) => Math.pow(10, d / 20);
const gainToDb = (g) => (g <= 1e-12 ? -Infinity : 20 * Math.log10(g));

// --- ffmpeg ----------------------------------------------------------------

/** PATH의 ffmpeg를 쓴다. FFMPEG 환경변수로 경로를 직접 지정할 수도 있다. */
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";

function ffmpeg(args) {
  try {
    execFileSync(FFMPEG, ["-y", "-v", "error", ...args], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`ffmpeg를 찾을 수 없습니다. 설치 후 PATH에 넣거나 FFMPEG 환경변수로 경로를 지정하세요.`);
    }
    throw new Error(`ffmpeg 실패: ${error.stderr?.toString() ?? error.message}`);
  }
}

// --- WAV 입출력 (16bit PCM) -------------------------------------------------

function readWav(buf) {
  let pos = 12;
  let channels = 2;
  let sampleRate = SR;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("latin1", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(pos + 10);
      sampleRate = buf.readUInt32LE(pos + 12);
    } else if (id === "data") {
      const bytes = Math.min(size, buf.length - pos - 8);
      const frames = Math.floor(bytes / 2 / channels);
      const out = Array.from({ length: channels }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++) {
          out[c][i] = buf.readInt16LE(pos + 8 + (i * channels + c) * 2) / 32768;
        }
      }
      return { channels: out, sampleRate };
    }
    pos += 8 + size + (size & 1);
  }
  throw new Error("WAV data 청크를 찾지 못했습니다");
}

function writeWav(chans, sampleRate) {
  const numCh = chans.length;
  const frames = chans[0].length;
  const dataBytes = frames * numCh * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "latin1");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "latin1");
  buf.write("fmt ", 12, "latin1");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numCh, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numCh * 2, 28);
  buf.writeUInt16LE(numCh * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "latin1");
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      buf.writeInt16LE(Math.round(v * 32767), 44 + (i * numCh + c) * 2);
    }
  }
  return buf;
}

// --- 분석 ------------------------------------------------------------------

function overallRms(chans) {
  let sum = 0;
  const frames = chans[0].length;
  for (const ch of chans) for (let i = 0; i < frames; i++) sum += ch[i] * ch[i];
  return Math.sqrt(sum / (frames * chans.length));
}

function peakOf(chans) {
  let peak = 0;
  for (const ch of chans) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
    }
  }
  return peak;
}

function windowRms(chans, from, to) {
  let sum = 0;
  const a = Math.max(0, from);
  const b = Math.min(chans[0].length, to);
  if (b <= a) return 0;
  for (const ch of chans) for (let i = a; i < b; i++) sum += ch[i] * ch[i];
  return Math.sqrt(sum / ((b - a) * chans.length));
}

/**
 * 곡이 "실제로 울리고 있는" 마지막 프레임 — 뒤에서부터 100ms 창을 훑어 전체 RMS 대비
 * -6dB 이상인 첫 창의 끝을 돌려준다. 페이드아웃·무음 꼬리를 잘라내기 위한 기준점이며,
 * 꼬리가 없으면 원래 길이를 그대로 돌려준다.
 */
function findMusicEnd(chans) {
  const frames = chans[0].length;
  const win = Math.floor(SR * 0.1);
  const threshold = overallRms(chans) * dbToGain(-6);
  for (let end = frames; end > win; end -= win) {
    if (windowRms(chans, end - win, end) >= threshold) return end;
  }
  return frames;
}

// --- 가공 ------------------------------------------------------------------

/**
 * 심리스 루프화 — 끝 fade 프레임을 잘라 시작 fade 구간에 크로스페이드로 섞는다.
 * 결과의 마지막 프레임이 첫 프레임과 파형상 이어져 루프 이음매가 들리지 않는다.
 */
function seamlessLoop(chans, fadeFrames) {
  const frames = chans[0].length;
  const fade = Math.min(fadeFrames, Math.floor(frames / 3));
  const outLen = frames - fade;
  return chans.map((ch) => {
    const out = new Float32Array(outLen);
    out.set(ch.subarray(0, outLen));
    for (let i = 0; i < fade; i++) {
      const t = i / fade; // 0 → 1
      out[i] = ch[i] * t + ch[outLen + i] * (1 - t);
    }
    return out;
  });
}

/** RMS를 목표치로 맞추되, 피크가 상한을 넘으면 그만큼 되돌린다. */
function normalize(chans) {
  const rms = overallRms(chans);
  let gain = dbToGain(TARGET_RMS_DB) / rms;
  const peakAfter = peakOf(chans) * gain;
  const ceiling = dbToGain(PEAK_CEILING_DB);
  let limited = false;
  if (peakAfter > ceiling) {
    gain *= ceiling / peakAfter;
    limited = true;
  }
  return { chans: chans.map((ch) => ch.map((v) => v * gain)), gainDb: gainToDb(gain), limited };
}

// --- 실행 ------------------------------------------------------------------

/** 원본 목록 안내 — 인자가 없을 때도, 파일을 못 찾았을 때도 같은 내용을 보여준다. */
function printSourceList() {
  console.error("필요한 원본 파일 (저장소에 없음 — 아래에서 받아 원본 폴더에 넣으세요):\n");
  for (const { slot, source, title, url } of SLOTS) {
    console.error(`  [${slot}] ${source}`);
    console.error(`      ${title} — ${url}`);
  }
  console.error(
    "\n※ 받은 파일 이름이 위와 다르면(브라우저가 URL 인코딩해 저장하는 경우가 있습니다)" +
      "\n   위 이름으로 바꿔주세요. 내용만 같으면 됩니다.",
  );
}

const srcDir = process.argv[2];
// 출력은 실행 위치가 아니라 저장소 기준이다 — 다른 디렉터리에서 돌려도 같은 곳에 쓴다.
const outDir = process.argv[3] ?? path.join(REPO_ROOT, "public/assets/audio/bgm");

if (!srcDir) {
  console.error("사용법: node scripts/process-bgm.mjs <원본폴더> [출력폴더]\n");
  printSourceList();
  process.exit(1);
}

// 가공을 시작하기 전에 원본이 전부 있는지 확인한다 — 중간에 멈추면 출력 폴더에
// 새 파일과 옛 파일이 섞여 어느 것이 최신인지 알 수 없게 된다.
const missing = SLOTS.filter(({ source }) => !existsSync(path.join(srcDir, source)));
if (missing.length > 0) {
  console.error(`원본 ${missing.length}개를 찾지 못했습니다 (${path.resolve(srcDir)}):\n`);
  for (const { source } of missing) console.error(`  없음: ${source}`);
  console.error("");
  printSourceList();
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const tmp = mkdtempSync(path.join(tmpdir(), "bgm-"));

try {
  for (const { slot, source, loop } of SLOTS) {
    const pcmPath = path.join(tmp, `${slot}.wav`);
    const outWav = path.join(tmp, `${slot}-out.wav`);

    // 1) 원본을 스테레오 PCM으로 디코딩 (컨테이너·코덱 차이를 여기서 흡수한다)
    ffmpeg(["-i", path.join(srcDir, source), "-ac", "2", "-ar", String(SR), "-c:a", "pcm_s16le", pcmPath]);

    const { channels, sampleRate } = readWav(await readFile(pcmPath));
    const beforeFrames = channels[0].length;
    const beforeRms = overallRms(channels);

    let work = channels;
    let trimmedSec = 0;

    if (loop) {
      const musicEnd = findMusicEnd(work);
      if (musicEnd < work[0].length) {
        trimmedSec = (work[0].length - musicEnd) / sampleRate;
        work = work.map((ch) => ch.subarray(0, musicEnd));
      }
      work = seamlessLoop(work, Math.floor(sampleRate * CROSSFADE_SEC));
    }

    const { chans, gainDb, limited } = normalize(work);
    await writeFile(outWav, writeWav(chans, sampleRate));

    // 2) MP3 인코딩.
    //
    // Xing/LAME 헤더를 **반드시 남긴다**(libmp3lame 기본값). MP3는 인코딩 과정에서
    // 앞뒤에 패딩이 생기는데, 그 양이 이 헤더에 기록되어 디코더가 정확히 제거한다.
    // `-write_xing 0`으로 헤더를 빼면 디코더가 패딩을 그대로 재생해 루프 한 바퀴마다
    // 약 46ms의 무음이 끼어든다 — 실측: 헤더 제거 시 +2024샘플, 유지 시 +8샘플.
    // 위 크로스페이드로 이음매를 0.006 이하로 맞춰놓고 여기서 무음을 넣으면 헛수고다.
    ffmpeg(["-i", outWav, "-c:a", "libmp3lame", "-b:a", BITRATE, path.join(outDir, `${slot}.mp3`)]);

    const afterFrames = chans[0].length;
    const seam = loop ? Math.abs(chans[0][afterFrames - 1] - chans[0][0]).toFixed(5) : "-";
    console.log(
      `${slot.padEnd(8)} ${(beforeFrames / sampleRate).toFixed(1)}s → ${(afterFrames / sampleRate).toFixed(1)}s` +
        `${trimmedSec > 0 ? ` (꼬리 ${trimmedSec.toFixed(1)}s 제거)` : ""} | ` +
        `RMS ${gainToDb(beforeRms).toFixed(1)} → ${gainToDb(overallRms(chans)).toFixed(1)}dB ` +
        `(${gainDb >= 0 ? "+" : ""}${gainDb.toFixed(1)}dB${limited ? ", 피크 제한" : ""}) | 이음매 ${seam}`,
    );
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n출력: ${outDir}`);
