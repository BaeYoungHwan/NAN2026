import { MAX_ROUND } from "../core/round";
import type { Point, Stage, TileGrid } from "../core/stage";

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

const TILE_SIZE = 40;
const GRID_COLS = CANVAS_WIDTH / TILE_SIZE; // 20
const GRID_ROWS = CANVAS_HEIGHT / TILE_SIZE; // 15
const CORRIDOR_WIDTH = 2; // 셀 단위 — 80px 폭
const PATH_STEPS = 40;
const STRAIGHT_BIAS = 0.75; // 직진 방향이 있을 때 그 방향을 고를 확률
const MIN_SPAN_CELLS = 10; // 스폰-골 최소 직선거리(칸) — 미달이면 재시도
const MAX_GENERATION_ATTEMPTS = 5;
const LIGHT_Y = 30;

export const DEFAULT_SEED = 12345;

/** 그림자 길이(ℓ) — 임시 상수. 실제 값은 P1 플레이테스트로 확정한다 (PRD §12 미결). */
export const SHADOW_LENGTH = 80;

/** 안전 구역 허용 각도(라디안, ±) — 임시 상수. 실제 값은 P1 플레이테스트로 확정한다. */
export const SAFE_ANGLE_TOLERANCE = Math.PI / 6; // ±30도

/** 그림자 회전 속도 (라디안/초) — 임시 상수. */
export const ROTATION_SPEED = Math.PI; // 180도/초

/** 결정론적 시드 기반 PRNG (mulberry32) — 같은 시드는 항상 같은 스테이지를 만든다. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 재시도용 파생 시드 — 원본 시드에서 결정론적으로 다음 시드를 만든다. */
function deriveSeed(seed: number): number {
  return (seed * 2654435761) % 2147483647;
}

function cellCenter(tileSize: number, col: number, row: number): Point {
  return { x: (col + 0.5) * tileSize, y: (row + 0.5) * tileSize };
}

interface Cell {
  col: number;
  row: number;
}

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function carveAt(grid: TileGrid, col: number, row: number): void {
  for (let dc = 0; dc < CORRIDOR_WIDTH; dc++) {
    for (let dr = 0; dr < CORRIDOR_WIDTH; dr++) {
      const cc = col + dc;
      const rr = row + dr;
      if (cc >= 0 && cc < grid.cols && rr >= 0 && rr < grid.rows) {
        grid.cells[rr * grid.cols + cc] = 0;
      }
    }
  }
}

/**
 * 전부 벽인 그리드에서 시작 셀부터 random-walk로 고정 폭 통로를 파낸다(carve).
 * - 역주행(직전 방향의 반대)은 금지한다.
 * - 아직 지나오지 않은 셀로 이어지는 방향을 우선한다 — 그러지 않으면 통로가
 *   스스로 겹치며 좁은 구역 안에서 맴돌아 스폰-골 거리가 거의 0에 가까워진다.
 * - 직진 방향이 후보에 있으면 STRAIGHT_BIAS 확률로 그 방향을 선택해, 통로가
 *   구불구불하게 제자리에서 꺾이지 않고 뻗어나가게 한다.
 * 반환값은 지나온 셀 목록 — 첫 번째가 스폰, 마지막이 골이다.
 */
function carveCorridor(grid: TileGrid, start: Cell, rng: () => number): Cell[] {
  const path: Cell[] = [start];
  const visited = new Set<string>([`${start.col},${start.row}`]);
  let { col, row } = start;
  let lastDir: readonly [number, number] | null = null;

  carveAt(grid, col, row);

  for (let step = 0; step < PATH_STEPS; step++) {
    const candidates = DIRECTIONS.filter(([dc, dr]) => {
      if (lastDir && dc === -lastDir[0] && dr === -lastDir[1]) return false;
      const nc = col + dc;
      const nr = row + dr;
      return nc >= 0 && nc + CORRIDOR_WIDTH - 1 < grid.cols && nr >= 0 && nr + CORRIDOR_WIDTH - 1 < grid.rows;
    });

    if (candidates.length === 0) break;

    const unvisited = candidates.filter(([dc, dr]) => !visited.has(`${col + dc},${row + dr}`));
    const pool: Array<readonly [number, number]> = unvisited.length > 0 ? unvisited : candidates;

    const capturedLastDir = lastDir;
    const straight: Array<readonly [number, number]> = capturedLastDir
      ? pool.filter(([dc, dr]) => dc === capturedLastDir[0] && dr === capturedLastDir[1])
      : [];
    const weighted = straight.length > 0 && rng() < STRAIGHT_BIAS ? straight : pool;

    const [dc, dr] = weighted[Math.floor(rng() * weighted.length)];
    col += dc;
    row += dr;
    carveAt(grid, col, row);
    path.push({ col, row });
    visited.add(`${col},${row}`);
    lastDir = [dc, dr];
  }

  return path;
}

function createEmptyGrid(): TileGrid {
  return {
    cols: GRID_COLS,
    rows: GRID_ROWS,
    tileSize: TILE_SIZE,
    cells: new Uint8Array(GRID_COLS * GRID_ROWS).fill(1),
  };
}

/**
 * 시드로부터 스테이지(지형·스폰·골·광원)를 절차적으로 생성한다.
 * 같은 시드는 항상 같은 스테이지를 만든다 — 디버깅·테스트를 위해 결정론적으로 설계함.
 *
 * 스폰-골 직선거리가 MIN_SPAN_CELLS에 못 미치면(통로가 너무 짧게 뭉치면)
 * 파생 시드로 재시도한다 — 최대 시도 횟수를 넘으면 마지막 결과를 그대로 사용한다.
 */
export function generateStage(seed: number): Stage {
  const start: Cell = { col: 1, row: GRID_ROWS - 3 };

  let currentSeed = seed;
  let grid = createEmptyGrid();
  let path = carveCorridor(grid, start, createRng(currentSeed));

  for (let attempt = 1; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const spawnCell = path[0];
    const goalCell = path[path.length - 1];
    const span = Math.hypot(spawnCell.col - goalCell.col, spawnCell.row - goalCell.row);
    if (span >= MIN_SPAN_CELLS) break;

    currentSeed = deriveSeed(currentSeed);
    grid = createEmptyGrid();
    path = carveCorridor(grid, start, createRng(currentSeed));
  }

  const spawn = cellCenter(grid.tileSize, path[0].col, path[0].row);
  const goal = cellCenter(grid.tileSize, path[path.length - 1].col, path[path.length - 1].row);
  const checkpoints = computeCheckpoints(grid.tileSize, path);

  // 광원은 통로 형태와 무관하게 독립 배치한다 — 화면 상단 고정 y, x만 랜덤.
  const lightPos: Point = { x: createRng(currentSeed)() * CANVAS_WIDTH, y: LIGHT_Y };

  return { lightPos, grid, spawn, checkpoints, goal };
}

/**
 * 통로 경로(`path`, 첫 칸이 스폰·마지막 칸이 골)를 라운드 수만큼 균등 분할해
 * 세이브 포인트를 뽑는다 — 라운드가 3개면 경로를 3구간으로 나누는 2개의
 * 전환점(1R→2R, 2R→3R)이 나온다. 스폰·골과 겹치지 않도록 인덱스를
 * [1, path.length - 2] 범위로 고정한다.
 */
function computeCheckpoints(tileSize: number, path: Cell[]): Point[] {
  const checkpointCount = MAX_ROUND - 1;
  const checkpoints: Point[] = [];
  const maxIdx = path.length - 2;
  let lastIdx = 0; // 스폰 인덱스(0)보다 커야 함

  for (let i = 1; i <= checkpointCount; i++) {
    const fraction = i / MAX_ROUND;
    const raw = Math.min(maxIdx, Math.max(1, Math.round((path.length - 1) * fraction)));
    // 경로가 짧아 raw가 이전 체크포인트와 같거나 앞서면 다음 유효 인덱스로 밀어내
    // 체크포인트끼리, 그리고 스폰과 겹치지 않게 한다.
    const idx = Math.min(Math.max(raw, lastIdx + 1), maxIdx);
    lastIdx = idx;
    const cell = path[idx];
    checkpoints.push(cellCenter(tileSize, cell.col, cell.row));
  }

  return checkpoints;
}
