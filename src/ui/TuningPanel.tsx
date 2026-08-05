import { useEffect, useState } from "react";
import {
  getTuning,
  resetTuning,
  setTuningOverride,
  TUNING_DEFAULTS,
  tuningOverrides,
  type Tuning,
} from "../core/tuning";
import type { Round } from "../core/round";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

interface FieldSpec {
  key: keyof Tuning;
  label: string;
  /** 슬라이더에 보여줄 단위(도·px·초 등). */
  unit: string;
  min: number;
  max: number;
  step: number;
  /**
   * 값이 바뀌면 스테이지를 다시 생성해야 반영되는가.
   *
   * 그림자 각도·속도는 매 프레임 `getTuning()`을 읽으므로 즉시 반영되지만,
   * 통로 길이·가로등 간격은 `generateStage` 안에서만 읽히므로 이미 만들어진
   * 스테이지에는 영향이 없다 — 패널이 이 둘을 구분해 보여준다.
   */
  needsRegenerate: boolean;
  /** 내부 단위(라디안 등) → 화면 표시 단위. 지정하지 않으면 그대로 쓴다. */
  toDisplay?: (value: number) => number;
  /** 화면 표시 단위 → 내부 단위. `toDisplay`와 짝으로 지정한다. */
  fromDisplay?: (value: number) => number;
}

/**
 * 조정 대상 목록 — PRD §12 미결 사항 5건이 전부 여기에 들어 있다.
 * 확정된 값은 목록에서 빼는 대신 `core/tuning.ts`의 주석에 근거를 남긴다.
 */
const FIELDS: readonly FieldSpec[] = [
  {
    key: "safeAngleTolerance",
    label: "허용 각도",
    unit: "°",
    min: 5,
    max: 90,
    step: 1,
    needsRegenerate: false,
    toDisplay: (v) => Math.round(v * RAD_TO_DEG),
    fromDisplay: (v) => v * DEG_TO_RAD,
  },
  {
    key: "rotationSpeed",
    label: "그림자 회전 속도",
    unit: "°/초",
    min: 45,
    max: 540,
    step: 5,
    needsRegenerate: false,
    toDisplay: (v) => Math.round(v * RAD_TO_DEG),
    fromDisplay: (v) => v * DEG_TO_RAD,
  },
  { key: "shadowLength", label: "그림자 길이", unit: "px", min: 40, max: 200, step: 5, needsRegenerate: false },
  {
    key: "lightSwitchGraceSeconds",
    label: "광원 전환 유예",
    unit: "초",
    min: 0,
    max: 3,
    step: 0.1,
    needsRegenerate: false,
  },
  {
    key: "round3ToleranceMultiplier",
    label: "3R 허용각 배율",
    unit: "×",
    min: 0.1,
    max: 1,
    step: 0.05,
    needsRegenerate: false,
  },
  { key: "worldCols", label: "맵 가로", unit: "칸", min: 20, max: 60, step: 1, needsRegenerate: true },
  { key: "worldRows", label: "맵 세로", unit: "칸", min: 15, max: 45, step: 1, needsRegenerate: true },
  { key: "lightSpacingSteps", label: "가로등 간격", unit: "스텝", min: 2, max: 20, step: 1, needsRegenerate: true },
  { key: "pathSteps", label: "통로 길이", unit: "스텝", min: 20, max: 200, step: 5, needsRegenerate: true },
  { key: "minSpanCells", label: "최소 스폰-골 거리", unit: "칸", min: 4, max: 24, step: 1, needsRegenerate: true },
  { key: "corridorWidth", label: "통로 폭", unit: "칸", min: 1, max: 4, step: 1, needsRegenerate: true },
  { key: "straightBias", label: "직진 편향", unit: "", min: 0, max: 1, step: 0.05, needsRegenerate: true },
  { key: "savePointsPerStage", label: "세이브 포인트 수", unit: "개", min: 0, max: 4, step: 1, needsRegenerate: true },
];

function displayValue(spec: FieldSpec, tuning: Readonly<Tuning>): number {
  const raw = tuning[spec.key];
  return spec.toDisplay ? spec.toDisplay(raw) : raw;
}

interface TuningPanelProps {
  round: Round;
  deathCount: number;
  /** 스테이지 재생성이 필요한 값을 바꿨을 때 호출된다 — App이 GameCanvas.restart()로 연결한다. */
  onRegenerate: () => void;
}

/**
 * 개발 전용 밸런스 튜닝 패널 (`?tune=1`).
 *
 * 마운트 여부는 호출부가 `isTuningEnabled()`(`core/debugTuning.ts`)로 결정하므로,
 * 이 컴포넌트 자체는 게이팅을 다시 하지 않는다. 프로덕션 빌드에서는 마운트되지 않는다.
 *
 * 라운드가 바뀌면 경과 시간을 다시 잰다 — 플레이테스트 기록지에 "라운드별 클리어
 * 타임"을 적기 위한 계측이다(PRD KPI 대조용).
 */
function TuningPanel({ round, deathCount, onRegenerate }: TuningPanelProps) {
  // getTuning()은 오버라이드가 바뀔 때만 새 참조를 주지만, 리렌더를 유발하지는
  // 않는다 — 슬라이더를 움직인 사실을 화면에 반영하기 위한 자체 리렌더 카운터.
  const [revision, setRevision] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const startedAt = performance.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [round]);

  const tuning = getTuning();
  const overrides = tuningOverrides();
  const changedKeys = Object.keys(overrides) as (keyof Tuning)[];

  const handleChange = (spec: FieldSpec, displayed: number) => {
    const internal = spec.fromDisplay ? spec.fromDisplay(displayed) : displayed;
    setTuningOverride(spec.key, internal);
    setRevision((n) => n + 1);
    if (spec.needsRegenerate) onRegenerate();
  };

  const handleReset = () => {
    resetTuning();
    setRevision((n) => n + 1);
    onRegenerate();
  };

  if (collapsed) {
    return (
      <button type="button" className="tuning-panel__toggle" onClick={() => setCollapsed(false)}>
        튜닝 패널 열기
      </button>
    );
  }

  return (
    <aside className="tuning-panel" data-revision={revision}>
      <header className="tuning-panel__header">
        <strong>밸런스 튜닝</strong>
        <button type="button" className="tuning-panel__toggle" onClick={() => setCollapsed(true)}>
          접기
        </button>
      </header>

      <p className="tuning-panel__meta">
        {round}R · {elapsedSeconds}초 경과 · 사망 {deathCount}회
      </p>

      {FIELDS.map((spec) => {
        const value = displayValue(spec, tuning);
        const isChanged = changedKeys.includes(spec.key);
        return (
          <label key={spec.key} className={isChanged ? "tuning-field tuning-field--changed" : "tuning-field"}>
            <span className="tuning-field__label">
              {spec.label}
              {spec.needsRegenerate && <span className="tuning-field__badge" title="바꾸면 스테이지를 다시 만든다" />}
            </span>
            <input
              type="range"
              min={spec.min}
              max={spec.max}
              step={spec.step}
              value={value}
              onChange={(event) => handleChange(spec, Number(event.target.value))}
            />
            <span className="tuning-field__value">
              {Math.round(value * 100) / 100}
              {spec.unit}
            </span>
          </label>
        );
      })}

      <footer className="tuning-panel__footer">
        <button type="button" className="tuning-panel__toggle" onClick={handleReset}>
          기본값으로
        </button>
        <span className="tuning-panel__hint">
          ● 표시 = 스테이지 재생성 필요 · 조정한 값 {changedKeys.length}개
        </span>
      </footer>

      {changedKeys.length > 0 && (
        // 확정할 때 `core/tuning.ts`의 TUNING_DEFAULTS에 그대로 옮겨 적기 위한 출력.
        <pre className="tuning-panel__diff">
          {changedKeys.map((key) => `${key}: ${overrides[key]},  // 기본 ${TUNING_DEFAULTS[key]}`).join("\n")}
        </pre>
      )}
    </aside>
  );
}

export default TuningPanel;
