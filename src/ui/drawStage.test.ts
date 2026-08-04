import { describe, expect, it } from "vitest";
import type { Stage } from "../core/stage";
import { drawStage } from "./drawStage";

// buildFloorGrain/buildWallLayer는 오프스크린 <canvas>에 정적 레이어를 미리
// 그려 캐싱한다(drawStage.ts 참고). 이 스위트는 Node 환경(document 없음)에서
// 도니, getContext가 null을 반환하는 최소 스텁만 제공해 두 함수가 이미
// 갖추고 있는 "2D 컨텍스트 생성 실패" 폴백 경로(빈 레이어 반환)를 타게 한다.
(globalThis as unknown as { document: unknown }).document = {
  createElement: () => ({ getContext: () => null, width: 0, height: 0 }),
};

/**
 * `fill()`이 호출되는 시점의 `fillStyle`을 순서대로 기록하는 최소 캔버스 스텁 —
 * 세이브 포인트·골이 어떤 색으로 그려지는지만 확인하면 되므로 그 외 API는 빈
 * 함수다. `drawCandleMark`가 그라디언트·곡선 API도 쓰므로 호출만 받아주는
 * no-op으로 채운다.
 */
function createCtxStub() {
  const fills: string[] = [];
  const gradientStub = { addColorStop: () => {} };
  const ctx = {
    fillStyle: "" as string | typeof gradientStub,
    strokeStyle: "",
    shadowColor: "",
    shadowBlur: 0,
    lineWidth: 0,
    fillRect: () => {},
    strokeRect: () => {},
    drawImage: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    ellipse: () => {},
    arc: () => {},
    stroke: () => {},
    createRadialGradient: () => gradientStub,
    createLinearGradient: () => gradientStub,
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
const IDLE = "#f0e6d2"; // 아직 밟지 않은 세이브 포인트(제단 촛불의 크림색 불꽃)

describe("drawStage — 세이브 포인트 활성화 표시", () => {
  it("밟지 않은 세이브 포인트는 크림색으로 그린다", () => {
    const { ctx, fills } = createCtxStub();
    drawStage(ctx as unknown as CanvasRenderingContext2D, makeStage(), null, [false], 1);
    expect(fills).toContain(IDLE);
    expect(fills).not.toContain(ACTIVATED);
  });

  it("밟아서 활성화한 세이브 포인트는 초록색으로 그린다 — 활성화 상태가 화면까지 전달되는 배선", () => {
    const { ctx, fills } = createCtxStub();
    drawStage(ctx as unknown as CanvasRenderingContext2D, makeStage(), null, [true], 1);
    expect(fills).toContain(ACTIVATED);
    expect(fills).not.toContain(IDLE);
  });

  it("활성화 배열이 비어 있어도(길이 불일치) 밟지 않은 것으로 그린다 — 라운드 전환 프레임 방어", () => {
    const { ctx, fills } = createCtxStub();
    drawStage(ctx as unknown as CanvasRenderingContext2D, makeStage(), null, [], 1);
    expect(fills).toContain(IDLE);
    expect(fills).not.toContain(ACTIVATED);
  });

  it("체크포인트가 없는 스테이지도 골은 그리고 예외를 던지지 않는다", () => {
    const { ctx, fills } = createCtxStub();
    const stage = { ...makeStage(), checkpoints: [], checkpointProgress: [] };
    expect(() => drawStage(ctx as unknown as CanvasRenderingContext2D, stage, null, [], 1)).not.toThrow();
    expect(fills).not.toContain(IDLE);
    expect(fills).not.toContain(ACTIVATED);
    expect(fills).toContain("#f5a623"); // 골
  });
});
