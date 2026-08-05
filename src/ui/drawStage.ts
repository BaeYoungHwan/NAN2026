import type { Stage } from "../core/stage";
import { ROUND_BACKGROUND_BRIGHTNESS, type Round } from "../core/round";

/**
 * `#rrggbb` 헥스 문자열을 `"r, g, b"` 콤마 구분 문자열로 변환한다 —
 * `rgba(${...}, alpha)` 템플릿에 그대로 끼워 넣기 위함. 촛불 색을 hex 하나로만
 * 받고 여기서 rgb를 파생시켜, 두 표현을 따로 넘기다 하나만 바뀌어 어긋나는
 * 실수를 구조적으로 막는다. `#rrggbb`(6자리) 형식만 지원 — 호출부가 전부 이
 * 파일 안의 하드코딩 리터럴이라 실사용 위험은 없지만, `#fff` 같은 축약형이
 * 들어오면 조용히 틀린 값을 내므로 방어적으로 걸러낸다.
 */
export function hexToRgbString(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    console.warn(`hexToRgbString: "#rrggbb" 형식이 아님 — ${hex}`);
    return "255, 255, 255";
  }
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 0xff}, ${(value >> 8) & 0xff}, ${value & 0xff}`;
}

/**
 * dusk(세로 그라디언트)·vignette(방사형 그라디언트)는 mapWidth/mapHeight로만
 * 결정되는데, 이 값은 stage가 바뀌기 전까지 상수다 — 그런데도 매 프레임(rAF)
 * `createLinearGradient`/`createRadialGradient`를 새로 호출하고 있었다(PR #17
 * 리뷰). `wallLayerCache`와 같은 이유로 같은 패턴을 적용한다: `CanvasGradient`는
 * 그걸 만든 컨텍스트에 종속되지 않으므로(Path2D처럼 이식 가능한 객체) stage당
 * 한 번만 만들어 WeakMap에 캐싱해도 안전하다.
 */
const atmosphereCache = new WeakMap<Stage, { dusk: CanvasGradient; vignette: CanvasGradient }>();

function buildAtmosphere(
  ctx: CanvasRenderingContext2D,
  mapWidth: number,
  mapHeight: number,
): { dusk: CanvasGradient; vignette: CanvasGradient } {
  const dusk = ctx.createLinearGradient(0, 0, 0, mapHeight);
  dusk.addColorStop(0, "rgba(24, 18, 36, 0.6)");
  dusk.addColorStop(0.55, "rgba(12, 9, 18, 0.55)");
  dusk.addColorStop(1, "rgba(5, 4, 8, 0.62)");

  const vignette = ctx.createRadialGradient(
    mapWidth / 2,
    mapHeight / 2,
    mapHeight * 0.25,
    mapWidth / 2,
    mapHeight / 2,
    mapHeight * 0.75,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.4)");

  return { dusk, vignette };
}

/**
 * 바닥 실사 타일(`tile-art-prompt-guide.md` 프롬프트로 생성한 seamless 정사각
 * 텍스처)을 맵 전체에 반복(pattern) 렌더링한다. 원본 이미지를 그대로
 * `createPattern`하면 이미지 자체 해상도(512px, 배포 용량 때문에 원본 1254px에서
 * 리사이즈함 — PR #20 리뷰 반영)로 반복돼 40px 그리드 셀 하나보다 텍스처 조각
 * 하나가 훨씬 커져버린다 — `ctx.scale`로 좌표계 자체를 줄인 다음 그 안에서
 * 패턴을 채워, 실제 셀 크기에 맞는 밀도로 반복되게 한다.
 * FLOOR_TILE_SCALE=0.392는 원본의 낱장 판석 무늬가 그리드 1칸(40px)에 대략
 * 하나씩 오도록 1254px 기준 실측한 값(0.16)을, 리사이즈 비율(512/1254)만큼
 * 반비례로 보정한 것 — 이미지를 줄인 만큼 스케일을 키워야 화면상 반복 주기가
 * 그대로 유지된다.
 */
const FLOOR_TILE_SCALE = 0.392;

let floorTileLayer: { canvas: HTMLCanvasElement; tile: HTMLImageElement; width: number; height: number } | null = null;

function buildFloorTileLayer(mapWidth: number, mapHeight: number, floorTile: HTMLImageElement): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = mapWidth;
  layer.height = mapHeight;
  const ctx = layer.getContext("2d");
  if (!ctx) return layer;

  const pattern = ctx.createPattern(floorTile, "repeat");
  if (!pattern) return layer;

  ctx.save();
  ctx.scale(FLOOR_TILE_SCALE, FLOOR_TILE_SCALE);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, mapWidth / FLOOR_TILE_SCALE, mapHeight / FLOOR_TILE_SCALE);
  ctx.restore();

  return layer;
}

/**
 * 바닥 배경(`stage.png`)이 맵 전체에 사진 한 장으로 통째로 늘어나 있어(타일링
 * 없음), 통로가 어디로 꺾이든 항상 같은 느낌이라 밋밋하다는 피드백 — 실사 타일
 * 이미지가 준비되기 전까지(tile-art-prompt-guide.md 참고), 코드만으로 "닳은
 * 콘크리트" 특유의 미세한 알갱이(grain)를 얹어 질감을 보강했었다. 실사 타일이
 * 로드되면 이 절차적 레이어는 건너뛴다(drawStage 참고) — 타일 자체에 이미
 * 풍화·균열 질감이 있어서 같이 쓰면 서로 다른 스케일의 무늬가 겹쳐 오히려
 * 지저분해진다. 결정론적 해시로 고정된 반점 배치를 그리므로 프레임마다
 * 위치가 흔들리지 않는다. 맵 크기(800×600)가 `GRID_COLS`/`GRID_ROWS`/`TILE_SIZE`로
 * 항상 고정이라 stage와 무관하게 한 번만 그려 재사용한다(크기가 바뀌는 경우를
 * 대비해 방어적으로 재생성 체크는 한다).
 */
let floorGrainLayer: HTMLCanvasElement | null = null;

function grainHash(n: number): number {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * 두 점을 잇는 직선 대신, 수직 방향으로 살짝(±1.5px) 흔들리는 꺾인 선을 그린다 —
 * 판석 이음매가 자로 그은 듯 완벽히 곧으면 오히려 "무늬"처럼 보여 바닥사진과
 * 어긋난다. seed가 같으면 항상 같은 흔들림을 재현한다(결정론적).
 */
function strokeJitteredLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const SEGMENTS = 5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let s = 1; s <= SEGMENTS; s++) {
    const t = s / SEGMENTS;
    const jitter = (grainHash(seed + s * 3.77) - 0.5) * 3;
    ctx.lineTo(x1 + dx * t + nx * jitter, y1 + dy * t + ny * jitter);
  }
  ctx.stroke();
}

/**
 * 큰 스케일의 불규칙 판석(flagstone) — 반점·얼룩·실금은 전부 "노이즈"라 아무리
 * 겹쳐도 결국 균일한 잡음으로 읽혀 여전히 밋밋하다는 피드백(사용자 지적).
 * 이건 노이즈가 아니라 구조다: 벽돌쌓기처럼 행마다 어긋나는 큰 판석 격자를
 * 잡고, (1) 판석마다 서로 다른 톤 + 은은한 중심 볼록감(bulge)을 깔아 "낱장
 * 돌판을 이어붙인 바닥"이라는 재질감을 만든 다음, (2) 그 경계를 살짝
 * 흔들리는 선(어두운 홈 + 밝은 rim 1px)으로 그어 이음매를 드러낸다 — 벽의
 * 베벨+AO 쌍과 같은 시각 언어를 재사용해 게임 전체 톤과 일관된다.
 */
function buildPavingSeams(ctx: CanvasRenderingContext2D, mapWidth: number, mapHeight: number): void {
  const rowYs: number[] = [0];
  let y = 0;
  let ri = 0;
  while (y < mapHeight) {
    y += 85 + grainHash(ri * 41.7 + 300) * 55;
    rowYs.push(Math.min(y, mapHeight));
    ri++;
  }

  // 행마다 열 경계를 미리 계산해 채우기·이음매 두 패스가 같은 격자를 쓰게 한다
  // (따로 계산하면 해시 시퀀스가 어긋나 채우기와 선이 안 맞을 위험이 있다).
  const rowCols: number[][] = [];
  for (let r = 0; r < rowYs.length - 1; r++) {
    const cols = [-(grainHash(r * 19.3 + 500) * 100)];
    let x = cols[0];
    let ci = 0;
    while (x < mapWidth) {
      x += 80 + grainHash(r * 31.1 + ci * 13.7 + 501) * 60;
      cols.push(x);
      ci++;
    }
    rowCols.push(cols);
  }

  // (1) 판석별 톤 차이 + 중심 볼록감 — 각 판석을 살짝 다른 밝기로 채우고,
  // 중심에 은은한 밝은 그라디언트를 얹어 평평한 색면이 아니라 미세하게
  // 볼록한 돌판처럼 보이게 한다.
  for (let r = 0; r < rowCols.length; r++) {
    const top = rowYs[r];
    const bottom = rowYs[r + 1];
    const cols = rowCols[r];
    for (let c = 0; c < cols.length - 1; c++) {
      const left = Math.max(0, cols[c]);
      const right = Math.min(mapWidth, cols[c + 1]);
      if (right <= left) continue;
      const seed = r * 97.3 + c * 13.1 + 600;
      const isDark = grainHash(seed) < 0.5;
      const alpha = 0.03 + grainHash(seed + 1) * 0.06;
      const tone = isDark ? "50, 44, 36" : "170, 158, 138";
      ctx.fillStyle = `rgba(${tone}, ${alpha.toFixed(3)})`;
      ctx.fillRect(left, top, right - left, bottom - top);

      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      const bulgeAlpha = 0.025 + grainHash(seed + 2) * 0.035;
      const radius = Math.max(right - left, bottom - top) * 0.55;
      const bulge = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      bulge.addColorStop(0, `rgba(190, 178, 156, ${bulgeAlpha.toFixed(3)})`);
      bulge.addColorStop(1, "rgba(190, 178, 156, 0)");
      ctx.fillStyle = bulge;
      ctx.fillRect(left, top, right - left, bottom - top);
    }
  }

  // (2) 이음매 — 위에서 계산한 같은 격자(rowYs/rowCols)를 그대로 재사용한다.
  const drawSeam = (x1: number, y1: number, x2: number, y2: number, seed: number): void => {
    ctx.strokeStyle = "rgba(30, 25, 20, 0.24)";
    ctx.lineWidth = 1;
    strokeJitteredLine(ctx, x1, y1, x2, y2, seed);
    ctx.save();
    ctx.translate(0.7, 0.7);
    ctx.strokeStyle = "rgba(175, 163, 142, 0.13)";
    strokeJitteredLine(ctx, x1, y1, x2, y2, seed);
    ctx.restore();
  };

  for (let r = 1; r < rowYs.length - 1; r++) {
    drawSeam(0, rowYs[r], mapWidth, rowYs[r], r * 7.1 + 400);
  }

  for (let r = 0; r < rowCols.length; r++) {
    const cols = rowCols[r];
    for (let c = 1; c < cols.length - 1; c++) {
      drawSeam(cols[c], rowYs[r], cols[c], rowYs[r + 1], r * 23.9 + c * 5.3 + 502);
    }
  }
}

function buildFloorGrain(mapWidth: number, mapHeight: number): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = mapWidth;
  layer.height = mapHeight;
  const ctx = layer.getContext("2d");
  if (!ctx) return layer;

  // 반점만 겹겹이 쌓는 건 결국 다 "노이즈"라 아무리 늘려도 균일하게 읽혀
  // 여전히 밋밋하다는 피드백(사용자 지적) — 노이즈가 아니라 구조를 먼저 깔고
  // (판석 이음매), 그 위에 노이즈 세 겹(풍화 얼룩·미세 반점·실금)을 얹는다.
  // 색은 전부 배경 사진 실측 평균색(round1.png ≈ rgb(125,112,91))보다 살짝
  // 어둡거나 밝은 무채색 계열로만 — 새 색을 들이면 사진과 어긋나 보인다.

  // (0) 판석 이음매 — 구조. 자세한 이유는 buildPavingSeams 주석 참고.
  buildPavingSeams(ctx, mapWidth, mapHeight);

  // (1) 풍화 얼룩 — 반경 20~55px 부드러운 방사형 그라디언트를 성기게 흩뿌려
  // 반점보다 훨씬 큰 스케일의 톤 변화를 준다.
  const PATCH_COUNT = 34;
  for (let i = 0; i < PATCH_COUNT; i++) {
    const x = grainHash(i * 53.219 + 100) * mapWidth;
    const y = grainHash(i * 91.113 + 101) * mapHeight;
    const radius = 20 + grainHash(i * 17.881 + 102) * 35;
    const isDark = grainHash(i * 63.917 + 103) < 0.5;
    const alpha = 0.05 + grainHash(i * 29.483 + 104) * 0.08;
    const tone = isDark ? "55, 47, 38" : "180, 168, 146";
    const patch = ctx.createRadialGradient(x, y, 0, x, y, radius);
    patch.addColorStop(0, `rgba(${tone}, ${alpha.toFixed(3)})`);
    patch.addColorStop(1, `rgba(${tone}, 0)`);
    ctx.fillStyle = patch;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // (2) 미세 반점 — 얼룩 위에 촘촘히 얹어 입자감을 준다. 이전보다 대비를 살짝 키움.
  const SPECK_COUNT = 1400;
  for (let i = 0; i < SPECK_COUNT; i++) {
    const x = grainHash(i * 12.9898) * mapWidth;
    const y = grainHash(i * 78.233 + 1) * mapHeight;
    const radius = 0.5 + grainHash(i * 37.719 + 2) * 1.3;
    const isDark = grainHash(i * 91.345 + 3) < 0.55;
    const alpha = 0.04 + grainHash(i * 15.732 + 4) * 0.09;
    ctx.fillStyle = isDark ? `rgba(60, 52, 42, ${alpha.toFixed(3)})` : `rgba(175, 163, 142, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // (3) 실금 — tile-art-prompt-guide.md가 바닥 재질로 명시한 "faint cracks"를
  // 짧고 불규칙한 꺾인 선 여러 개로 성기게 흩뿌린다. 전에 벽에 시도했다가
  // "안 어울린다"고 반려된 건 벽 경계 전체를 훑는 촘촘한 균열/네온 경계
  // 모티프였다 — 이건 그것과 달리 낱개로 흩어진 짧은 포장재 균열이고, 색도
  // 배경 사진 톤 안에서만 쓴다.
  const CRACK_COUNT = 20;
  ctx.strokeStyle = "rgba(35, 30, 24, 0.3)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < CRACK_COUNT; i++) {
    let x = grainHash(i * 71.234 + 200) * mapWidth;
    let y = grainHash(i * 44.556 + 201) * mapHeight;
    let angle = grainHash(i * 19.77 + 203) * Math.PI * 2;
    const segments = 3 + Math.floor(grainHash(i * 12.1 + 202) * 3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < segments; s++) {
      angle += (grainHash(i * 33.1 + s * 7.7 + 204) - 0.5) * 1.4;
      const len = 4 + grainHash(i * 5.5 + s * 3.3 + 205) * 8;
      x += Math.cos(angle) * len;
      y += Math.sin(angle) * len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  return layer;
}

/**
 * 벽 채우기+AO+베벨 레이어를 오프스크린 캔버스 한 장에 미리 그려둔다. 이 그리드는
 * 라운드 전환 전까지 절대 바뀌지 않는데, 이 계산(300셀 순회 3회 + Path2D 생성)을
 * 매 프레임(rAF, ~60fps) 다시 하고 있었다 — `GameCanvas.tsx`의 `colliderCacheRef`가
 * 이미 쓰고 있는 "stage 참조가 바뀔 때만 재계산" 패턴을 여기도 맞춘다. `stage`
 * 객체별로 캐싱하므로(WeakMap) 라운드가 바뀌어 새 Stage가 만들어지면 자동으로
 * 새로 그려지고, 이전 캔버스는 참조가 끊겨 GC된다.
 */
/**
 * 벽 실사 타일 스케일 — 원본(1254px)에서 실측한 세로 반복 주기(≈730px, bevel+
 * 블록+이음매+어두운 홈)를 그대로 40px 셀에 욱여넣으면 얇은 줄무늬가 촘촘히
 * 반복돼 오히려 안 읽힌다(스케일 비교 렌더링에서 확인) — 이 게임 벽은 대부분
 * 1~2칸 폭이라 "판 하나가 넉넉하게 보이는" 큰 스케일이 나아, 바닥보다 훨씬
 * 덜 줄인다. 0.3은 1254px 기준 실측값 — 이미지가 배포 용량 때문에 512px로
 * 리사이즈되면서(PR #20 리뷰 반영) 리사이즈 비율(512/1254)만큼 반비례 보정해
 * 0.735로 조정했다(화면상 반복 주기는 그대로 유지).
 */
const WALL_TILE_SCALE = 0.735;

const wallLayerCache = new WeakMap<Stage, { layer: HTMLCanvasElement; wallTile: HTMLImageElement | null }>();

function buildWallLayer(stage: Stage, wallTile: HTMLImageElement | null): HTMLCanvasElement {
  const { grid } = stage;
  const mapWidth = grid.cols * grid.tileSize;
  const mapHeight = grid.rows * grid.tileSize;

  const layer = document.createElement("canvas");
  layer.width = mapWidth;
  layer.height = mapHeight;
  const ctx = layer.getContext("2d");
  if (!ctx) {
    // 2D 컨텍스트를 못 만들면(jsdom 등 canvas 미지원 환경) 빈 캔버스가 그대로
    // wallLayerCache에 캐싱돼 벽이 계속 안 보이게 된다 — 충돌 판정(collider)은
    // grid 데이터로 별도 동작하므로 게임 자체는 멈추지 않지만, 눈에 보이지 않는
    // 벽에 부딪히는 것처럼 보일 수 있어 최소한 콘솔에 남긴다.
    console.warn("buildWallLayer: 2D 컨텍스트 생성 실패 — 벽 레이어가 비어 있음");
    return layer;
  }

  const isWall = (row: number, col: number): boolean => {
    if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return true;
    return grid.cells[row * grid.cols + col] === 1;
  };

  const traceBoundary = (): void => {
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (!isWall(row, col)) continue;
        const x = col * grid.tileSize;
        const y = row * grid.tileSize;
        const size = grid.tileSize;
        ctx.beginPath();
        if (!isWall(row - 1, col)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + size, y);
        }
        if (!isWall(row + 1, col)) {
          ctx.moveTo(x, y + size);
          ctx.lineTo(x + size, y + size);
        }
        if (!isWall(row, col - 1)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + size);
        }
        if (!isWall(row, col + 1)) {
          ctx.moveTo(x + size, y);
          ctx.lineTo(x + size, y + size);
        }
        ctx.stroke();
      }
    }
  };

  // 접지 그림자(floor contact shadow) — 지금까지 AO는 벽 안쪽에만 클립돼 있어
  // "벽이 바닥 위에 서 있다"는 깊이감이 벽 쪽에서 끊긴다. 노이즈를 더 얹는
  // 대신 다른 걸 해보라는 지적(사용자) — 벽 경계선을 클립 없이 굵게+블러로
  // 먼저 그려서, 절반은 곧 벽 채우기가 덮어 없어지고 나머지 절반(바깥쪽)만
  // 통로 바닥 위에 부드럽게 스며드는 그림자로 남는다. 이 레이어(wallLayer)가
  // floorGrain보다 나중에 합성되므로 바닥 질감 위에 자연스럽게 얹힌다.
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.32)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = 9;
  ctx.lineWidth = 22;
  traceBoundary();
  ctx.shadowBlur = 0;

  // 통로와 맞닿는 바깥 경계 변에만(=미로의 진짜 윤곽선) 베벨+AO를 그린다. 선이
  // 벽 칸 경계를 넘어 통로(바닥) 위로 새어나가지 않도록 벽 칸 전체를 클립 영역으로
  // 잡고 그 안에서만 그린다. 채우기(타일 패턴이든 단색이든)에도 같은 클립을 써서
  // 벽 칸 바깥으로 새지 않게 한다.
  const wallClip = new Path2D();
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (isWall(row, col)) {
        wallClip.rect(col * grid.tileSize, row * grid.tileSize, grid.tileSize, grid.tileSize);
      }
    }
  }

  const pattern = wallTile ? ctx.createPattern(wallTile, "repeat") : null;
  ctx.save();
  ctx.clip(wallClip);
  if (pattern) {
    // 실사 벽 타일 — 위 WALL_TILE_SCALE 주석 참고.
    ctx.save();
    ctx.scale(WALL_TILE_SCALE, WALL_TILE_SCALE);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, mapWidth / WALL_TILE_SCALE, mapHeight / WALL_TILE_SCALE);
    ctx.restore();
  } else {
    // 실사 타일이 없을 때(로드 실패 등)의 폴백 — tile-art-prompt-guide.md가
    // 정의해 둔 "바닥보다 확실히 어두운 석재 턱" 재질 스펙을 단색으로 근사한다.
    // 배경 사진 평균 색(stage.png ≈ rgb(125,112,91))과 같은 따뜻한 무채색 계열의
    // 어두운 버전 — 검정이나 보라가 아니라 "같은 돌바닥의 그림자 진 부분"처럼.
    ctx.fillStyle = "rgba(40, 36, 31, 0.92)";
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (isWall(row, col)) {
          ctx.fillRect(col * grid.tileSize, row * grid.tileSize, grid.tileSize, grid.tileSize);
        }
      }
    }
  }

  // AO — 턱이 바닥과 맞닿는 지점에 지는 부드러운 그림자. 경계에 걸쳐 굵게 그리고
  // 클립으로 벽 안쪽 절반만 남긴다.
  ctx.strokeStyle = "rgba(8, 6, 4, 0.55)";
  ctx.shadowColor = "rgba(8, 6, 4, 0.5)";
  ctx.shadowBlur = 5;
  ctx.lineWidth = 7;
  traceBoundary();

  // 베벨 — 턱의 위쪽 모서리가 빛을 받아 밝아지는 얇은 rim. AO보다 안쪽(바닥에 더
  // 가까운 쪽)이 아니라 경계 바로 그 자리에 얇게 얹혀 "턱이 솟아 있다"는 걸 보여준다.
  ctx.strokeStyle = "rgba(150, 138, 120, 0.55)";
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  traceBoundary();
  ctx.restore();

  return layer;
}

/**
 * 스테이지 배경과 지형(벽 셀)·골 지점을 그린다. 배경은 라운드 공통 정적 아트
 * 한 장(`backgroundArt.ts`)이고, 벽은 시드마다 통로 모양이 달라지는 절차적
 * 타일이라 배경 그림과 픽셀 단위로 맞지 않는다 — 그래서 벽을 배경과 뚜렷이
 * 구분되는 불투명한 석재 턱(채우기+AO+베벨)으로 그려, 절차적 타일과 정적
 * 배경이 같은 자리를 공유하지 않아도 "이건 그림"과 "이건 지형"이 헷갈리지
 * 않게 한다. 배경 이미지가 없으면(로드 실패·미확보) 기존 단색 배경으로
 * 폴백한다.
 */
export function drawStage(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  background: HTMLImageElement | null,
  checkpointsActivated: readonly boolean[],
  round: Round,
  tiles?: { floor: HTMLImageElement | null; wall: HTMLImageElement | null },
): void {
  const { grid } = stage;
  const mapWidth = grid.cols * grid.tileSize;
  const mapHeight = grid.rows * grid.tileSize;
  const floorTile = tiles?.floor ?? null;
  const wallTile = tiles?.wall ?? null;

  if (floorTile) {
    // 실사 바닥 타일이 있으면 정적 배경 사진(stage.png) 대신 이걸로 채운다 —
    // buildFloorTileLayer 주석 참고. 타일 이미지 자체가 바뀔 일은 없지만
    // (같은 라운드 중 로드가 실패했다가 성공하는 경우는 없음) 크기 변경
    // 방어 체크는 floorGrainLayer와 동일하게 남겨둔다.
    if (
      !floorTileLayer ||
      floorTileLayer.tile !== floorTile ||
      floorTileLayer.width !== mapWidth ||
      floorTileLayer.height !== mapHeight
    ) {
      floorTileLayer = { canvas: buildFloorTileLayer(mapWidth, mapHeight, floorTile), tile: floorTile, width: mapWidth, height: mapHeight };
    }
    ctx.drawImage(floorTileLayer.canvas, 0, 0);
  } else if (background) {
    ctx.drawImage(background, 0, 0, mapWidth, mapHeight);
  } else {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, mapWidth, mapHeight);
  }

  // 라운드가 올라갈수록 어두워지는 연출 — round2/3 전용 PNG를 따로 굽는 대신
  // (동일 배경을 밝기만 바꿔 재저장하면 픽셀은 사실상 같은데 파일만 늘어난다,
  // PR #17 리뷰) 이 검정 오버레이 alpha로 밝기를 낮춘다.
  const brightness = ROUND_BACKGROUND_BRIGHTNESS[round];
  if (brightness < 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - brightness})`;
    ctx.fillRect(0, 0, mapWidth, mapHeight);
  }

  // 배경 프롬프트 가이드가 요구한 대로 배경 그림 자체는 전체 화면에 균일하게
  // 밝은 바닥 텍스처만 담고 있어(직접 구운 그림자·명암 없음), 이 위에 앰비언트
  // 어둠을 깔아주는 건 전적으로 엔진(이 코드) 몫이다. 이 어둠이 없으면 광원이
  // 그려내는 빛 웅덩이가 이미 밝은 바닥과 명도 차이가 거의 없어 안 보이고,
  // 배경 가이드가 의도한 "빛 웅덩이 사이 어두운 틈"도 사라진다. 광원(GameCanvas)은
  // 이 위에 나중에 그려지므로 자연히 어둠을 뚫고 밝게 도드라진다.
  //
  // 이전엔 이 어둠이 rgba 한 값짜리 완전 균일한 판이라 밋밋했다 — 위(하늘 쪽)는
  // 저녁 하늘처럼 차가운 남보라 톤이 살짝 돌고 아래(땅에 가까울수록)는 그림자가
  // 고이듯 더 짙어지는 세로 그라디언트로 깊이감을 준다. 그 위에 맵 중심에서
  // 가장자리로 갈수록 짙어지는 비네트를 한 겹 더 얹어, 통로 구석이 화면 프레임처럼
  // 딱 잘리지 않고 자연스럽게 어둠 속으로 스며들게 한다.
  let atmosphere = atmosphereCache.get(stage);
  if (!atmosphere) {
    atmosphere = buildAtmosphere(ctx, mapWidth, mapHeight);
    atmosphereCache.set(stage, atmosphere);
  }
  ctx.fillStyle = atmosphere.dusk;
  ctx.fillRect(0, 0, mapWidth, mapHeight);
  ctx.fillStyle = atmosphere.vignette;
  ctx.fillRect(0, 0, mapWidth, mapHeight);

  // 바닥 grain — 실사 타일이 없을 때만 그린다. 타일 자체에 이미 풍화·균열
  // 질감이 있어서, 있는데도 이 절차적 노이즈를 더 얹으면 서로 다른 스케일의
  // 무늬 두 개가 겹쳐 지저분해진다(buildFloorGrain 주석 참고). 벽 레이어보다
  // 먼저 그려서 벽 칸 위는 자연히 덮이고, 통로(걸어다니는 바닥) 위에만 보이게 한다.
  if (!floorTile) {
    if (!floorGrainLayer || floorGrainLayer.width !== mapWidth || floorGrainLayer.height !== mapHeight) {
      floorGrainLayer = buildFloorGrain(mapWidth, mapHeight);
    }
    ctx.drawImage(floorGrainLayer, 0, 0);
  }

  // 벽 채우기(타일 패턴 또는 폴백 단색)+AO+베벨은 stage가 바뀌기 전까지 절대
  // 안 변하는 정적 레이어라 buildWallLayer()가 오프스크린 캔버스에 미리 그려둔
  // 걸 매 프레임 한 번의 drawImage로만 합성한다. 캐시 키에 wallTile 참조도
  // 같이 넣어서, 이미지가 나중에 로드 완료되면(비동기라 첫 프레임엔 null일 수
  // 있음) 자동으로 다시 그리게 한다 — stage만 키로 쓰면 타일 로드 전에 그려진
  // 폴백 버전이 영영 캐싱된 채로 남는다.
  let wallLayerEntry = wallLayerCache.get(stage);
  if (!wallLayerEntry || wallLayerEntry.wallTile !== wallTile) {
    wallLayerEntry = { layer: buildWallLayer(stage, wallTile), wallTile };
    wallLayerCache.set(stage, wallLayerEntry);
  }
  ctx.drawImage(wallLayerEntry.layer, 0, 0);

  // 세이브 포인트·골을 "제단 촛불"로 그린다 — 광원(육각 랜턴, 기하학적·서 있는
  // 기둥형)과 실루엣이 겹치면 둘을 헷갈리게 되므로, 촛불은 각진 형태 없이 둥근
  // 받침 위에 유기적인 불꽃 하나만 두어 "잠시 쉬어가는 지점"이라는 성격을
  // 형태로도 구분한다. 직접 밟아 활성화한 세이브 포인트는 초록으로 바뀌어 계속
  // 표시된다(GameCanvas의 justReachedSavePoint로는 활성화 여부를 눈으로 확인할
  // 방법이 없다는 피드백 반영). 미활성 색은 고정 팔레트의 크림톤 — 보라는 안전 구역 경계선/벽
  // 테두리 전용이라 재사용하면 "이것도 위험 경계인가?" 하는 혼동을 준다.
  // 좌표를 시드로 미세한 개체차를 준다 — 촛불마다 완전히 똑같이 찍어낸 스탬프처럼
  // 보이지 않도록, 불꽃이 살짝 한쪽으로 기울고 잔불 크기가 조금씩 달라지게 한다.
  const wobble = (n: number): number => {
    const v = Math.sin(n * 43.51) * 7891.23;
    return v - Math.floor(v);
  };

  const drawCandleMark = (x: number, y: number, color: string): void => {
    const rgb = hexToRgbString(color);
    const glow = `rgba(${rgb}, 0.9)`;
    const lean = (wobble(x * 3.1 + y * 7.7) - 0.5) * 3;

    // 바닥 문양 — 그냥 초 하나가 아니라 "제단" 자리라는 걸 바닥에서부터
    // 드러내는 은은한 원형 눈금. 색은 이 촛불의 상태색(rgb)을 그대로 써서
    // 초가 켜져 있다는 것과 시각적으로 묶는다 — 안전구역 경계선 색(보라)과는
    // 겹치지 않으므로 혼동 없음.
    ctx.strokeStyle = `rgba(${rgb}, 0.22)`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 16, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 11, 3.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb}, 0.15)`;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i;
      const innerX = x + Math.cos(angle) * 11;
      const innerY = y + 3 + Math.sin(angle) * 3.4;
      const outerX = x + Math.cos(angle) * 16;
      const outerY = y + 3 + Math.sin(angle) * 5;
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.stroke();
    }

    // 그림자 — 촛대가 바닥에 실제로 서 있다는 걸 보여주는 부드러운 접지 그림자.
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 9, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 받침대 — 맨바닥에 촛대만 놓인 게 아니라 작은 단(제단) 위에 놓인 것처럼
    // 2단 돌받침을 깐다. 화려함을 더하면서도 "제단 촛불"이라는 기존 컨셉을
    // 더 분명하게 보여준다. 세로 홈(flute)을 몇 줄 그어 매끈한 타원이 아니라
    // 조각된 석재 단이라는 디테일을 준다.
    ctx.fillStyle = "rgba(45, 40, 33, 0.88)";
    ctx.beginPath();
    ctx.ellipse(x, y + 3.5, 8, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 80, 66, 0.5)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(x, y + 2.9, 8, 2.6, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.strokeStyle = "rgba(20, 17, 13, 0.4)";
    ctx.lineWidth = 0.5;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 2, y + 2.2);
      ctx.lineTo(x + i * 2.3, y + 5.2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(58, 51, 42, 0.9)";
    ctx.beginPath();
    ctx.ellipse(x, y + 1.5, 5.5, 1.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(20, 17, 13, 0.35)";
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 1.7, y + 0.2);
      ctx.lineTo(x + i * 1.9, y + 3.1);
      ctx.stroke();
    }

    // 받침 접시 — 금속/도자기 재질감을 내기 위해 단색 대신 방사형 그라디언트로
    // 중심이 밝고 가장자리가 어두워지는 입체감을 준다(이전엔 균일한 선 하나뿐이라
    // 스티커처럼 평평해 보였다).
    const dish = ctx.createRadialGradient(x - 2, y - 1, 0, x, y, 12);
    dish.addColorStop(0, "rgba(70, 62, 50, 0.95)");
    dish.addColorStop(0.6, "rgba(30, 26, 20, 0.9)");
    dish.addColorStop(1, "rgba(10, 8, 6, 0.85)");
    ctx.fillStyle = dish;
    ctx.beginPath();
    ctx.ellipse(x, y, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y - 0.5, 11, 4, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // 접시 테두리의 작은 장식 촉 4개 — 매끈한 금속 테가 아니라 세공된 장식
    // 접시처럼 보이게 한다.
    ctx.fillStyle = "rgba(220, 210, 190, 0.55)";
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI * 0.25 + (Math.PI / 2) * i;
      const sx2 = x + Math.cos(angle) * 10;
      const sy2 = y + Math.sin(angle) * 3.6;
      ctx.beginPath();
      ctx.arc(sx2, sy2, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 접시와 초 사이 짧은 목(baluster) — 굴곡을 줘 세공된 촛대 다리처럼 보이게
    // 한다. 접시보다 나중에 그려야 가려지지 않는다. 초 밑면(y-2, 아래 wax 참고)에
    // 정확히 맞닿도록 끝점을 고정한다 — 여기서 어긋나면 초가 목 위에 붕 뜬
    // 것처럼 보인다.
    ctx.fillStyle = "rgba(40, 34, 27, 0.9)";
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y - 1);
    ctx.quadraticCurveTo(x - 2.3, y + 0.2, x - 1.2, y + 1.2);
    ctx.lineTo(x + 1.2, y + 1.2);
    ctx.quadraticCurveTo(x + 2.3, y + 0.2, x + 1.5, y - 1);
    ctx.closePath();
    ctx.fill();

    // 접시 중앙의 작은 촉(spike) — 실제 촛대 접시처럼 초를 꽂아 고정하는 부분
    ctx.fillStyle = "rgba(60, 52, 42, 0.9)";
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y - 1);
    ctx.lineTo(x + 1.5, y - 1);
    ctx.lineTo(x, y - 2);
    ctx.closePath();
    ctx.fill();

    // 초 — 밀랍은 상태와 무관하게 항상 같은 크림색이고, 오직 불꽃(포인트 색)만
    // 세이브 통과 여부에 따라 바뀐다 — "이 세계의 빛(상태)이 담기는 그릇"이라는
    // 의미를 형태로 나눈다. 좌우 그라디언트로 원통형 입체감을 주고, 옆면에 촛농이
    // 흘러내린 자국과 받침 위에 굳은 촛농 방울을 더해 밀랍 특유의 질감을 살린다.
    const wax = ctx.createLinearGradient(x - 3, y, x + 3, y);
    wax.addColorStop(0, "#cabe9c");
    wax.addColorStop(0.45, "#e9ddc2");
    wax.addColorStop(1, "#b8ac8c");
    ctx.fillStyle = wax;
    // 원통이 아니라 위로 갈수록 살짝 좁아지는 사다리꼴 — 실제 초는 완벽한
    // 직육면체가 아니라 타서 가늘어진 위쪽이 살짝 좁다.
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 2);
    ctx.lineTo(x + 3, y - 2);
    ctx.lineTo(x + 2.3, y - 9);
    ctx.lineTo(x - 2.3, y - 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(x + 1.4, y - 8, 1, 6);
    // 촛농 흘림 자국 — 기존 한 줄기 옆에 반대편에도 짧은 줄기를 더해 좌우
    // 비대칭으로 더 자연스럽게 흘러내린 느낌을 준다.
    ctx.fillStyle = "rgba(180, 168, 142, 0.55)";
    ctx.beginPath();
    ctx.moveTo(x - 2.1, y - 5);
    ctx.quadraticCurveTo(x - 2.6, y - 2, x - 2.2, y - 0.5);
    ctx.quadraticCurveTo(x - 1.9, y - 2, x - 1.6, y - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(233, 221, 194, 0.8)";
    ctx.beginPath();
    ctx.ellipse(x - 2, y + 0.5, 1.3, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 2.2, y + 1, 0.9, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 심지 — 불꽃 밑동에 짧고 살짝 구부러진 검은 심지를 넣어 불꽃이 허공이
    // 아니라 실제 심지에서 타오르는 것처럼 보이게 한다.
    ctx.strokeStyle = "rgba(35, 28, 20, 0.9)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.quadraticCurveTo(x + 0.8, y - 10.5, x + 0.3, y - 12);
    ctx.stroke();

    // 불꽃 뒤 은은한 헤일로 — 실제로 빛을 뿜는 것처럼 부드럽게 번지는 광륜.
    // 넓게 퍼지는 겹 + 심지 바로 주변의 좁고 밝은 겹, 두 겹으로 화려함을 더한다.
    const haloRadius = 24;
    const halo = ctx.createRadialGradient(x, y - 14, 0, x, y - 14, haloRadius);
    halo.addColorStop(0, `rgba(${rgb}, 0.4)`);
    halo.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y - 14, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    const innerHalo = ctx.createRadialGradient(x, y - 14, 0, x, y - 14, 8);
    innerHalo.addColorStop(0, "rgba(255, 248, 230, 0.5)");
    innerHalo.addColorStop(1, "rgba(255, 248, 230, 0)");
    ctx.fillStyle = innerHalo;
    ctx.beginPath();
    ctx.arc(x, y - 14, 8, 0, Math.PI * 2);
    ctx.fill();

    // 불꽃 — 바깥의 넓고 옅은 겹 + 중간 포인트색 + 안쪽의 하얀 심지 불, 세 겹으로
    // 입체감을 주고 lean만큼 살짝 기울여 흔들리는 불꽃의 유기적인 느낌을 준다.
    const drawFlame = (topOffset: number, waistOffset: number, width: number, fillColor: string): void => {
      const flameTop = y - topOffset;
      const flameWaist = y - waistOffset;
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(x + lean, flameTop);
      ctx.quadraticCurveTo(x + width, y - 9, x, flameWaist);
      ctx.quadraticCurveTo(x - width + lean, y - 9, x + lean, flameTop);
      ctx.closePath();
      ctx.fill();
    };

    ctx.shadowColor = glow;
    ctx.shadowBlur = 11;
    drawFlame(17, 3, 5.5, `rgba(${rgb}, 0.55)`);
    ctx.shadowBlur = 8;
    drawFlame(15, 4, 3.6, color);
    ctx.shadowBlur = 4;
    drawFlame(12.5, 5.5, 1.8, "#fff8e6");
    ctx.shadowBlur = 0;

    // 잔불 — 불꽃 위로 옅게 흩어지는 불티로 마무리감을 준다. 개수를 늘리고
    // 흩어지는 범위도 넓혀 더 풍성하게 — 일부는 색불티, 일부는 흰 불티로 섞는다.
    for (let i = 0; i < 4; i++) {
      const t = wobble(x * 11 + y * 13 + i * 29);
      const spread = wobble(x * 17 + y * 23 + i * 41);
      const ex = x + lean * 1.5 + (t - 0.5) * 16;
      const ey = y - 19 - t * 14 - i * 1.5;
      const isWhite = spread < 0.3;
      ctx.fillStyle = isWhite ? `rgba(255, 248, 230, ${(0.4 - t * 0.15).toFixed(2)})` : `rgba(${rgb}, ${(0.35 - t * 0.15).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 0.7 + t * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  stage.checkpoints.forEach((checkpoint, i) => {
    const activated = checkpointsActivated[i] ?? false;
    drawCandleMark(checkpoint.x, checkpoint.y, activated ? "#4caf50" : "#f0e6d2");
  });

  drawCandleMark(stage.goal.x, stage.goal.y, "#f5a623");
}
