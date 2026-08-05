// 1회성 개발 스크립트 — 저승사자 NPC 캐릭터 시트에서 대화창용 초상(portrait) 영역을 잘라낸다.
// scripts/crop-regions.mjs(플레이어 캐릭터용)와 같은 방식: 배경 플러드필 제거 + erase 사각형.
// 사용법:
//   node scripts/crop-reaper.mjs preview   → 추정 좌표에 라벨 박스를 얹은 미리보기 이미지 생성
//   node scripts/crop-reaper.mjs crop      → 실제로 영역을 잘라 배경 제거 후 저장

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// 원본 시트는 public/이 아니라 scripts/ 아래 둔다 — 플레이어 캐릭터 시트와 같은 이유
// (PR #9 리뷰 반영): 이 1회성 스크립트에서만 참조되고 런타임 게임 코드는 잘라낸
// 개별 PNG만 로드하므로, public/에 두면 Vite 빌드 시 dist에 그대로 복사되어
// 배포 용량만 늘어난다.
const SHEET_PATH = "scripts/저승사자캐릭터.png";
const OUT_DIR = "public/assets/characters";
const PREVIEW_PATH = "scripts/preview-reaper.png";

// { name, x, y, w, h } — 좌표는 반복 미리보기(ruler 오버레이)로 실측했다.
// "표정/반응 예시" 그리드(시트 우상단 박스) 1행 1열 "평상시(눈치)" 칸.
const REGIONS = [{ name: "reaper-portrait-neutral", x: 1021, y: 50, w: 122, h: 118 }];

async function preview() {
  const image = sharp(SHEET_PATH);
  const meta = await image.metadata();
  const rects = REGIONS.map(
    (r) =>
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="red" stroke-width="3"/>
       <text x="${r.x}" y="${r.y - 6}" font-size="20" fill="red">${r.name}</text>`,
  ).join("\n");
  const svg = `<svg width="${meta.width}" height="${meta.height}">${rects}</svg>`;
  await image.composite([{ input: Buffer.from(svg) }]).toFile(PREVIEW_PATH);
  console.log("preview written to", PREVIEW_PATH);
}

// 이 시트의 "표정/반응 예시" 박스 내부 배경색(크림) — 여러 지점에서 실측(약 [209,198,187]).
// 플레이어 캐릭터 시트([241,238,233])와 미묘하게 달라 별도로 고정값을 둔다.
const SHEET_BACKGROUND = [209, 198, 187];

// 코너 플러드필 배경 제거 — crop-regions.mjs와 동일한 로직.
function floodFillTransparent(data, width, height, channels, threshold = 40) {
  const bg = SHEET_BACKGROUND;
  const visited = new Uint8Array(width * height);
  const stack = [];
  const pushIfBg = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const o = idx * channels;
    const dist = Math.abs(data[o] - bg[0]) + Math.abs(data[o + 1] - bg[1]) + Math.abs(data[o + 2] - bg[2]);
    if (dist <= threshold) {
      visited[idx] = 1;
      stack.push([x, y]);
    }
  };
  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }
  while (stack.length) {
    const [x, y] = stack.pop();
    const idx = (y * width + x) * channels;
    data[idx + 3] = 0; // alpha = 0
    pushIfBg(x + 1, y);
    pushIfBg(x - 1, y);
    pushIfBg(x, y + 1);
    pushIfBg(x, y - 1);
  }
  return data;
}

// 크롭 영역이 타이트해서 가장자리에 배경 시드가 부족하면 플러드필이 안쪽까지 못 뚫는다 —
// crop-regions.mjs와 동일하게 여유를 두고 크롭한 뒤 플러드필하고, 완성 후 원래 크기로 되돌린다.
const EDGE_PADDING = 15;

function cropRaw(data, srcWidth, channels, left, top, width, height) {
  const out = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    const srcOffset = ((top + y) * srcWidth + left) * channels;
    const dstOffset = y * width * channels;
    data.copy(out, dstOffset, srcOffset, srcOffset + width * channels);
  }
  return out;
}

async function crop() {
  await mkdir(OUT_DIR, { recursive: true });
  const sheetMeta = await sharp(SHEET_PATH).metadata();
  for (const r of REGIONS) {
    const padLeft = Math.min(EDGE_PADDING, r.x);
    const padTop = Math.min(EDGE_PADDING, r.y);
    const padRight = Math.min(EDGE_PADDING, sheetMeta.width - (r.x + r.w));
    const padBottom = Math.min(EDGE_PADDING, sheetMeta.height - (r.y + r.h));

    const extractLeft = r.x - padLeft;
    const extractTop = r.y - padTop;
    const extractWidth = r.w + padLeft + padRight;
    const extractHeight = r.h + padTop + padBottom;

    const { data, info } = await sharp(SHEET_PATH)
      .extract({ left: extractLeft, top: extractTop, width: extractWidth, height: extractHeight })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    floodFillTransparent(data, info.width, info.height, info.channels);

    const trimmed = cropRaw(data, info.width, info.channels, padLeft, padTop, r.w, r.h);

    const outPath = path.join(OUT_DIR, `${r.name}.png`);
    await sharp(trimmed, { raw: { width: r.w, height: r.h, channels: info.channels } }).png().toFile(outPath);
    console.log("wrote", outPath);
  }
}

const mode = process.argv[2];
if (mode === "preview") await preview();
else if (mode === "crop") await crop();
else console.log("usage: node scripts/crop-reaper.mjs <preview|crop>");
