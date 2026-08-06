/**
 * 게임 밸런스 파라미터 한 곳 모음.
 *
 * 이 값들은 원래 `procgen/stageGenerator.ts`(생성기)와 `core/round.ts`(라운드 규칙)에
 * 흩어져 있었다. 생성기 파일에 그림자 회전 속도가 들어 있는 식이라, "지금 확정해야
 * 할 값이 몇 개이고 어디에 있는지"를 매번 다시 찾아야 했다 — PRD §12 미결 사항을
 * 플레이테스트로 확정하려면 만질 곳이 한 군데여야 한다.
 *
 * ## 확정 상태
 *
 * | 파라미터 | 현재값 | 상태 |
 * |---|---|---|
 * | `shadowLength` | 80px | 임시 — PRD §12 |
 * | `safeAngleTolerance` | ±30° | 임시 — PRD §12 |
 * | `rotationSpeed` | 180°/초 | 임시 — PRD §12 |
 * | `lightSwitchGraceSeconds` | 1.2초 | 임시 — ADR-004 |
 * | `round3ToleranceMultiplier` | 0.5 | 임시 — PRD §12 |
 * | `lightSpacingSteps` | 8 | 임시 — PRD §12, ADR-004 |
 * | `pathSteps` | 80 | 1차 조정됨(40→80) — ADR-003 |
 * | `minSpanCells` | 16 | 1차 조정됨(10→16) — ADR-003 |
 * | `corridorWidth` | 2칸 | 확정 |
 * | `savePointsPerStage` | 1 | 확정 |
 *
 * 확정될 때마다 이 표와 아래 주석의 "임시" 표기를 지우고 근거를 적는다.
 *
 * ## 런타임 오버라이드
 *
 * 개발 빌드에서는 `?tune=1` 패널(`ui/TuningPanel.tsx`)이 `setTuningOverride`로 값을
 * 바꿔가며 체감을 확인한다. 프로덕션에서는 오버라이드가 걸릴 경로 자체가 없어
 * (`core/debugTuning.ts`의 `import.meta.env.DEV` 게이팅) 항상 기본값이 쓰인다.
 * 읽는 쪽은 상수를 직접 import하지 말고 반드시 `getTuning()`을 거쳐야 한다 —
 * 모듈 로드 시점에 값을 박아두면 오버라이드가 반영되지 않는다.
 */

export interface Tuning {
  // ── 그림자 메커닉 ─────────────────────────────────────────
  /** 그림자 길이(ℓ, px) — 캐릭터에서 그림자 끝까지의 거리. 임시값. */
  shadowLength: number;
  /** 안전 구역 허용 각도(라디안, ±) — 자연각에서 이만큼 벗어날 때까지는 산다. 임시값. */
  safeAngleTolerance: number;
  /** 그림자 회전 속도(라디안/초) — `,`/`.` 키를 누르고 있는 동안의 각속도. 임시값. */
  rotationSpeed: number;
  /**
   * 최근접 광원이 바뀌는 순간, 이 시간(초) 동안은 정렬 판정을 건너뛴다.
   *
   * 광원 전환 시 요구 각도가 최대 180도 가까이 순간적으로 바뀔 수 있는데(ADR-004),
   * 회전 속도로는 한 프레임 안에 따라잡을 수 없어 유예가 없으면 무조건 죽는다.
   * 값 산정: 최악의 경우(180도) 회전에 걸리는 시간(π/rotationSpeed ≈ 1초) + 반응 여유.
   */
  lightSwitchGraceSeconds: number;

  // ── 라운드 디메리트 ───────────────────────────────────────
  /** 3R 허용 각도 축소 배율 — 기본 허용 각도에 곱한다. 임시값. */
  round3ToleranceMultiplier: number;

  // ── 맵 크기 ───────────────────────────────────────────────
  /**
   * 맵 가로 크기(셀). 기본 20칸 = 800px로, 캔버스와 정확히 같다.
   *
   * 원래 `GRID_COLS = CANVAS_WIDTH / TILE_SIZE`로 캔버스에 묶여 있어 맵이 화면보다
   * 클 수 없었다 — 300셀 안에서 통로를 80스텝 carve하다 보니 통로가 자기 자신을
   * 반복해 덮어써, 미로가 아니라 뭉개진 열린 공간이 되기 쉬웠다(ADR-003의 300시드
   * 전수 실측 기록 참고). 카메라는 이미 맵 범위로 클램프되므로 맵만 키우면 된다.
   *
   * **기본값은 현재 맵과 동일하게 두었다** — 이 값을 바꾸면 1R~3R 세 스테이지가
   * 전부 다른 지형이 된다. 넓힐지 여부는 플레이테스트로 결정할 사항이라, 지금은
   * 튜닝 패널로 실험만 가능하게 열어두고 기본값은 건드리지 않는다.
   */
  worldCols: number;
  /** 맵 세로 크기(셀). 기본 15칸 = 600px — `worldCols` 주석 참고. */
  worldRows: number;

  // ── 스테이지 생성 ─────────────────────────────────────────
  /** 통로 폭(셀). 2칸 = 80px — 캐릭터 지름 대비 여유를 확보한 확정값. */
  corridorWidth: number;
  /**
   * 통로 carve 스텝 수. 40→80은 Jump King식 난이도 실험으로 1차 조정된 값이다
   * (체크포인트 간 구간을 늘려 사망 시 손실 거리를 키움) — ADR-003.
   */
  pathSteps: number;
  /** 직진 방향이 있을 때 그 방향을 고를 확률 — 통로가 지나치게 구불거리지 않게 한다. */
  straightBias: number;
  /** 스폰-골 최소 직선거리(셀). 미달이면 스테이지를 재생성한다. 10→16으로 1차 조정됨 — ADR-003. */
  minSpanCells: number;
  /**
   * 스테이지(라운드) 하나에 두는 세이브 포인트 개수 — 라운드 개수(`MAX_ROUND`)와는
   * 별개의 독립 파라미터다. 2개였을 때는 간격이 촘촘해 사망 페널티가 사라져 1개로 확정.
   */
  savePointsPerStage: number;
  /** 가로등 배치 간격(경로 스텝 기준). 임시값 — PRD §12, ADR-004. */
  lightSpacingSteps: number;
}

/** 확정 전까지 쓰는 기본값 — 오버라이드가 없으면 항상 이 값이다. */
export const TUNING_DEFAULTS: Readonly<Tuning> = Object.freeze({
  shadowLength: 80,
  safeAngleTolerance: Math.PI / 6, // ±30도
  rotationSpeed: Math.PI, // 180도/초
  lightSwitchGraceSeconds: 1.2,
  round3ToleranceMultiplier: 0.5,
  worldCols: 20, // 800px / 40px — 현재 맵과 동일
  worldRows: 15, // 600px / 40px — 현재 맵과 동일
  corridorWidth: 2,
  pathSteps: 80,
  straightBias: 0.75,
  minSpanCells: 16,
  savePointsPerStage: 1,
  lightSpacingSteps: 8,
});

let overrides: Partial<Tuning> = {};
let current: Tuning = { ...TUNING_DEFAULTS };

/**
 * 현재 적용 중인 밸런스 값. 오버라이드가 없으면 `TUNING_DEFAULTS`와 동일하다.
 *
 * 매 프레임 호출되지만 객체를 새로 만들지 않고 캐시된 참조를 돌려주므로
 * (오버라이드가 바뀔 때만 재생성) rAF 루프에서 써도 부담이 없다.
 */
export function getTuning(): Readonly<Tuning> {
  return current;
}

/**
 * 파라미터 하나를 덮어쓴다 — 개발용 튜닝 패널 전용.
 *
 * 프로덕션 빌드에는 이 함수를 호출하는 경로가 없다(`ui/TuningPanel.tsx`가
 * `isTuningEnabled()` 뒤에서만 마운트된다).
 */
export function setTuningOverride<K extends keyof Tuning>(key: K, value: Tuning[K]): void {
  overrides = { ...overrides, [key]: value };
  current = { ...TUNING_DEFAULTS, ...overrides };
}

/** 지금까지 건 오버라이드를 모두 지우고 기본값으로 되돌린다. */
export function resetTuning(): void {
  overrides = {};
  current = { ...TUNING_DEFAULTS };
}

/** 기본값과 다르게 조정된 항목만 추린다 — 패널이 "확정할 값"을 보여줄 때 쓴다. */
export function tuningOverrides(): Readonly<Partial<Tuning>> {
  return overrides;
}
