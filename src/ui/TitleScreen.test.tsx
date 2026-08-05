// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TitleScreen, { GAME_TITLE } from "./TitleScreen";

afterEach(cleanup);

describe("TitleScreen", () => {
  it("게임 제목과 조작 키를 보여준다", () => {
    render(<TitleScreen onStart={() => {}} />);
    expect(screen.getByText(GAME_TITLE)).toBeInTheDocument();
    expect(screen.getByText("W A S D")).toBeInTheDocument();
    expect(screen.getByText(", .")).toBeInTheDocument();
  });

  it("Enter를 누르면 시작한다", () => {
    const onStart = vi.fn();
    render(<TitleScreen onStart={onStart} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("Space를 눌러도 시작한다 — 컷신(CutsceneSlide)과 같은 키 계약", () => {
    const onStart = vi.fn();
    render(<TitleScreen onStart={onStart} />);
    fireEvent.keyDown(window, { key: " " });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("다른 키에는 반응하지 않는다 — 조작 키(WASD)로 실수 시작되지 않아야 한다", () => {
    const onStart = vi.fn();
    render(<TitleScreen onStart={onStart} />);
    fireEvent.keyDown(window, { key: "w" });
    fireEvent.keyDown(window, { key: "," });
    expect(onStart).not.toHaveBeenCalled();
  });

  it("클릭으로도 시작한다", () => {
    const onStart = vi.fn();
    render(<TitleScreen onStart={onStart} />);
    fireEvent.click(screen.getByText(GAME_TITLE));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("효과음 콜백이 없어도 예외 없이 동작한다 — 오디오 폴백 계약", () => {
    const onStart = vi.fn();
    render(<TitleScreen onStart={onStart} />);
    expect(() => fireEvent.keyDown(window, { key: "Enter" })).not.toThrow();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("시작 시 효과음을 재생한다", () => {
    const playSound = vi.fn();
    render(<TitleScreen onStart={() => {}} playSound={playSound} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(playSound).toHaveBeenCalledWith("uiClick");
  });
});
