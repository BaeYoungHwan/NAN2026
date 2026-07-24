import { describe, expect, it } from "vitest";
import { isReachable } from "../procgen/reachability";
import { DEFAULT_SEED, generateStage } from "../procgen/stageGenerator";
import { applyLearning, cellKey, MAX_AI_BLOCKS, type VisitCounts } from "./pathBlocker";

/**
 * GameCanvas.restart()가 실제로 호출하는 applyLearning을 그대로 써서 재현한다
 * (로직을 여기서 재구현하지 않음 — 실제 프로덕션 코드 경로를 검증하기 위함) —
 * "여러 번 재시작해도 스테이지가 항상 풀린다"를 회귀 테스트로 고정한다.
 */
describe("이동 패턴 학습 AI — 재시작 반복 통합 시나리오", () => {
  it("같은 경로로 여러 번 재시작해도 스테이지는 항상 스폰→체크포인트→골까지 도달 가능하다", () => {
    let stage = generateStage(DEFAULT_SEED);

    for (let restartCount = 0; restartCount < 10; restartCount++) {
      // 플레이어가 매번 같은 경로(스폰→골 방향)만 밟았다고 가정 — grid 안의 모든
      // walkable 셀을 "많이 방문한 것"으로 기록해 AI가 최대한 공격적으로 막게 한다.
      const visits: VisitCounts = new Map();
      for (let row = 0; row < stage.grid.rows; row++) {
        for (let col = 0; col < stage.grid.cols; col++) {
          if (stage.grid.cells[row * stage.grid.cols + col] === 0) {
            const point = { x: (col + 0.5) * stage.grid.tileSize, y: (row + 0.5) * stage.grid.tileSize };
            visits.set(cellKey(stage.grid, point), 100);
          }
        }
      }

      stage = applyLearning(DEFAULT_SEED, stage, visits, MAX_AI_BLOCKS);

      const checkpoints = [stage.spawn, ...stage.checkpoints, stage.goal];
      for (let i = 0; i < checkpoints.length - 1; i++) {
        expect(isReachable(stage.grid, checkpoints[i], checkpoints[i + 1])).toBe(true);
      }
    }

    // 10번 재시작 동안 실제로 벽이 누적됐는지도 확인 — 아무것도 안 막혔다면 AI가
    // 사실상 동작 안 하는 것과 같다.
    expect(stage.aiBlockedCells.length).toBeGreaterThan(0);
  });
});
