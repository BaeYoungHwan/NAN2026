import { describe, expect, it } from "vitest";
import {
  canvasRenderScale,
  deathFrameInfo,
  roundFadeAlpha,
  selectBodyPose,
  selectShadowExpression,
  shadowVerticalComponent,
} from "./GameCanvas";

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

describe("selectShadowExpression", () => {
  it("위험도가 낮으면 normal을 반환한다", () => {
    expect(selectShadowExpression(0)).toBe("normal");
    expect(selectShadowExpression(0.59)).toBe("normal");
  });

  it("위험도 0.6 이상 0.85 미만이면 surprised를 반환한다(경계값 포함)", () => {
    expect(selectShadowExpression(0.6)).toBe("surprised");
    expect(selectShadowExpression(0.84)).toBe("surprised");
  });

  it("위험도 0.85 이상이면 scared를 반환한다(경계값·이탈 이후 값 포함)", () => {
    expect(selectShadowExpression(0.85)).toBe("scared");
    expect(selectShadowExpression(1.5)).toBe("scared");
  });

  it("selectBodyPose와 동일한 임계값(0.6/0.85)을 공유해 항상 같은 위험 구간에서 함께 전환된다", () => {
    for (const margin of [0, 0.3, 0.6, 0.7, 0.85, 1, 1.5]) {
      const bodyPose = selectBodyPose(margin, false);
      const shadowExpression = selectShadowExpression(margin);
      if (bodyPose === "idle") expect(shadowExpression).toBe("normal");
      if (bodyPose === "flinch") expect(shadowExpression).toBe("surprised");
      if (bodyPose === "danger") expect(shadowExpression).toBe("scared");
    }
  });
});

describe("shadowVerticalComponent", () => {
  it("각도가 정확히 수평(0, π)이어도 0을 반환하지 않는다 — drawShadowSprite 전단 변환 퇴화 방지", () => {
    expect(shadowVerticalComponent(0)).not.toBe(0);
    expect(shadowVerticalComponent(Math.PI)).not.toBe(0);
    expect(Math.abs(shadowVerticalComponent(0))).toBeGreaterThan(0);
  });

  it("수평에 가까운 각도에서도 최소 크기 이상을 유지한다", () => {
    const nearHorizontal = 0.001;
    expect(Math.abs(shadowVerticalComponent(nearHorizontal))).toBeGreaterThanOrEqual(0.12);
  });

  it("이미 충분히 수직 성분이 큰 각도에서는 Math.sin과 동일한 값을 그대로 반환한다", () => {
    expect(shadowVerticalComponent(Math.PI / 2)).toBeCloseTo(1);
    expect(shadowVerticalComponent(-Math.PI / 2)).toBeCloseTo(-1);
  });

  it("원래 sinθ의 부호를 보존한다", () => {
    expect(shadowVerticalComponent(-0.001)).toBeLessThan(0);
    expect(shadowVerticalComponent(0.001)).toBeGreaterThan(0);
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

describe("roundFadeAlpha", () => {
  it("페이드 중이 아니면(시작 시각 null) 0을 반환한다", () => {
    expect(roundFadeAlpha(null, 1000)).toBe(0);
  });

  it("전환 직후 첫 프레임은 완전히 검다", () => {
    expect(roundFadeAlpha(1000, 1000)).toBe(1);
  });

  it("시간이 지날수록 선형으로 걷힌다", () => {
    // ROUND_FADE_MS = 550 — 절반 지점에서 0.5
    expect(roundFadeAlpha(1000, 1000 + 275)).toBeCloseTo(0.5);
  });

  it("페이드 시간이 지나면 0에서 멈춘다(음수로 내려가지 않는다)", () => {
    expect(roundFadeAlpha(1000, 1000 + 550)).toBe(0);
    expect(roundFadeAlpha(1000, 1000 + 5000)).toBe(0);
  });

  it("타임스탬프가 뒤로 가도 1을 넘지 않는다", () => {
    expect(roundFadeAlpha(1000, 500)).toBe(1);
  });
});

describe("canvasRenderScale", () => {
  it("논리 크기 그대로 표시되고 dpr이 1이면 배율도 1 — 예전과 동일한 동작", () => {
    expect(canvasRenderScale(800, 1)).toBe(1);
  });

  it("고DPI 화면에서는 백킹 스토어를 기기 픽셀비만큼 키운다", () => {
    expect(canvasRenderScale(800, 1.5)).toBeCloseTo(1.5);
    expect(canvasRenderScale(800, 2)).toBeCloseTo(2);
  });

  it("CSS로 축소된 만큼 배율도 함께 줄어든다 — 표시 폭에 비례한다", () => {
    expect(canvasRenderScale(400, 1)).toBeCloseTo(0.5);
    expect(canvasRenderScale(600, 1)).toBeCloseTo(0.75);
  });

  it("축소와 고DPI가 겹치면 곱해진다 — 작게 보여도 선명함은 유지된다", () => {
    expect(canvasRenderScale(400, 2)).toBeCloseTo(1);
  });

  it("상한(2)을 넘지 않는다 — 3x 디스플레이에서도 픽셀 수가 폭발하지 않는다", () => {
    expect(canvasRenderScale(800, 3)).toBe(2);
    expect(canvasRenderScale(1600, 2)).toBe(2);
  });

  it("devicePixelRatio가 비정상(0/음수)이면 1로 간주한다", () => {
    expect(canvasRenderScale(800, 0)).toBe(1);
    expect(canvasRenderScale(800, -2)).toBe(1);
  });

  it("표시 폭이 0이어도 하한 아래로 내려가지 않는다 — 레이아웃 전 방어값", () => {
    expect(canvasRenderScale(0, 1)).toBe(0.25);
  });
});
