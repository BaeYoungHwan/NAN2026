// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TitleScreen, { GAME_TITLE } from "./TitleScreen";
import { ATTRIBUTION_REQUIRED, MODIFIED_NOTICE, formatLicenseUrl } from "../content/credits";

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

  // BGM 5곡 중 2곡이 CC-BY라 저작자 표시가 **라이선스상 의무**다. 화면을 정리하다
  // 무심코 지우면 라이선스 위반이 되므로, 없어지면 실패하도록 못을 박아둔다.
  it("표기 의무가 있는 곡의 제목·저작자·라이선스를 화면에 표시한다", () => {
    render(<TitleScreen onStart={() => {}} />);

    // 의무 대상이 하나도 없으면 이 테스트는 통과해도 아무것도 검증하지 않는다.
    expect(ATTRIBUTION_REQUIRED.length).toBeGreaterThan(0);

    // 크레딧은 <p> 하나에 통으로 들어가므로 텍스트를 직접 읽어 부분 문자열을 확인한다.
    // getByText에 정규식을 넘기면 저작자명의 괄호·마침표가 패턴으로 해석되어(예:
    // "Mr. X (aka Y)") 매칭이 어긋나거나 SyntaxError가 난다.
    const credit = screen.getByText(/^음악 —/);
    for (const { title, author, license } of ATTRIBUTION_REQUIRED) {
      expect(credit).toHaveTextContent(title);
      expect(credit).toHaveTextContent(author);
      expect(credit).toHaveTextContent(license);
    }
  });

  // CC BY 4.0 §3(a)(1)(B)(C)는 저작자 표시 외에 "변경 사실"과 "라이선스 전문 또는 그
  // URI"까지 요구한다 — 라이선스 이름만 적는 것으로는 부족하다.
  it("변경 사실과 라이선스 URI를 화면에 표시한다 — 라이선스 의무", () => {
    render(<TitleScreen onStart={() => {}} />);
    const credit = screen.getByText(/^음악 —/);

    for (const entry of ATTRIBUTION_REQUIRED) {
      if (entry.modified) expect(credit).toHaveTextContent(MODIFIED_NOTICE);
      expect(credit).toHaveTextContent(formatLicenseUrl(entry.licenseUrl));
    }
  });

  // 크레딧이 길어지면 오버레이에 스크롤이 생기는데, 클릭 핸들러가 그 스크롤 컨테이너에
  // 걸려 있으면 스크롤바 트랙 클릭만으로 게임이 시작된다(실측으로 재현했다). jsdom에는
  // 스크롤바가 없으므로, 같은 회귀를 "본문 밖(크레딧) 클릭은 시작이 아니다"로 잡는다 —
  // 핸들러가 다시 바깥 컨테이너로 올라가면 이 테스트가 실패한다.
  it("크레딧 영역을 클릭해도 게임이 시작되지 않는다", () => {
    const onStart = vi.fn();
    render(<TitleScreen onStart={onStart} />);

    fireEvent.click(screen.getByText(/^음악 —/));
    expect(onStart).not.toHaveBeenCalled();

    // 본문 클릭은 여전히 시작되어야 한다.
    fireEvent.click(screen.getByText(GAME_TITLE));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
