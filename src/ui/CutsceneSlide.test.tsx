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

describe("CutsceneSlide — holdAtEnd (엔딩 종료 상태)", () => {
  it("마지막 슬라이드에서 더 넘어가지 않고 그대로 남는다", () => {
    const onFinish = vi.fn();
    render(<CutsceneSlide slides={["첫", "마지막"]} onFinish={onFinish} holdAtEnd />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByText("마지막")).toBeInTheDocument();

    // 여기서 더 눌러도 사라지지 않아야 한다 — 사라지면 조작이 멈춘 게임 화면만 남는다.
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByText("마지막")).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("마지막 슬라이드에서는 재시작 안내로 힌트가 바뀐다", () => {
    render(<CutsceneSlide slides={["첫", "마지막"]} onFinish={() => {}} holdAtEnd />);
    expect(screen.getByText(/Enter\/Space로 계속/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByText(/재시작 버튼/)).toBeInTheDocument();
    expect(screen.queryByText(/Enter\/Space로 계속/)).not.toBeInTheDocument();
  });

  it("마지막 슬라이드에서 더 눌러도 넘김 효과음을 내지 않는다 — 반응 없이 소리만 나면 안 된다", () => {
    const playSound = vi.fn();
    render(<CutsceneSlide slides={["하나"]} onFinish={() => {}} holdAtEnd playSound={playSound} />);
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.click(screen.getByText("하나"));
    expect(playSound).not.toHaveBeenCalled();
  });

  it("holdAtEnd가 없으면 기존대로 마지막을 넘겨 onFinish를 호출한다", () => {
    const onFinish = vi.fn();
    render(<CutsceneSlide slides={["하나"]} onFinish={onFinish} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
