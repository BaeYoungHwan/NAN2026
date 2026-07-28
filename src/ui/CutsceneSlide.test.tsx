// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CutsceneSlide from "./CutsceneSlide";

afterEach(cleanup);

describe("CutsceneSlide", () => {
  it("첫 슬라이드를 렌더링한다", () => {
    render(<CutsceneSlide slides={["첫 슬라이드", "둘째 슬라이드"]} onFinish={() => {}} />);
    expect(screen.getByText("첫 슬라이드")).toBeInTheDocument();
    expect(screen.queryByText("둘째 슬라이드")).not.toBeInTheDocument();
  });

  it("클릭하면 다음 슬라이드로 넘어간다", () => {
    render(<CutsceneSlide slides={["첫 슬라이드", "둘째 슬라이드"]} onFinish={() => {}} />);
    fireEvent.click(screen.getByText("첫 슬라이드"));
    expect(screen.getByText("둘째 슬라이드")).toBeInTheDocument();
  });

  it("Enter/Space 키로도 다음 슬라이드로 넘어간다", () => {
    render(<CutsceneSlide slides={["첫 슬라이드", "둘째 슬라이드"]} onFinish={() => {}} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByText("둘째 슬라이드")).toBeInTheDocument();
  });

  it("마지막 슬라이드에서 넘기면 onFinish가 호출되고 컴포넌트는 사라진다", () => {
    const onFinish = vi.fn();
    const { container } = render(<CutsceneSlide slides={["유일한 슬라이드"]} onFinish={onFinish} />);
    fireEvent.click(screen.getByText("유일한 슬라이드"));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });
});
