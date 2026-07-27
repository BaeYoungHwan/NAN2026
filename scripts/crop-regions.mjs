// 1회성 개발 스크립트 — 캐릭터 시트에서 개별 스프라이트 영역을 잘라낸다.
// 사용법:
//   node scripts/crop-regions.mjs preview   → 추정 좌표에 라벨 박스를 얹은 미리보기 이미지 생성
//   node scripts/crop-regions.mjs crop      → 실제로 각 영역을 잘라 배경 제거 후 저장

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// 원본 시트는 public/이 아니라 scripts/ 아래 둔다 — 이 1회성 스크립트에서만
// 참조되고 런타임 게임 코드는 잘라낸 개별 PNG만 로드하므로, public/에 두면
// Vite 빌드 시 dist에 그대로 복사되어 배포 용량만 늘어난다(PR #9 리뷰 반영).
const SHEET_PATH = "scripts/게임캐릭터.png";
const OUT_DIR = "public/assets/characters";
const PREVIEW_PATH = "scripts/preview.png";

// { name, x, y, w, h } — 좌표는 반복 미리보기로 조정한다.
const REGIONS = [
  // 기본형(정면) — 캐릭터 idle 몸 포즈로 사용 ("기본형"/"정면" 라벨 제외)
  { name: "body-idle", x: 540, y: 78, w: 155, h: 325 },

  // 그림자 표정 6종 (2행 3열)
  { name: "face-normal", x: 1005, y: 70, w: 125, h: 130 },
  { name: "face-surprised", x: 1145, y: 70, w: 125, h: 130 },
  { name: "face-scared", x: 1275, y: 70, w: 120, h: 130 },
  { name: "face-annoyed", x: 1005, y: 235, w: 125, h: 130 },
  { name: "face-disappointed", x: 1145, y: 235, w: 125, h: 130 },
  { name: "face-delighted", x: 1275, y: 235, w: 120, h: 130 },

  // 동작 예시 6종 (1행 6열) — 눈금자 오버레이로 실측한 좌표 (위험/즉사는 간격이 거의 없어 특히 주의)
  // erase: 캐릭터 실루엣과 분리된 장식 요소(머리 옆 잉크 방울 등)를 별도로
  // 지운다 — 작은 렌더 크기에서 "줄무늬"처럼 보인다는 피드백 반영.
  // erase에 바닥 그림자 타원(x548~638,y597~611)도 추가 — 게임 자체의 동적
  // 그림자 시스템과 별개로 정적 그림자가 겹쳐 보이는 것을 막는다.
  { name: "body-idle-pose", x: 548, y: 432, w: 105, h: 181, erase: [
    { x: 608, y: 438, w: 40, h: 60 },
    { x: 548, y: 597, w: 90, h: 14 },
  ] },
  // 뒷발이 x~660까지 나가 있어 잘렸었고, 오른쪽은 옆 포즈("달리기")의 속도선이
  // 넘어와 있어 손보다 조금 안쪽에서 끊는다. 머리 옆 잉크 방울과 바닥 그림자도 지운다.
  { name: "body-walk", x: 655, y: 413, w: 103, h: 200, erase: [
    { x: 705, y: 455, w: 35, h: 30 },
    { x: 705, y: 598, w: 55, h: 12 },
  ] },
  // 뻗은 팔·뒷다리 발끝이 x~763까지 나가 있어 왼쪽으로 넓히고, 원본에 박힌
  // 정지용 속도선·바닥 그림자 타원(컷아웃 리깅 시절 body-run-torso/legs에서
  // 지웠던 것과 동일 위치)도 함께 지운다.
  { name: "body-run", x: 760, y: 413, w: 143, h: 200, erase: [
    { x: 793, y: 472, w: 40, h: 18 },
    { x: 762, y: 496, w: 68, h: 8 },
    { x: 768, y: 516, w: 25, h: 8 },
    { x: 775, y: 533, w: 60, h: 12 },
    { x: 783, y: 576, w: 105, h: 10 },
    { x: 793, y: 586, w: 75, h: 10 },
    { x: 778, y: 598, w: 80, h: 12 },
    { x: 896, y: 598, w: 6, h: 12 },
  ] },
  // 달리기 포즈를 다리/몸통으로 분리한 컷아웃 리깅용 — 코트 밑단(y≈550)을 기준으로 자른다.
  // 몸통(코트+팔+머리, 다리 없이 정적으로 유지)과 다리(엉덩이 지점 기준으로 회전 애니메이션).
  // erase: 시트 원본의 "달리는 속도선(모션 블러)"은 다리·엉덩이 축을 기준으로
  // 매 프레임 회전하는 컷아웃 애니메이션과 같이 돌아가버려서, 고정된 속도선이
  // 다리처럼 앞뒤로 흔들리는 부자연스러운 모습이 됐다 — 제거.
  // 뻗은 팔(주먹)이 x~763까지 나가 있어 x793 시작으로는 손이 잘렸다 — 왼쪽으로 넓힘.
  { name: "body-run-torso", x: 760, y: 413, w: 143, h: 142, erase: [
    { x: 793, y: 472, w: 40, h: 18 },
    { x: 762, y: 496, w: 68, h: 8 },
    { x: 768, y: 516, w: 25, h: 8 },
    { x: 775, y: 533, w: 60, h: 12 },
  ] },
  // erase에 x778~898,y596~610도 추가 — 원본 그림에 박혀있던 바닥 그림자
  // 타원(정적 일러스트용)이 다리 스윙 회전에 같이 딸려가 진짜 게임 그림자와
  // 별개로 이상하게 흔들리는 가짜 그림자처럼 보였다.
  // 바닥 그림자 타원 erase는 앞발(약 x862~896, y598~607)과 겹쳐서 발 끝이
  // 같이 잘려나갔었다 — 발이 있는 구간은 피하고 좌우로만 나눠서 지운다.
  { name: "body-run-legs", x: 780, y: 543, w: 123, h: 70, erase: [
    { x: 783, y: 576, w: 105, h: 10 },
    { x: 793, y: 586, w: 75, h: 10 },
    { x: 778, y: 598, w: 80, h: 12 },
    { x: 896, y: 598, w: 6, h: 12 },
  ] },
  { name: "body-flinch", x: 935, y: 405, w: 95, h: 210, erase: [
    { x: 933, y: 418, w: 45, h: 58 },
    { x: 933, y: 600, w: 95, h: 14 },
  ] },
  { name: "body-danger", x: 1050, y: 410, w: 100, h: 200, erase: [
    { x: 1053, y: 595, w: 95, h: 14 },
  ] },
  { name: "body-death-pose", x: 1150, y: 410, w: 195, h: 195 },

  // 죽음 모션 4단계 — 눈금자 오버레이로 실측한 좌표(정령/후광 포함, 캡션 제외).
  // erase: 번호 배지(①~④)·"!!" 표시 등 캐릭터와 무관한 캡션 요소 — 작은 렌더
  // 크기에서 줄무늬/잔여물처럼 보인다는 피드백으로 제거.
  { name: "death1", x: 5, y: 690, w: 160, h: 195, erase: [{ x: 5, y: 690, w: 60, h: 55 }, { x: 135, y: 695, w: 35, h: 60 }] },
  { name: "death2", x: 160, y: 658, w: 160, h: 222, erase: [{ x: 160, y: 650, w: 20, h: 45 }, { x: 200, y: 705, w: 80, h: 70 }] },
  { name: "death3", x: 320, y: 658, w: 165, h: 222, erase: [{ x: 365, y: 700, w: 70, h: 75 }] },
  { name: "death4", x: 495, y: 690, w: 150, h: 180, erase: [{ x: 515, y: 695, w: 80, h: 55 }] },
];

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

// 시트의 실제 페이지 배경색(크림색) — 여러 안전 지점에서 실측 확인함. 크롭마다 모서리
// 픽셀에서 배경색을 다시 추출하면, 크롭이 헤더의 검은 라벨 박스 등과 겹칠 때 배경색 자체를
// 잘못(검게) 판단해 플러드필이 통째로 실패하는 버그가 있었다(예: face-surprised) — 고정값으로 통일.
const SHEET_BACKGROUND = [241, 238, 233];

// 코너 플러드필 배경 제거 — 네 모서리에서 시작해 배경색과 유사한 픽셀을 투명 처리.
// 잉크 아웃라인이 경계 역할을 하므로 아웃라인 안쪽(예: 흰 옷 내부)은 배경과 색이 같아도 보존된다.
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

// 크롭 영역이 타이트해서 팔·다리 등이 가장자리에 닿으면, 그 변에는 배경색 시드가 없어
// 플러드필이 안쪽 배경 웅덩이까지 못 뚫는 문제가 있었다(예: body-idle-pose 하단부 전체가
// 불투명으로 남음). 네 변에 배경이 확실히 남도록 여유를 두고 크롭한 뒤 플러드필을 돌리고,
// 완성된 후 원래 의도한 타이트한 영역만 다시 잘라낸다 — 옆 포즈 침범 없이 시딩 문제만 해결.
const EDGE_PADDING = 25;

// 캐릭터 실루엣과 붙어있지 않은 장식 요소(잉크 방울, 말풍선 등)는 배경색이
// 아니라 플러드필이 지우지 못한다 — 시트 좌표 기준 사각형을 지정해 강제로
// 투명 처리한다. extractLeft/Top 기준 로컬 좌표로 변환해서 지운다.
function eraseRegions(data, width, height, channels, extractLeft, extractTop, eraseRects = []) {
  for (const er of eraseRects) {
    const x0 = Math.max(0, er.x - extractLeft);
    const y0 = Math.max(0, er.y - extractTop);
    const x1 = Math.min(width, er.x - extractLeft + er.w);
    const y1 = Math.min(height, er.y - extractTop + er.h);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        data[(y * width + x) * channels + 3] = 0;
      }
    }
  }
}

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
    eraseRegions(data, info.width, info.height, info.channels, extractLeft, extractTop, r.erase);

    // 시딩용으로 넉넉히 잡았던 여백을 다시 잘라내 원래 의도한 타이트한 크기로 복원.
    const trimmed = cropRaw(data, info.width, info.channels, padLeft, padTop, r.w, r.h);

    const outPath = path.join(OUT_DIR, `${r.name}.png`);
    await sharp(trimmed, { raw: { width: r.w, height: r.h, channels: info.channels } }).png().toFile(outPath);
    console.log("wrote", outPath);
  }
}

const mode = process.argv[2];
if (mode === "preview") await preview();
else if (mode === "crop") await crop();
else console.log("usage: node scripts/crop-regions.mjs <preview|crop>");
