// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TuningPanel from "./TuningPanel";
import { getTuning, resetTuning } from "../core/tuning";

/** 슬라이더 하나를 라벨 텍스트로 찾는다 — 각 필드는 `<label>` 안에 range input 하나뿐이다. */
function sliderFor(label: string): HTMLInputElement {
  const field = screen.getByText(label).closest("label");
  if (!field) throw new Error(`${label} 필드를 찾지 못했다`);
  const input = field.querySelector<HTMLInputElement>('input[type="range"]');
  if (!input) throw new Error(`${label} 슬라이더를 찾지 못했다`);
  return input;
}

beforeEach(() => {
  vi.useFakeTimers();
  resetTuning();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetTuning();
});

describe("TuningPanel — 재생성 요청", () => {
  it("드래그하는 동안 값은 즉시 반영되지만 재생성은 한 번만 요청한다", () => {
    const onRegenerate = vi.fn();
    render(<TuningPanel round={1} deathCount={0} onRegenerate={onRegenerate} />);

    // range input의 onChange는 드래그 중 값이 바뀔 때마다 발화한다 — 그 상황을 재현한다.
    const slider = sliderFor("맵 가로");
    for (const value of [21, 22, 23, 24, 25]) {
      fireEvent.change(slider, { target: { value: String(value) } });
    }

    // 값 자체는 기다리지 않고 곧바로 적용돼야 한다(슬라이더가 손을 따라가야 하므로).
    expect(getTuning().worldCols).toBe(25);
    expect(onRegenerate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("재생성이 필요 없는 값(허용 각도)은 재생성을 요청하지 않는다", () => {
    const onRegenerate = vi.fn();
    render(<TuningPanel round={1} deathCount={0} onRegenerate={onRegenerate} />);

    fireEvent.change(sliderFor("허용 각도"), { target: { value: "45" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(getTuning().safeAngleTolerance).toBeCloseTo(Math.PI / 4);
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it("언마운트되면 예약된 재생성이 실행되지 않는다", () => {
    const onRegenerate = vi.fn();
    const { unmount } = render(<TuningPanel round={1} deathCount={0} onRegenerate={onRegenerate} />);

    fireEvent.change(sliderFor("통로 폭"), { target: { value: "3" } });
    unmount();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it("기본값 복원 버튼도 재생성을 한 번만 요청한다 — 직전 드래그 예약과 겹치지 않는다", () => {
    const onRegenerate = vi.fn();
    render(<TuningPanel round={1} deathCount={0} onRegenerate={onRegenerate} />);

    fireEvent.change(sliderFor("맵 가로"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "기본값으로" }));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(getTuning().worldCols).toBe(20); // TUNING_DEFAULTS로 복원
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });
});
