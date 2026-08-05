// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { debugRoundFromQuery } from "./debugRound";

function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

describe("debugRoundFromQuery", () => {
  afterEach(() => {
    setSearch("");
  });

  it("쿼리 파라미터가 없으면 1을 반환한다", () => {
    setSearch("");
    expect(debugRoundFromQuery()).toBe(1);
  });

  it("round=2면 2를 반환한다", () => {
    setSearch("?round=2");
    expect(debugRoundFromQuery()).toBe(2);
  });

  it("round=3이면 3을 반환한다", () => {
    setSearch("?round=3");
    expect(debugRoundFromQuery()).toBe(3);
  });

  it("2/3이 아닌 값이면 1로 폴백한다", () => {
    setSearch("?round=4");
    expect(debugRoundFromQuery()).toBe(1);

    setSearch("?round=abc");
    expect(debugRoundFromQuery()).toBe(1);
  });
});
