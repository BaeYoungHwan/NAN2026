// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DialogueBox from "./DialogueBox";

afterEach(cleanup);

describe("DialogueBox", () => {
  it("큐가 비어있으면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(<DialogueBox queue={[]} onAdvance={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("큐의 첫 줄을 렌더링한다", () => {
    render(<DialogueBox queue={["첫 줄", "둘째 줄"]} onAdvance={() => {}} />);
    expect(screen.getByText("첫 줄")).toBeInTheDocument();
    expect(screen.queryByText("둘째 줄")).not.toBeInTheDocument();
  });

  it("대사 박스를 클릭하면 onAdvance가 호출된다", () => {
    const onAdvance = vi.fn();
    render(<DialogueBox queue={["대사"]} onAdvance={onAdvance} />);
    fireEvent.click(screen.getByText("대사"));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("Enter 또는 Space 키를 누르면 onAdvance가 호출된다", () => {
    const onAdvance = vi.fn();
    render(<DialogueBox queue={["대사"]} onAdvance={onAdvance} />);
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: " " });
    expect(onAdvance).toHaveBeenCalledTimes(2);
  });

  it("autoDismissMs 미지정 시 진행 안내 문구를 보여준다", () => {
    render(<DialogueBox queue={["대사"]} onAdvance={() => {}} />);
    expect(screen.getByText(/클릭 또는 Enter/)).toBeInTheDocument();
  });

  it("저승사자 초상 이미지를 올바른 경로로 렌더링한다", () => {
    render(<DialogueBox queue={["대사"]} onAdvance={() => {}} />);
    // data-testid로 조회 — alt=""(장식 이미지)는 암묵적 role이 "img"가 아니라
    // "presentation"이라 getByRole("img")로는 안 잡힌다. (실제 파일 존재 여부까지
    // 검증하는 안도 검토했으나, src/ 아래는 브라우저 전용 타입 경계를 지키느라
    // node:fs를 안 쓰는 이 프로젝트 관례상 도입하지 않음 — PR #23 리뷰)
    const img = screen.getByTestId("reaper-portrait");
    expect(img).toHaveAttribute("src", expect.stringContaining("reaper-portrait-neutral"));
  });

  it("초상을 클릭해도 onAdvance가 호출된다 — 박스 밖으로 튀어나온 부분도 클릭 반응해야 함", () => {
    const onAdvance = vi.fn();
    render(<DialogueBox queue={["대사"]} onAdvance={onAdvance} />);
    fireEvent.click(screen.getByTestId("reaper-portrait"));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("초상 이미지 로드에 실패하면 깨진 이미지 아이콘 대신 조용히 숨긴다", () => {
    render(<DialogueBox queue={["대사"]} onAdvance={() => {}} />);
    const img = screen.getByTestId("reaper-portrait");
    fireEvent.error(img);
    expect(screen.queryByTestId("reaper-portrait")).not.toBeInTheDocument();
  });

  describe("autoDismissMs 지정 시", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("안내 문구를 숨기고, 지정 시간 후 자동으로 onAdvance를 호출한다", () => {
      const onAdvance = vi.fn();
      render(<DialogueBox queue={["대사"]} onAdvance={onAdvance} autoDismissMs={1500} />);

      expect(screen.queryByText(/클릭 또는 Enter/)).not.toBeInTheDocument();
      expect(onAdvance).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1499);
      expect(onAdvance).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onAdvance).toHaveBeenCalledTimes(1);
    });
  });
});
