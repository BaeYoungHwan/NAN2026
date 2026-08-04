import { describe, expect, it } from "vitest";
import { DANGER_THRESHOLD, dangerBeepSpec, justReturnedToSafety } from "./dangerTone";

describe("dangerBeepSpec", () => {
  it("안전 구간(임계값 미만)에서는 경고음을 내지 않는다", () => {
    expect(dangerBeepSpec(0).active).toBe(false);
    expect(dangerBeepSpec(DANGER_THRESHOLD - 0.01).active).toBe(false);
  });

  it("임계값에 도달하면 경고를 시작한다 — 가장 느린 간격, 가장 작은 음량", () => {
    const spec = dangerBeepSpec(DANGER_THRESHOLD);
    expect(spec.active).toBe(true);
    expect(spec.intervalMs).toBe(500);
    expect(spec.volume).toBeCloseTo(0.2);
  });

  it("허용 경계(margin=1)에서 가장 빠르고 크게 울린다", () => {
    const spec = dangerBeepSpec(1);
    expect(spec.active).toBe(true);
    expect(spec.intervalMs).toBe(120);
    expect(spec.volume).toBeCloseTo(1);
  });

  it("경계를 넘으면(이미 사망 판정) 경고를 멈춘다 — 사망음에 자리를 넘긴다", () => {
    expect(dangerBeepSpec(1.01).active).toBe(false);
    expect(dangerBeepSpec(5).active).toBe(false);
  });

  it("위험할수록 간격은 좁아지고 음량은 커진다(단조)", () => {
    const samples = [0.6, 0.7, 0.8, 0.9, 1].map(dangerBeepSpec);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].intervalMs).toBeLessThan(samples[i - 1].intervalMs);
      expect(samples[i].volume).toBeGreaterThan(samples[i - 1].volume);
    }
  });

  it("재생 간격이 항상 파일 길이(80ms)보다 길다 — 비프가 서로 겹쳐 뭉치지 않아야 한다", () => {
    for (let margin = DANGER_THRESHOLD; margin <= 1; margin += 0.02) {
      expect(dangerBeepSpec(margin).intervalMs).toBeGreaterThan(80);
    }
  });

  it("유한하지 않은 값은 경고하지 않는다 — 허용 각도가 0이면 margin이 NaN/Infinity가 될 수 있다", () => {
    expect(dangerBeepSpec(Number.NaN).active).toBe(false);
    expect(dangerBeepSpec(Number.POSITIVE_INFINITY).active).toBe(false);
  });
});

describe("justReturnedToSafety", () => {
  it("위험 구간에서 안전으로 빠져나온 프레임에만 true를 반환한다", () => {
    expect(justReturnedToSafety(0.8, 0.4)).toBe(true);
  });

  it("계속 위험하거나 계속 안전한 동안에는 false다", () => {
    expect(justReturnedToSafety(0.8, 0.9)).toBe(false);
    expect(justReturnedToSafety(0.2, 0.3)).toBe(false);
  });

  it("안전에서 위험으로 들어가는 방향은 안도음 대상이 아니다", () => {
    expect(justReturnedToSafety(0.3, 0.9)).toBe(false);
  });

  it("사망 판정(1 초과)에서 리스폰으로 안전해진 경우도 복귀로 본다", () => {
    expect(justReturnedToSafety(1.5, 0)).toBe(true);
  });
});
