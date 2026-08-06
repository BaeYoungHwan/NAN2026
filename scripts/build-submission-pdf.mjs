/**
 * 제출물 문서(`docs/submission/*.md`)를 심사 제출용 PDF로 변환한다.
 *
 * 외부 의존성 0 — Node 표준 라이브러리와 이미 설치된 Chrome만 쓴다
 * (`scripts/generate-audio.mjs`와 같은 기조). pandoc·wkhtmltopdf·puppeteer는
 * 이 환경에 없고, PDF 세 장을 만들자고 빌드 의존성을 늘릴 이유가 없다.
 *
 * 흐름: 마크다운 → HTML(인쇄용 CSS 인라인) → Chrome `--print-to-pdf`.
 * 중간 HTML은 마크다운과 **같은 디렉터리**에 임시로 쓴다 — 문서가 참조하는
 * 스크린샷 상대 경로가 그대로 맞아야 하기 때문이다(끝나면 지운다).
 *
 * 사용법:
 *   node scripts/build-submission-pdf.mjs            # 3종 전부
 *   node scripts/build-submission-pdf.mjs game-intro # 지정한 것만
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "docs", "submission");
const OUT_DIR = join(SRC_DIR, "pdf");

/** Chrome 실행 경로 후보 — `CHROME_PATH`로 덮어쓸 수 있다. Edge도 같은 Chromium이라 대체 가능하다. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA ?? ""}/Google/Chrome/Application/chrome.exe`,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `Chrome을 찾지 못했다. CHROME_PATH 환경변수로 경로를 지정하라.\n확인한 경로:\n${CHROME_CANDIDATES.join("\n")}`,
    );
  }
  return found;
}

// ---------------------------------------------------------------------------
// 마크다운 → HTML
//
// 범용 파서가 아니라 **제출물 문서 3종이 실제로 쓰는 문법만** 다룬다:
// 헤딩, 인용, 표, 불릿/번호 목록(체크박스 포함), 코드블록, 수평선, 이미지, 문단.
// 문법을 늘릴 일이 생기면 여기에 블록 하나를 더하면 된다.
// ---------------------------------------------------------------------------

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 인라인 문법(`코드`, **강조**, *기울임*, [링크](url), 이미지)을 변환한다.
 *
 * 인라인 코드를 먼저 자리표시자로 빼내는 이유: 코드 안의 별표나 대괄호가
 * 강조·링크로 잘못 해석되면 안 된다(문서에 그런 조각이 실제로 등장한다).
 */
function renderInline(text) {
  const codes = [];
  let work = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000CODE${codes.length - 1}\u0000`;
  });

  work = escapeHtml(work);
  work = work.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}">`);
  work = work.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`);
  work = work.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  work = work.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  return work.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
}

/** 표 한 줄을 셀 배열로 — 양끝 파이프를 떼고 나눈다. */
function splitRow(line) {
  return line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

const CHECKBOX = { "[x]": "☑", "[X]": "☑", "[ ]": "☐" };

/** 목록 항목 본문 — 앞머리 체크박스는 유니코드 기호로 바꿔 인쇄물에서도 상태가 보이게 한다. */
function renderListItem(body) {
  const marked = body.replace(/^(\[[ xX]\])\s*/, (_, box) => `${CHECKBOX[box]} `);
  return renderInline(marked);
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 코드블록 — 내용은 어떤 변환도 하지 않는다.
    // 목록 항목 아래에 들여쓰기로 붙는 경우가 있어(게임소개 문서의 로컬 실행 절)
    // 줄 앞 공백을 허용하고, 여는 줄의 들여쓰기만큼을 본문에서도 걷어낸다.
    const fenceOpen = /^(\s*)```/.exec(line);
    if (fenceOpen) {
      const indent = fenceOpen[1].length;
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++].slice(indent));
      i++; // 닫는 ```
      out.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // 인용 — 연속된 `>` 줄을 한 블록으로 묶는다.
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${renderInline(body.join(" "))}</blockquote>`);
      continue;
    }

    // 표 — 헤더 줄 + 구분선(`|---|`)이 이어질 때만 표로 본다.
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const header = splitRow(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      const head = header.map((c) => `<th>${renderInline(c)}</th>`).join("");
      const body = rows
        .map((cells) => `<tr>${cells.map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`)
        .join("");
      out.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
      continue;
    }

    // 목록 — 들여쓰기 2칸 단위로 한 단계 중첩까지 지원한다(문서가 그 이상 쓰지 않는다).
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        const depth = Math.floor(m[1].length / 2);
        const content = renderListItem(m[3]);
        i++;
        // 이어지는 더 깊은 항목은 중첩 목록으로 감싼다.
        const children = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          const child = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
          if (Math.floor(child[1].length / 2) <= depth) break;
          children.push(`<li>${renderListItem(child[3])}</li>`);
          i++;
        }
        items.push(
          children.length > 0 ? `<li>${content}<ul>${children.join("")}</ul></li>` : `<li>${content}</li>`,
        );
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    // 문단 — 빈 줄이 나올 때까지 모은다.
    const paragraph = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|>|\||\s*```|---+\s*$)/.test(lines[i])) {
      paragraph.push(lines[i++]);
    }
    const text = paragraph.join(" ");
    // 이미지 한 장만 있는 문단은 캡션을 붙일 수 있게 figure로 감싼다.
    const loneImage = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(text.trim());
    if (loneImage) {
      const caption = loneImage[1] ? `<figcaption>${renderInline(loneImage[1])}</figcaption>` : "";
      out.push(`<figure><img src="${loneImage[2]}" alt="${escapeHtml(loneImage[1])}">${caption}</figure>`);
    } else {
      out.push(`<p>${renderInline(text)}</p>`);
    }
  }

  return out.join("\n");
}

/**
 * 인쇄용 CSS — 화면이 아니라 A4 종이가 기준이다.
 *
 * 폰트는 시스템 한글 폰트를 그대로 쓴다(맑은 고딕 계열). 웹폰트를 걸면 오프라인
 * 변환에서 로드 실패로 글자가 깨질 수 있고, 심사용 문서에 그런 위험을 둘 이유가 없다.
 * 표·이미지·코드블록이 페이지 경계에서 잘리지 않도록 `break-inside: avoid`를 건다.
 */
const PRINT_CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Malgun Gothic", "맑은 고딕", "Noto Sans KR", sans-serif;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #1a1a1a;
  }
  h1 { font-size: 20pt; margin: 0 0 4mm; padding-bottom: 3mm; border-bottom: 2px solid #2b2b2b; }
  h2 { font-size: 14pt; margin: 8mm 0 3mm; padding-left: 2.5mm; border-left: 4px solid #6b5b7b; break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 5mm 0 2mm; color: #3a3a3a; break-after: avoid; }
  p { margin: 0 0 3mm; }
  ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
  li { margin-bottom: 1mm; }
  li > ul { margin-top: 1mm; }
  blockquote {
    margin: 0 0 4mm;
    padding: 2.5mm 4mm;
    background: #f4f2f6;
    border-left: 3px solid #9a8aa8;
    color: #444;
    font-size: 9.5pt;
  }
  code {
    font-family: Consolas, "D2Coding", monospace;
    font-size: 9pt;
    background: #f0f0f2;
    padding: 0.3mm 1mm;
    border-radius: 2px;
  }
  pre {
    background: #f7f7f9;
    border: 1px solid #e0e0e4;
    border-radius: 3px;
    padding: 3mm;
    overflow: hidden;
    break-inside: avoid;
  }
  pre code { background: none; padding: 0; font-size: 8.5pt; line-height: 1.5; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 4mm;
    font-size: 9.5pt;
    break-inside: avoid;
  }
  th, td { border: 1px solid #d5d5da; padding: 1.8mm 2.5mm; text-align: left; vertical-align: top; }
  th { background: #efedf2; font-weight: 600; }
  hr { border: none; border-top: 1px solid #ddd; margin: 6mm 0; }
  a { color: #3a4a8a; text-decoration: none; word-break: break-all; }
  figure { margin: 0 0 4mm; text-align: center; break-inside: avoid; }
  img { max-width: 100%; border: 1px solid #ddd; border-radius: 3px; }
  figcaption { margin-top: 1.5mm; font-size: 9pt; color: #666; }
`;

function buildHtml(title, bodyHtml) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------

const chrome = findChrome();
const filter = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const targets = readdirSync(SRC_DIR)
  .filter((f) => f.endsWith(".md"))
  .filter((f) => filter.length === 0 || filter.some((name) => f === name || f === `${name}.md`));

if (targets.length === 0) {
  console.error(`변환할 문서가 없다 (${SRC_DIR}, 필터: ${filter.join(", ") || "없음"})`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`Chrome: ${chrome}\n`);

for (const file of targets) {
  const srcPath = join(SRC_DIR, file);
  const markdown = readFileSync(srcPath, "utf8");
  // 첫 h1을 문서 제목으로 쓴다 — PDF 메타데이터와 탭 제목에 들어간다.
  const title = (/^#\s+(.*)$/m.exec(markdown)?.[1] ?? file.replace(/\.md$/, "")).trim();

  const tmpHtml = join(SRC_DIR, `.${file}.print.html`);
  const outPdf = join(OUT_DIR, file.replace(/\.md$/, ".pdf"));
  writeFileSync(tmpHtml, buildHtml(title, markdownToHtml(markdown)), "utf8");

  try {
    execFileSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        // 기본 헤더/푸터에는 파일 URL과 변환 날짜가 찍힌다 — 제출물에 남길 정보가 아니다.
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=3000",
        `--print-to-pdf=${outPdf}`,
        pathToFileURL(tmpHtml).href,
      ],
      { stdio: "pipe" },
    );
  } finally {
    // KEEP_HTML=1이면 중간 HTML을 남긴다 — 레이아웃이 깨졌을 때 브라우저로 열어
    // 확인하려면 필요하다(PDF는 열어봐야 원인을 알기 어렵다).
    if (!process.env.KEEP_HTML) rmSync(tmpHtml, { force: true });
  }

  if (!existsSync(outPdf)) throw new Error(`PDF 생성 실패: ${file}`);
  const kb = (readFileSync(outPdf).length / 1024).toFixed(0);
  console.log(`  ${file} → pdf/${file.replace(/\.md$/, ".pdf")} (${kb} KB)`);
}

console.log(`\n완료 — ${OUT_DIR}`);
