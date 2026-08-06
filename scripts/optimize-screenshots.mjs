/**
 * 제출물 문서에 넣을 스크린샷(`docs/submission/screenshots/*.png`)을 레포에 담을
 * 크기로 줄인다 — 브라우저에서 찍은 원본은 장당 900KB 안팎이라 다섯 장이면 4.6MB다.
 *
 * 폭 1100px은 A4 본문 폭(약 178mm)에 300dpi 근처로 들어가는 크기다 — 인쇄물에서
 * 더 키워도 눈에 띄는 이득이 없고, GitHub 문서에서 보기에도 충분하다.
 * 팔레트 PNG(256색)로 저장하는 이유는 화면이 어두운 단색조라 색 손실이 거의
 * 보이지 않으면서 용량이 크게 줄기 때문이다.
 *
 * 스크린샷을 다시 찍으면(밸런스 확정 후 재촬영 예정) 이 스크립트를 한 번 더 돌린다.
 * 이미 줄인 파일에 다시 돌려도 폭은 그대로 유지된다(`withoutEnlargement`).
 *
 * 사용법: node scripts/optimize-screenshots.mjs
 */
import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "docs", "submission", "screenshots");
const TARGET_WIDTH = 1100;

const files = readdirSync(DIR).filter((f) => f.endsWith(".png"));
if (files.length === 0) {
  console.error(`스크린샷이 없다 (${DIR})`);
  process.exit(1);
}

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const path = join(DIR, file);
  const before = statSync(path).size;
  // sharp는 같은 파일을 읽으면서 쓸 수 없으므로 버퍼를 거쳐 덮어쓴다.
  const buffer = await sharp(path)
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  await sharp(buffer).toFile(path);
  const after = statSync(path).size;
  totalBefore += before;
  totalAfter += after;
  console.log(`  ${file}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`);
}

console.log(
  `\n합계 ${(totalBefore / 1024 / 1024).toFixed(2)}MB → ${(totalAfter / 1024 / 1024).toFixed(2)}MB`,
);
