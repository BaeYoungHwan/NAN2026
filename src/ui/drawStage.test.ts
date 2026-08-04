import { describe, expect, it } from "vitest";
import type { Stage } from "../core/stage";
import { drawStage } from "./drawStage";

/**
 * `fill()`이 호출되는 시점의 `fillStyle`을 순서대로 기록하는 최소 캔버스 스텁 —
 * 세이브 포인트·골이 어떤 색으로 그려지는지만 확인하면 되므로 그 외 API는 빈 함수다.
 */
function createCtxStub() {
  const fills: string[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    shadowColor: "",
    shadowBlur: 0,
    lineWidth: 0,
    fillRect: () => {},
    strokeRect: () => {},
    drawImage: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {
      fills.push(String(ctx.fillStyle));
    },
  };
  return { ctx, fills };
}

/** 셀 2개짜리 최소 스테이지 — 체크포인트 1개와 골만 그려지면 된다. */
function makeStage(): Stage {
  return {
    lightSources: [{ x: 0, y: 0 }],
    grid: { cols: 2, rows: 1, tileSize: 40, cells: new Uint8Array([0, 0]) },
    spawn: { x: 20, y: 20 },
    checkpoints: [{ x: 20, y: 20 }],
    goal: { x: 60, y: 20 },
    path: [{ x: 20, y: 20 }],
    distanceField: new Int32Array([0, 1]),
    checkpointProgress: [0],
    goalProgress: 1,
  };
}

const ACTIVATED = "#4caf50"; // 밟아서 활성화된 세이브 포인트
const IDLE = "#4a90d9"; // 아직 밟지 않은 세이브 포인트

describe("drawStage — 세이브 포인트 활성화 표시", () => {
  it("밟지 않은 세이브 포인트는 파란색으로 그린다", () => {
    const { ctx, fills } = createCtxStub();
    drawStage(ctx as unknown as CanvasRenderingContext2D, makeStage(), null, [false]);
    expect(fills).toContain(IDLE);
    expect(fills).not.toContain(ACTIVATED);
  });

  it("밟아서 활성화한 세이브 포인트는 초록색으로 그린다 — 활성화 상태가 화면까지 전달되는 배선", () => {
    const { ctx, fills } = createCtxStub();
    drawStage(ctx as unknown as CanvasRenderingContext2D, makeStage(), null, [true]);
    expect(fills).toContain(ACTIVATED);
    expect(fills).not.toContain(IDLE);
  });

  it("활성화 배열이 비어 있어도(길이 불일치) 밟지 않은 것으로 그린다 — 라운드 전환 프레임 방어", () => {
    const { ctx, fills } = createCtxStub();
    drawStage(ctx as unknown as CanvasRenderingContext2D, makeStage(), null, []);
    expect(fills).toContain(IDLE);
    expect(fills).not.toContain(ACTIVATED);
  });

  it("체크포인트가 없는 스테이지도 골은 그리고 예외를 던지지 않는다", () => {
    const { ctx, fills } = createCtxStub();
    const stage = { ...makeStage(), checkpoints: [], checkpointProgress: [] };
    expect(() => drawStage(ctx as unknown as CanvasRenderingContext2D, stage, null, [])).not.toThrow();
    expect(fills).not.toContain(IDLE);
    expect(fills).not.toContain(ACTIVATED);
    expect(fills).toContain("#f5a623"); // 골
  });
});
