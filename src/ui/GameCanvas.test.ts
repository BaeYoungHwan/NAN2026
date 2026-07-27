import { describe, expect, it } from "vitest";
import { deathFrameInfo, selectBodyPose } from "./GameCanvas";

describe("selectBodyPose", () => {
  it("이동 중이면 위험도와 무관하게 항상 walk를 반환한다", () => {
    expect(selectBodyPose(0, true)).toBe("walk");
    expect(selectBodyPose(2, true)).toBe("walk");
  });

  it("정지 상태에서 위험도가 낮으면 idle을 반환한다", () => {
    expect(selectBodyPose(0, false)).toBe("idle");
    expect(selectBodyPose(0.59, false)).toBe("idle");
  });

  it("위험도 0.6 이상 0.85 미만이면 flinch를 반환한다(경계값 포함)", () => {
    expect(selectBodyPose(0.6, false)).toBe("flinch");
    expect(selectBodyPose(0.84, false)).toBe("flinch");
  });

  it("위험도 0.85 이상이면 danger를 반환한다(경계값·이탈 이후 값 포함)", () => {
    expect(selectBodyPose(0.85, false)).toBe("danger");
    expect(selectBodyPose(1.5, false)).toBe("danger");
  });
});

describe("deathFrameInfo", () => {
  const TOTAL_MS = 1600;

  it("사망 직후(elapsed=0)에는 death1이며 임팩트 플래시가 최대치다", () => {
    const info = deathFrameInfo(0, TOTAL_MS, 0);
    expect(info.current).toBe("death1");
    expect(info.next).toBe("death2");
    expect(info.blend).toBe(0);
    expect(info.isImpactPhase).toBe(true);
    expect(info.impactFlash).toBeCloseTo(1);
    expect(info.fallRotation).toBeCloseTo(0);
    expect(info.vignette).toBe(0);
  });

  it("경계값(정확히 다음 구간 시작 비율)에서는 다음 구간으로 넘어간다", () => {
    // DEATH_PHASE_BOUNDARIES = [0, 0.16, 0.44, ...] — t < boundary 조건이라
    // t가 경계값과 정확히 같으면 그 경계가 속한 다음 구간(death3)으로 판정된다.
    const info = deathFrameInfo(TOTAL_MS * 0.44, TOTAL_MS, 0);
    expect(info.current).toBe("death3");
  });

  it("완전히 종료(elapsed>=total)되면 death4에 머무르고 블렌드가 없다", () => {
    const info = deathFrameInfo(TOTAL_MS, TOTAL_MS, 0);
    expect(info.current).toBe("death4");
    expect(info.next).toBe("death4");
    expect(info.blend).toBe(0);
    expect(info.isImpactPhase).toBe(false);
    expect(info.vignette).toBeCloseTo(0.35);
  });

  it("경과 시간이 총 시간을 넘어도(overshoot) 종료 상태로 고정된다", () => {
    const overshoot = deathFrameInfo(TOTAL_MS * 2, TOTAL_MS, 0);
    const exact = deathFrameInfo(TOTAL_MS, TOTAL_MS, 0);
    expect(overshoot).toEqual(exact);
  });

  it("구간이 끝나가는 지점(진행률 70% 이후)에는 다음 프레임과 크로스페이드한다", () => {
    // 1구간(death1, 0~0.16) 안에서 진행률 85% 지점 -> blend = (0.85-0.7)/0.3 = 0.5
    const phaseProgress = 0.85;
    const t = phaseProgress * 0.16;
    const info = deathFrameInfo(TOTAL_MS * t, TOTAL_MS, 0);
    expect(info.current).toBe("death1");
    expect(info.next).toBe("death2");
    expect(info.blend).toBeCloseTo(0.5);
  });
});
