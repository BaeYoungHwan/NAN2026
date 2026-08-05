import { afterEach, describe, expect, it } from "vitest";
import { getTuning, resetTuning, setTuningOverride, TUNING_DEFAULTS, tuningOverrides } from "./tuning";

// 오버라이드는 모듈 전역 상태다 — 한 테스트가 남긴 값이 다음 테스트로 새지 않게 한다.
afterEach(resetTuning);

describe("getTuning", () => {
  it("오버라이드가 없으면 기본값과 동일하다", () => {
    expect(getTuning()).toEqual(TUNING_DEFAULTS);
  });

  it("같은 참조를 돌려준다 — rAF 루프에서 매 프레임 호출해도 객체를 새로 만들지 않는다", () => {
    expect(getTuning()).toBe(getTuning());
  });
});

describe("setTuningOverride", () => {
  it("지정한 값만 바뀌고 나머지는 기본값으로 남는다", () => {
    setTuningOverride("rotationSpeed", 5);
    expect(getTuning().rotationSpeed).toBe(5);
    expect(getTuning().shadowLength).toBe(TUNING_DEFAULTS.shadowLength);
  });

  it("여러 번 걸면 누적된다", () => {
    setTuningOverride("rotationSpeed", 5);
    setTuningOverride("shadowLength", 120);
    expect(getTuning().rotationSpeed).toBe(5);
    expect(getTuning().shadowLength).toBe(120);
  });

  it("같은 키를 다시 걸면 마지막 값이 이긴다", () => {
    setTuningOverride("pathSteps", 40);
    setTuningOverride("pathSteps", 120);
    expect(getTuning().pathSteps).toBe(120);
  });

  it("기본값 객체 자체는 오염되지 않는다 — 되돌릴 기준이 살아 있어야 한다", () => {
    setTuningOverride("shadowLength", 999);
    expect(TUNING_DEFAULTS.shadowLength).toBe(80);
  });

  it("값을 바꾸면 새 참조가 된다 — 읽는 쪽이 캐시해 둔 객체와 구분된다", () => {
    const before = getTuning();
    setTuningOverride("shadowLength", 120);
    expect(getTuning()).not.toBe(before);
  });
});

describe("resetTuning", () => {
  it("모든 오버라이드를 지운다", () => {
    setTuningOverride("rotationSpeed", 5);
    setTuningOverride("shadowLength", 120);
    resetTuning();
    expect(getTuning()).toEqual(TUNING_DEFAULTS);
    expect(tuningOverrides()).toEqual({});
  });
});

describe("tuningOverrides", () => {
  it("기본값과 다르게 조정한 항목만 반환한다", () => {
    setTuningOverride("lightSpacingSteps", 12);
    expect(tuningOverrides()).toEqual({ lightSpacingSteps: 12 });
  });
});

describe("TUNING_DEFAULTS", () => {
  it("동결돼 있어 실수로 덮어쓸 수 없다", () => {
    expect(Object.isFrozen(TUNING_DEFAULTS)).toBe(true);
  });

  it("PRD/ADR에 기록된 현재 값과 일치한다 — 문서와 코드가 어긋나면 여기서 잡힌다", () => {
    expect(TUNING_DEFAULTS.shadowLength).toBe(80);
    expect(TUNING_DEFAULTS.safeAngleTolerance).toBeCloseTo(Math.PI / 6); // ±30도
    expect(TUNING_DEFAULTS.rotationSpeed).toBeCloseTo(Math.PI); // 180도/초
    expect(TUNING_DEFAULTS.lightSwitchGraceSeconds).toBe(1.2);
    expect(TUNING_DEFAULTS.round3ToleranceMultiplier).toBe(0.5);
    expect(TUNING_DEFAULTS.corridorWidth).toBe(2);
    expect(TUNING_DEFAULTS.pathSteps).toBe(80);
    expect(TUNING_DEFAULTS.minSpanCells).toBe(16);
    expect(TUNING_DEFAULTS.savePointsPerStage).toBe(1);
    expect(TUNING_DEFAULTS.lightSpacingSteps).toBe(8);
  });

  it("광원 전환 유예는 최악(180도) 회전 시간보다 길어야 한다 — 유예가 짧으면 전환 구간이 즉사 구간이 된다", () => {
    const worstCaseRotationSeconds = Math.PI / TUNING_DEFAULTS.rotationSpeed;
    expect(TUNING_DEFAULTS.lightSwitchGraceSeconds).toBeGreaterThan(worstCaseRotationSeconds);
  });
});
