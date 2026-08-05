// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { isTuningEnabled } from "./debugTuning";

function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

describe("isTuningEnabled", () => {
  afterEach(() => {
    setSearch("");
    vi.unstubAllEnvs();
  });

  it("쿼리 파라미터가 없으면 꺼져 있다 — 개발 서버에서도 기본은 비활성", () => {
    setSearch("");
    expect(isTuningEnabled()).toBe(false);
  });

  it("tune=1이면 켜진다", () => {
    setSearch("?tune=1");
    expect(isTuningEnabled()).toBe(true);
  });

  it("다른 라운드 쿼리와 함께 써도 켜진다 — ?round=3&tune=1 조합이 실제 사용 패턴", () => {
    setSearch("?round=3&tune=1");
    expect(isTuningEnabled()).toBe(true);
  });

  it("tune=1이 아닌 값이면 꺼져 있다", () => {
    setSearch("?tune=0");
    expect(isTuningEnabled()).toBe(false);

    setSearch("?tune=true");
    expect(isTuningEnabled()).toBe(false);

    setSearch("?tune");
    expect(isTuningEnabled()).toBe(false);
  });

  it("프로덕션 빌드에서는 tune=1이어도 꺼져 있다 — 심사 대상 빌드에서 난이도를 못 바꾸게 한다", () => {
    vi.stubEnv("DEV", false);
    setSearch("?tune=1");
    expect(isTuningEnabled()).toBe(false);
  });
});
