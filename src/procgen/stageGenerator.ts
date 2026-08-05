import type { Round } from "../core/round";
import type { Point, Stage, TileGrid } from "../core/stage";
import { bfsDistances } from "./reachability";

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

const TILE_SIZE = 40;
const GRID_COLS = CANVAS_WIDTH / TILE_SIZE; // 20
const GRID_ROWS = CANVAS_HEIGHT / TILE_SIZE; // 15
const CORRIDOR_WIDTH = 2; // 셀 단위 — 80px 폭
const PATH_STEPS = 80; // Jump King식 난이도 실험값(기존 40) — 체크포인트 간 구간을 늘려 사망 시 손실 거리를 키움
const STRAIGHT_BIAS = 0.75; // 직진 방향이 있을 때 그 방향을 고를 확률
const MIN_SPAN_CELLS = 16; // Jump King식 난이도 실험값(기존 10) — 스폰-골 최소 직선거리(칸), 미달이면 재시도
// MIN_SPAN_CELLS을 10→16으로 올리면서 기존 재시도 예산(5회)으로는 1000시드 중 약 10%가
// 목표 미달로 폴백되는 것을 실측(최악 span=0, 사실상 깨진 맵)했다 — 재시도 예산을 30회로
// 올려 해소했었다. 이후 진척도 오름차순 조건(`isAscendingProgress`, 벽 없이 인접한 두
// carve 구간 사이의 진짜 지름길 때문에 발생)이 재시도 게이트에 추가되면서 30회로는
// 1000시드 중 36개(3.6%)가 여전히 실패하는 것을 실측했다 — 200회로 올려 1000시드 전부
// 통과하는 것을 확인 후 반영. carveCorridor+BFS 모두 가벼워 200회를 다 돌아도(드묾)
// 체감 지연 없음(1000시드 전체 생성 486ms).
const MAX_GENERATION_ATTEMPTS = 200;

/**
 * 스테이지(라운드) 내부에 두는 세이브 포인트 개수 — 라운드 개수(`core/round.ts`의
 * `MAX_ROUND`)와는 별개의 독립 파라미터다. 라운드마다 독립 스테이지로 전환하는
 * 구조로 바뀌면서, "체크포인트 개수"와 "라운드 개수"가 서로 다른 개념임을 분리했다.
 *
 * 라운드당 1개 — 코스 중간(진행도 50%) 한 곳에만 둔다. 2개였을 때는 세이브
 * 포인트 간격이 너무 촘촘해 사망 페널티가 거의 사라졌다.
 */
const SAVE_POINTS_PER_STAGE = 1;

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

/**
 * 라운드 파생 전용 시드 변환 — `deriveSeed`(생성 재시도용)와 승수·상수가 달라
 * 서로 다른 수열을 만든다. 같은 함수를 재시도와 라운드 파생 양쪽에 그대로
 * 쓰면, `generateStage(base)`가 내부적으로 재시도를 거쳐 우연히
 * `deriveSeed(base)`를 최종 시드로 채택했을 때 `seedForRound(base, 2)`와
 * 정확히 같은 시드가 되어 1R과 2R이 같은 지형이 되는 문제가 실측으로
 * 발견됐다 — 독립된 변환으로 이 충돌을 구조적으로 피한다.
 */
function deriveRoundSeed(seed: number): number {
  return (seed * 1597334677 + 12345) % 2147483647;
}

/**
 * 라운드별 스테이지 시드를 결정론적으로 파생한다 — 라운드마다 독립적으로
 * `generateStage`를 호출해 완전히 새로운 지형을 만들되(라운드=독립 스테이지),
 * 같은 베이스 시드로는 항상 같은 세 스테이지가 재현되게 한다.
 * `seedForRound(base, 1) === base`이므로 기존 `generateStage(DEFAULT_SEED)`
 * 호출부(1R)와 완전히 호환된다.
 */
export function seedForRound(baseSeed: number, round: Round): number {
  let seed = baseSeed;
  for (let r = 1; r < round; r++) seed = deriveRoundSeed(seed);
  return seed;
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

/** 주어진 셀들이 서로 다른 (col,row)인지 확인한다. */
function hasDistinctCells(cells: Cell[]): boolean {
  const keys = cells.map((c) => `${c.col},${c.row}`);
  return new Set(keys).size === keys.length;
}

/** `distanceField`에서 특정 셀의 BFS 진행도 값을 읽는다. */
function cellProgress(grid: TileGrid, distanceField: Int32Array, cell: Cell): number {
  return distanceField[cell.row * grid.cols + cell.col];
}

/**
 * 체크포인트·골의 BFS 진행도가 스폰(0)부터 엄격히 오름차순인지 확인한다 —
 * `core/round.ts`의 `respawnPointFor`가 "`checkpoints` 배열의 뒤쪽 인덱스일수록
 * 진행도가 높다"를 전제로 마지막으로 밟은 체크포인트를 리스폰 지점으로 고른다.
 * 통로 폭이 2칸이라 서로 다른 carve 스텝의 셀이 벽 없이 walkable-인접할 수
 * 있어(진짜 지름길), BFS 거리 기준으로는 carve 순서와 다르게 뒤바뀔 수 있다 —
 * `generateStage`의 재시도 게이트가 이 조건도 함께 확인한다.
 */
function isAscendingProgress(checkpointProgress: number[], goalProgress: number): boolean {
  let previous = 0;
  for (const progress of checkpointProgress) {
    if (progress <= previous) return false;
    previous = progress;
  }
  return goalProgress > previous;
}

interface GenerationAttempt {
  grid: TileGrid;
  path: Cell[];
  checkpointCells: Cell[];
  distanceField: Int32Array;
  checkpointProgress: number[];
  goalProgress: number;
}

/**
 * 한 시드로 그리드·통로·진척도 필드를 한 번에 생성한다 — `generateStage`의 최초 시도와 재시도가 공유.
 * 체크포인트를 스폰→골 최단 경로 위에서 고르므로 `distanceField`·`goalProgress`를 먼저 구한다.
 */
function attemptGeneration(seed: number, start: Cell): GenerationAttempt {
  const grid = createEmptyGrid();
  const path = carveCorridor(grid, start, createRng(seed));
  const spawnPoint = cellCenter(grid.tileSize, path[0].col, path[0].row);
  const distanceField = bfsDistances(grid, spawnPoint);
  const goalCell = path[path.length - 1];
  const goalProgress = cellProgress(grid, distanceField, goalCell);
  const checkpointCells = computeCheckpointCells(grid, distanceField, goalCell, goalProgress);
  const checkpointProgress = checkpointCells.map((cell) => cellProgress(grid, distanceField, cell));
  return { grid, path, checkpointCells, distanceField, checkpointProgress, goalProgress };
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
 * 라운드마다 독립적으로 호출되며(`seedForRound`), 한 번의 호출 결과가 한 라운드 전체를 이룬다.
 *
 * 스폰-골 직선거리가 MIN_SPAN_CELLS에 못 미치거나(통로가 너무 짧게 뭉치면),
 * 스폰/체크포인트/골 중 실제 좌표가 겹치는 게 있거나(막다른 곳에서 재방문된
 * 셀이 하필 체크포인트 인덱스와 겹치는 드문 경우), 체크포인트·골의 BFS
 * 진행도가 오름차순이 아니면(통로 폭 2칸으로 생긴 지름길 때문에 드물게 발생,
 * `isAscendingProgress` 참고) 파생 시드로 재시도한다 — 최대 시도 횟수를 넘으면
 * 마지막 결과를 그대로 사용한다.
 */
export function generateStage(seed: number): Stage {
  const start: Cell = { col: 1, row: GRID_ROWS - 3 };

  let currentSeed = seed;
  let attemptResult = attemptGeneration(currentSeed, start);

  for (let attempt = 1; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const { path, checkpointCells, checkpointProgress, goalProgress } = attemptResult;
    const spawnCell = path[0];
    const goalCell = path[path.length - 1];
    const span = Math.hypot(spawnCell.col - goalCell.col, spawnCell.row - goalCell.row);
    // 스폰/체크포인트/골의 실제 좌표가 겹치는 스테이지를 걸러낸다 — 예전 carve 순서
    // 기반 배치에서 막다른 곳의 재방문 셀이 체크포인트 인덱스와 겹치는 사례가
    // 실측으로 발견됐다(200시드 sweep 중 1건). 최단 경로 기반 배치로 바뀐 뒤에도
    // 통로가 극단적으로 짧으면 원리적으로 겹칠 수 있어 게이트는 그대로 둔다.
    const distinctCells = hasDistinctCells([spawnCell, ...checkpointCells, goalCell]);
    const ascendingProgress = isAscendingProgress(checkpointProgress, goalProgress);
    if (span >= MIN_SPAN_CELLS && distinctCells && ascendingProgress) break;

    currentSeed = deriveSeed(currentSeed);
    attemptResult = attemptGeneration(currentSeed, start);
  }

  const { grid, path, checkpointCells, distanceField, checkpointProgress, goalProgress } = attemptResult;

  const spawn = cellCenter(grid.tileSize, path[0].col, path[0].row);
  const goal = cellCenter(grid.tileSize, path[path.length - 1].col, path[path.length - 1].row);
  const checkpoints = checkpointCells.map((cell) => cellCenter(grid.tileSize, cell.col, cell.row));
  const pathPoints = path.map((cell) => cellCenter(grid.tileSize, cell.col, cell.row));

  // 광원(가로등)은 통로 경로를 따라 일정 간격으로, 통로 바깥(벽 셀)에 배치한다 —
  // 캐릭터가 지나가는 동안 가장 가까운 가로등이 계속 바뀌면서 안전구역 각도도
  // 함께 바뀌게 하되(ADR-004), 광원 자체는 캐릭터가 물리적으로 닿을 수 없는
  // 벽 위에 있어 스폰·골·체크포인트 등 walkable 지점과 좌표가 겹칠 일이 없다.
  const lightSources = placeLightSources(grid, path);

  return {
    lightSources,
    grid,
    spawn,
    checkpoints,
    goal,
    path: pathPoints,
    distanceField,
    checkpointProgress,
    goalProgress,
  };
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
 *
 * 서로 다른 경로 샘플 지점이 같은 벽 셀을 찾아낼 수 있으므로(간격이 좁은 통로
 * 등) 좌표 기준으로 중복을 제거한다 — PR #7 리뷰에서 광원이 겹쳐 그려지는
 * 현상이 실측으로 재현되어 추가한 방어 로직이다(당시 원인은 재시작마다
 * 누적되던 이동 패턴 학습 AI의 차단 벽이었으나, 그 기능 제거 후에도 좁은
 * 통로에서 동일 현상이 재현될 수 있어 dedup 자체는 유지한다).
 */
function placeLightSources(grid: TileGrid, path: Cell[]): Point[] {
  const sources: Point[] = [];
  const seenKeys = new Set<string>();

  const addNearWall = (cell: Cell) => {
    const wallCell = findAdjacentWallCell(grid, cell);
    if (!wallCell) return;
    const key = `${wallCell.col},${wallCell.row}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    sources.push(cellCenter(grid.tileSize, wallCell.col, wallCell.row));
  };

  for (let i = 0; i < path.length; i += LIGHT_SPACING_STEPS) {
    addNearWall(path[i]);
  }

  const lastIdx = path.length - 1;
  if (lastIdx % LIGHT_SPACING_STEPS !== 0) {
    addNearWall(path[lastIdx]);
  }

  // 경로 샘플 지점(간격 단위) 근처에서 전부 벽을 못 찾는 극단적 경우를 대비해
  // 경로 전체를 순회하며 벽 셀을 찾을 때까지 재시도한다 — walkable 셀을 광원
  // 좌표로 대체하는 예외는 두지 않는다. "광원은 항상 벽 위에 있다"는
  // 불변조건(stageGenerator.test.ts로 고정됨)을 이 폴백도 반드시 지켜야 한다.
  // 통로 폭 2칸은 20x15 그리드에서 항상 벽에 둘러싸이므로(시드 1~2000 검증됨)
  // 이 루프가 실패하는 경우는 실질적으로 없다.
  if (sources.length === 0) {
    for (const cell of path) {
      addNearWall(cell);
      if (sources.length > 0) break;
    }
  }

  return sources;
}

/**
 * `distanceField`를 골에서 역추적해 스폰→골 **최단 경로** 셀 목록을 만든다
 * (스폰이 첫 칸, 골이 마지막 칸). 각 스텝에서 진행도가 정확히 1 작은 이웃으로
 * 내려가며, 이웃 탐색 순서가 고정이라 최단 경로가 여럿이어도 결정론적으로 하나를 고른다.
 */
function shortestPathCells(grid: TileGrid, distanceField: Int32Array, goalCell: Cell): Cell[] {
  const cells: Cell[] = [{ ...goalCell }];
  let { col, row } = goalCell;
  let distance = cellProgress(grid, distanceField, goalCell);

  while (distance > 0) {
    const next = DIRECTIONS.find(([dc, dr]) => {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nc >= grid.cols || nr < 0 || nr >= grid.rows) return false;
      return distanceField[nr * grid.cols + nc] === distance - 1;
    });
    // 골이 스폰과 연결돼 있으면(항상 그렇다 — 같은 carve 경로 위다) 반드시 찾는다.
    if (!next) break;
    col += next[0];
    row += next[1];
    distance -= 1;
    cells.push({ col, row });
  }

  return cells.reverse();
}

/**
 * 세이브 포인트를 놓을 셀을 `SAVE_POINTS_PER_STAGE`개 고른다 — `generateStage`가
 * 이 셀의 중심 좌표를 `checkpoints`로 변환해 런타임 접촉 판정(`core/round.ts`의
 * `hasTouchedCheckpoint`)에 쓴다.
 *
 * 후보는 **스폰→골 최단 경로 위 셀**로 제한하고, 그중 진행도를 균등 분할한
 * 지점(1개면 정확히 절반)에 가장 가까운 셀을 고른다. 두 가지를 동시에 만족시키기
 * 위한 선택이다.
 *
 * - **길목에 놓이게** — 후보를 `path`(carve 순서 전체) 위로 두면 세이브 포인트가
 *   막다른 갈래나 되돌아가는 구간에 놓여, 플레이어가 일부러 찾아가지 않는 한
 *   마주칠 일이 없었다(실측: 2R·3R의 최단 경로가 체크포인트를 지나지 않음).
 *   최단 경로 위에 두면 평범하게 골로 향하는 길에 자연스럽게 놓인다. 접촉 반경이
 *   통로 폭의 절반이라 비켜 갈 여지는 남아 있어, 밟을지 말지는 여전히 플레이어 선택이다.
 * - **코스 중간에 놓이게** — 진행도(BFS 거리)는 골 판정과 같은 척도라, 이 축으로
 *   분할해야 "코스의 절반"이 체감상으로도 절반이 된다. carve 순서로 나누면 통로 폭
 *   2칸 때문에 서로 다른 carve 구간이 벽 없이 인접·병합되면서 스테이지 초반에
 *   몰렸다(실측: 골 진행도가 22인 1R에서 체크포인트 진행도가 3, 5 — 스폰에서
 *   다섯 걸음이면 둘 다 지나친 위치였다).
 *
 * 최단 경로 셀의 진행도는 0부터 `goalProgress`까지 1씩 빠짐없이 나타나므로, 어떤
 * 분할 목표값이든 항상 가장 가까운 후보를 찾을 수 있다. 스폰(진행도 0)·골
 * (`goalProgress`)과 겹치지 않도록 양 끝은 후보에서 제외한다 — 경로가 극단적으로
 * 짧아 내부 칸이 없는 경우만 겹칠 수 있고, 그건 `generateStage`의 `MIN_SPAN_CELLS`
 * 재시도 게이트가 걸러낸다.
 */
export function computeCheckpointCells(
  grid: TileGrid,
  distanceField: Int32Array,
  goalCell: Cell,
  goalProgress: number,
): Cell[] {
  const route = shortestPathCells(grid, distanceField, goalCell);
  const candidates = route.slice(1, -1); // 스폰·골 제외
  if (candidates.length === 0) return [];

  return Array.from({ length: SAVE_POINTS_PER_STAGE }, (_, i) => {
    const target = (goalProgress * (i + 1)) / (SAVE_POINTS_PER_STAGE + 1);
    return candidates.reduce((best, cell) => {
      const diff = Math.abs(cellProgress(grid, distanceField, cell) - target);
      const bestDiff = Math.abs(cellProgress(grid, distanceField, best) - target);
      return diff < bestDiff ? cell : best;
    });
  });
}
