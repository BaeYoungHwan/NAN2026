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

/** 가로등 배치 간격(경로 스텝 기준) — 임시값. 실제 값은 P1 플레이테스트로 확정한다 (PRD §12, ADR-004). */
const LIGHT_SPACING_STEPS = 8;

export const DEFAULT_SEED = 12345;

/** 그림자 길이(ℓ) — 임시 상수. 실제 값은 P1 플레이테스트로 확정한다 (PRD §12 미결). */
export const SHADOW_LENGTH = 80;

/** 안전 구역 허용 각도(라디안, ±) — 임시 상수. 실제 값은 P1 플레이테스트로 확정한다. */
export const SAFE_ANGLE_TOLERANCE = Math.PI / 6; // ±30도

/** 그림자 회전 속도 (라디안/초) — 임시 상수. */
export const ROTATION_SPEED = Math.PI; // 180도/초

/**
 * 최근접 광원이 바뀌는 순간, 이 시간(초) 동안은 정렬 판정을 건너뛴다 — 임시 상수.
 * 광원 전환 시 요구 각도가 최대 180도 가까이 순간적으로 바뀔 수 있는데(ADR-004),
 * 회전 속도(ROTATION_SPEED)로는 한 프레임 안에 따라잡을 수 없어 무조건 죽게 된다.
 * 전환 직후 잠깐의 유예를 둬서 플레이어가 새 각도로 돌릴 시간을 준다.
 * 값 산정: 최악의 경우(180도) 회전에 걸리는 시간(π/ROTATION_SPEED ≈ 1초) + 반응 여유.
 * 실제 값은 P1 플레이테스트로 확정한다 (PRD §12).
 */
export const LIGHT_SWITCH_GRACE_SECONDS = 1.2;

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
 *
 * `extraWalls`(선택)는 통로를 다 판 뒤에 추가로 벽 처리할 셀 좌표(픽셀)다 —
 * 이동 패턴 학습 AI(`src/ai/pathBlocker.ts`)가 고른 차단 후보를 넘길 때 쓴다.
 * carve 자체에는 영향을 주지 않으므로 spawn/checkpoints/goal은 그대로 유지된다.
 *
 * 신뢰 경계: 이 함수는 `extraWalls`가 스폰/체크포인트/골과 겹치지 않는지, 막았을 때
 * 스테이지가 여전히 풀리는지 스스로 검증하지 않는다 — 호출자(`selectBlockedCells`)가
 * 이미 도달가능성을 검증한 셀만 넘긴다는 전제에 의존한다. 새 호출자를 추가할 땐
 * 반드시 같은 방식으로 사전 검증할 것.
 */
export function generateStage(seed: number, extraWalls?: Point[]): Stage {
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

  const aiBlockedCells = extraWalls ?? [];
  for (const wall of aiBlockedCells) {
    const col = Math.floor(wall.x / grid.tileSize);
    const row = Math.floor(wall.y / grid.tileSize);
    if (col >= 0 && col < grid.cols && row >= 0 && row < grid.rows) {
      grid.cells[row * grid.cols + col] = 1;
    }
  }

  // 광원(가로등)은 통로 경로를 따라 일정 간격으로, 통로 바깥(벽 셀)에 배치한다 —
  // 캐릭터가 지나가는 동안 가장 가까운 가로등이 계속 바뀌면서 안전구역 각도도
  // 함께 바뀌게 하되(ADR-004), 광원 자체는 캐릭터가 물리적으로 닿을 수 없는
  // 벽 위에 있어 스폰·골·체크포인트 등 walkable 지점과 좌표가 겹칠 일이 없다.
  const lightSources = placeLightSources(grid, path);

  return { lightSources, grid, spawn, checkpoints, goal, aiBlockedCells };
}

/** 인접 벽 셀을 찾을 때 시도할 오프셋 — 가까운 것부터, 상하좌우 다음 대각선/2칸. */
const WALL_SEARCH_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
];

/**
 * 주어진 셀에서 가장 가까운 벽 셀(walkable 아님)을 찾는다 — 가로등을 통로가
 * 아니라 통로 옆 벽에 배치해, 캐릭터가 물리적으로 닿을 수 없게 하기 위함.
 * 찾지 못하면(그리드 가장자리 등 드문 경우) null을 반환한다.
 */
function findAdjacentWallCell(grid: TileGrid, cell: Cell): Cell | null {
  for (const [dc, dr] of WALL_SEARCH_OFFSETS) {
    const col = cell.col + dc;
    const row = cell.row + dr;
    if (col >= 0 && col < grid.cols && row >= 0 && row < grid.rows && grid.cells[row * grid.cols + col] === 1) {
      return { col, row };
    }
  }
  return null;
}

/**
 * 통로 경로를 따라 LIGHT_SPACING_STEPS 간격으로, 경로 옆 벽 셀에 가로등을
 * 배치한다(ADR-004) — 벽 위이므로 캐릭터가 닿을 수 없고, walkable 지점(스폰·
 * 골·체크포인트)과 좌표가 겹칠 일도 구조적으로 없다. 경로 끝(골 근처)이
 * 마지막 간격에 걸리지 않으면 골 쪽에도 하나 추가해 고르게 분포시킨다.
 */
function placeLightSources(grid: TileGrid, path: Cell[]): Point[] {
  const sources: Point[] = [];

  const addNearWall = (cell: Cell) => {
    const wallCell = findAdjacentWallCell(grid, cell);
    if (wallCell) {
      sources.push(cellCenter(grid.tileSize, wallCell.col, wallCell.row));
    }
  };

  for (let i = 0; i < path.length; i += LIGHT_SPACING_STEPS) {
    addNearWall(path[i]);
  }

  const lastIdx = path.length - 1;
  if (lastIdx % LIGHT_SPACING_STEPS !== 0) {
    addNearWall(path[lastIdx]);
  }

  // 경로 전체가 벽에 인접한 셀을 하나도 못 찾는 극단적 경우를 대비해(이론상
  // 거의 발생하지 않음 — 통로 폭 2칸은 20x15 그리드에서 항상 벽에 둘러싸임)
  // 최소 1개는 보장한다.
  if (sources.length === 0) {
    const midCell = path[Math.floor(path.length / 2)];
    sources.push(cellCenter(grid.tileSize, midCell.col, midCell.row));
  }

  return sources;
}

/**
 * 통로 경로(`path`, 첫 칸이 스폰·마지막 칸이 골)를 라운드 수만큼 균등 분할해
 * 세이브 포인트를 뽑는다 — 라운드가 3개면 경로를 3구간으로 나누는 2개의
 * 전환점(1R→2R, 2R→3R)이 나온다. 스폰·골과 겹치지 않도록 인덱스를
 * [1, path.length - 2] 범위로 고정한다.
 *
 * 보장 범위: `path.length >= (MAX_ROUND - 1) + 2`(현재 4칸 이상)일 때만 모든
 * 체크포인트가 서로/스폰/골과 겹치지 않음을 보장한다. 그보다 짧은 경로는
 * 스폰·골 사이 정수 인덱스 칸이 부족해(예: 3칸이면 내부 칸이 1개뿐) 원리적으로
 * 겹침을 막을 수 없다 — `generateStage`의 `MIN_SPAN_CELLS` 재시도 게이트가 이런
 * 짧은 경로를 걸러내는 1차 방어선이므로, 여기서는 더 정교하게 처리하지 않는다.
 */
export function computeCheckpoints(tileSize: number, path: Cell[]): Point[] {
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
