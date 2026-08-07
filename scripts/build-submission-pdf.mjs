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

    // 인용 — 연속된 `>` 줄을 한 블록으로 묶되, 줄바꿈은 살린다.
    //
    // 마크다운 표준대로 공백으로 이으면 문서 머리말이 "제출 마감 2026-08-10 작성:
    // 배영환·송원호 ... 최종 갱신: 2026-08-07 대상 게임: ..."처럼 한 줄로 뭉쳐 어디서
    // 끊어 읽어야 할지 알 수 없게 된다. 제출물 3종의 인용 블록은 전부 한 줄에 하나씩
    // 독립된 정보(마감일·작성자·대상)를 싣는 용도라 원문의 줄 구분이 곧 의미다.
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      const rendered = body
        .map((l) => renderInline(l))
        .filter((l) => l.trim() !== "")
        .join("<br>");
      out.push(`<blockquote>${rendered}</blockquote>`);
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
  /* 여백은 넉넉하게 — 심사자가 한 번에 여러 문서를 읽으므로 빽빽한 지면이 가장 빨리
     피로해진다. A4에서 좌우 20mm면 한 줄이 대략 40~45자로 떨어져 눈이 편하다. */
  @page { size: A4; margin: 20mm 20mm 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Malgun Gothic", "맑은 고딕", "Noto Sans KR", sans-serif;
    font-size: 10.5pt;
    line-height: 1.75;
    color: #22212a;
    word-break: keep-all;
    overflow-wrap: break-word;
  }

  /* 제목 계층 — 색·크기·여백을 함께 움직여 h1 > h2 > h3가 한눈에 갈리게 한다.
     색은 게임 세계관(그림자·저승)에 맞춘 보라 계열로 통일. */
  h1 {
    font-size: 21pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #2d2438;
    margin: 0 0 6mm;
    padding-bottom: 4mm;
    border-bottom: 1px solid #cfc6da;
  }
  h2 {
    font-size: 14pt;
    font-weight: 700;
    color: #4c3d63;
    margin: 10mm 0 4mm;
    padding-bottom: 1.5mm;
    border-bottom: 1px solid #e2dceb;
    break-after: avoid;
  }
  h3 {
    font-size: 11.5pt;
    font-weight: 600;
    color: #5f5175;
    margin: 6mm 0 2.5mm;
    break-after: avoid;
  }
  h2 + h3 { margin-top: 3mm; }

  p { margin: 0 0 3.5mm; }
  strong { font-weight: 700; color: #191824; }

  ul, ol { margin: 0 0 3.5mm; padding-left: 6.5mm; }
  li { margin-bottom: 1.5mm; padding-left: 0.5mm; }
  li::marker { color: #8878a0; }
  li > ul, li > ol { margin-top: 1.5mm; margin-bottom: 0; }

  /* 문서 머리말(제목 바로 밑 인용구)은 본문 인용과 역할이 달라 따로 잡는다 —
     제출 마감·작성자·대상 게임을 싣는 자리라 눈에 먼저 들어와야 한다. */
  blockquote {
    margin: 0 0 5mm;
    padding: 3mm 4.5mm;
    background: #f6f4f9;
    border-left: 3px solid #9a8aa8;
    border-radius: 0 2px 2px 0;
    color: #4a4658;
    font-size: 9.5pt;
    line-height: 1.7;
  }
  h1 + blockquote {
    background: #f3f0f8;
    border-left-width: 4px;
    color: #3d3850;
  }

  code {
    font-family: Consolas, "D2Coding", monospace;
    font-size: 8.8pt;
    background: #f1eff5;
    color: #4a3f5c;
    padding: 0.4mm 1.2mm;
    border-radius: 2px;
    word-break: break-all;
  }
  pre {
    background: #f8f7fa;
    border: 1px solid #e4e0ea;
    border-radius: 3px;
    padding: 3.5mm 4mm;
    margin: 0 0 4mm;
    overflow: hidden;
    break-inside: avoid;
  }
  pre code { background: none; color: #2f2a3a; padding: 0; font-size: 8.5pt; line-height: 1.6; }

  /* 표 — 세로 괘선을 지우고 가로선만 남긴다. 칸을 격자로 가두는 것보다 행이 따라
     읽히고, 열 경계는 패딩만으로 충분히 구분된다. */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 5mm;
    font-size: 9.5pt;
    line-height: 1.6;
    break-inside: avoid;
  }
  thead th {
    background: #efebf5;
    color: #3b3149;
    font-weight: 700;
    border-bottom: 1.5px solid #b9aecb;
  }
  /* word-break: keep-all(body 상속) — 한국어 기본 줄바꿈은 글자 단위라 좁은 열에서
     "그림자 경/계 판정 방/식"처럼 어절 한가운데가 잘린다. 어절 단위로만 끊는다. */
  th, td {
    padding: 2.2mm 3mm;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid #e6e2ec;
  }
  tbody tr:nth-child(even) { background: #faf9fc; }
  tbody tr:last-child td { border-bottom: 1px solid #cfc6da; }

  hr { border: none; border-top: 1px solid #e2dceb; margin: 8mm 0; }
  /* break-all은 본문에 그대로 노출되는 긴 URL을 위한 것이다. 표 첫 열의 링크는
     대개 "ADR-001" 같은 짧은 식별자라, 같은 규칙을 두면 하이픈에서 "ADR-/001"로
     쪼개진다 — 열 폭을 넓히는 것보다 그 열만 끊지 않게 막는 편이 확실하다. */
  a { color: #4a3f8a; text-decoration: none; word-break: break-all; }
  td:first-child a { white-space: nowrap; }

  figure { margin: 0 0 5mm; text-align: center; break-inside: avoid; }
  img { max-width: 100%; border: 1px solid #ddd8e4; border-radius: 3px; }
  figcaption { margin-top: 2mm; font-size: 9pt; color: #6b6578; line-height: 1.6; }
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
