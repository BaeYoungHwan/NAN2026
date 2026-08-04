import type { Stage } from "../core/stage";

/**
 * `#rrggbb` 헥스 문자열을 `"r, g, b"` 콤마 구분 문자열로 변환한다 —
 * `rgba(${...}, alpha)` 템플릿에 그대로 끼워 넣기 위함. 촛불 색을 hex 하나로만
 * 받고 여기서 rgb를 파생시켜, 두 표현을 따로 넘기다 하나만 바뀌어 어긋나는
 * 실수를 구조적으로 막는다.
 */
function hexToRgbString(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 0xff}, ${(value >> 8) & 0xff}, ${value & 0xff}`;
}

/**
 * 벽 채우기+AO+베벨 레이어를 오프스크린 캔버스 한 장에 미리 그려둔다. 이 그리드는
 * 라운드 전환 전까지 절대 바뀌지 않는데, 이 계산(300셀 순회 3회 + Path2D 생성)을
 * 매 프레임(rAF, ~60fps) 다시 하고 있었다 — `GameCanvas.tsx`의 `colliderCacheRef`가
 * 이미 쓰고 있는 "stage 참조가 바뀔 때만 재계산" 패턴을 여기도 맞춘다. `stage`
 * 객체별로 캐싱하므로(WeakMap) 라운드가 바뀌어 새 Stage가 만들어지면 자동으로
 * 새로 그려지고, 이전 캔버스는 참조가 끊겨 GC된다.
 */
const wallLayerCache = new WeakMap<Stage, HTMLCanvasElement>();

function buildWallLayer(stage: Stage): HTMLCanvasElement {
  const { grid } = stage;
  const mapWidth = grid.cols * grid.tileSize;
  const mapHeight = grid.rows * grid.tileSize;

  const layer = document.createElement("canvas");
  layer.width = mapWidth;
  layer.height = mapHeight;
  const ctx = layer.getContext("2d");
  if (!ctx) return layer;

  const isWall = (row: number, col: number): boolean => {
    if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return true;
    return grid.cells[row * grid.cols + col] === 1;
  };

  // 신화적인 "그림자 세계 균열/네온 경계" 방향은 배경 사진(따뜻한 콘크리트/석재
  // 바닥)과 계열이 전혀 안 맞는다는 피드백으로 폐기 — tile-art-prompt-guide.md가
  // 애초에 정의해 둔 "바닥보다 확실히 어두운 석재 턱(raised stone curb/ledge),
  // 베벨진 위쪽 모서리에 밝은 rim + 바닥과 맞닿는 부분의 은은한 AO 그림자"라는
  // 실제 벽 재질 스펙을 그대로 코드로 옮긴다. 채우기 자체도 배경 사진 평균 색
  // (round1.png ≈ rgb(125,112,91))과 같은 따뜻한 무채색 계열의 어두운 버전으로 —
  // 검정이나 보라가 아니라 "같은 돌바닥의 그림자 진 부분"처럼 보이게 한다.
  ctx.fillStyle = "rgba(40, 36, 31, 0.92)";
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (isWall(row, col)) {
        ctx.fillRect(col * grid.tileSize, row * grid.tileSize, grid.tileSize, grid.tileSize);
      }
    }
  }

  // 통로와 맞닿는 바깥 경계 변에만(=미로의 진짜 윤곽선) 베벨+AO를 그린다. 선이
  // 벽 칸 경계를 넘어 통로(바닥) 위로 새어나가지 않도록 벽 칸 전체를 클립 영역으로
  // 잡고 그 안에서만 그린다.
  const wallClip = new Path2D();
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (isWall(row, col)) {
        wallClip.rect(col * grid.tileSize, row * grid.tileSize, grid.tileSize, grid.tileSize);
      }
    }
  }

  const traceBoundary = (): void => {
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (!isWall(row, col)) continue;
        const x = col * grid.tileSize;
        const y = row * grid.tileSize;
        const size = grid.tileSize;
        ctx.beginPath();
        if (!isWall(row - 1, col)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + size, y);
        }
        if (!isWall(row + 1, col)) {
          ctx.moveTo(x, y + size);
          ctx.lineTo(x + size, y + size);
        }
        if (!isWall(row, col - 1)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + size);
        }
        if (!isWall(row, col + 1)) {
          ctx.moveTo(x + size, y);
          ctx.lineTo(x + size, y + size);
        }
        ctx.stroke();
      }
    }
  };

  ctx.save();
  ctx.clip(wallClip);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // AO — 턱이 바닥과 맞닿는 지점에 지는 부드러운 그림자. 경계에 걸쳐 굵게 그리고
  // 클립으로 벽 안쪽 절반만 남긴다.
  ctx.strokeStyle = "rgba(8, 6, 4, 0.55)";
  ctx.shadowColor = "rgba(8, 6, 4, 0.5)";
  ctx.shadowBlur = 5;
  ctx.lineWidth = 7;
  traceBoundary();

  // 베벨 — 턱의 위쪽 모서리가 빛을 받아 밝아지는 얇은 rim. AO보다 안쪽(바닥에 더
  // 가까운 쪽)이 아니라 경계 바로 그 자리에 얇게 얹혀 "턱이 솟아 있다"는 걸 보여준다.
  ctx.strokeStyle = "rgba(150, 138, 120, 0.55)";
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  traceBoundary();
  ctx.restore();

  return layer;
}

/**
 * 스테이지 배경과 지형(벽 셀)·골 지점을 그린다. 배경은 라운드별 정적 아트
 * (`backgroundArt.ts`)이고, 벽은 시드마다 통로 모양이 달라지는 절차적 타일이라
 * 배경 그림과 픽셀 단위로 맞지 않는다 — 그래서 벽을 불투명 사각형이 아니라
 * "그림자 세계의 경계"처럼 보이는 반투명 오버레이로 그려, 배경과 정확히 겹치지
 * 않아도 위화감이 적게 만든다. 배경 이미지가 없으면(로드 실패·미확보) 기존
 * 단색 배경으로 폴백한다.
 */
export function drawStage(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  background: HTMLImageElement | null,
  checkpointsPassed: readonly boolean[],
): void {
  const { grid } = stage;
  const mapWidth = grid.cols * grid.tileSize;
  const mapHeight = grid.rows * grid.tileSize;

  if (background) {
    ctx.drawImage(background, 0, 0, mapWidth, mapHeight);
  } else {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, mapWidth, mapHeight);
  }

  // 배경 프롬프트 가이드가 요구한 대로 배경 그림 자체는 전체 화면에 균일하게
  // 밝은 바닥 텍스처만 담고 있어(직접 구운 그림자·명암 없음), 이 위에 앰비언트
  // 어둠을 깔아주는 건 전적으로 엔진(이 코드) 몫이다. 이 어둠이 없으면 광원이
  // 그려내는 빛 웅덩이가 이미 밝은 바닥과 명도 차이가 거의 없어 안 보이고,
  // 배경 가이드가 의도한 "빛 웅덩이 사이 어두운 틈"도 사라진다. 광원(GameCanvas)은
  // 이 위에 나중에 그려지므로 자연히 어둠을 뚫고 밝게 도드라진다.
  //
  // 이전엔 이 어둠이 rgba 한 값짜리 완전 균일한 판이라 밋밋했다 — 위(하늘 쪽)는
  // 저녁 하늘처럼 차가운 남보라 톤이 살짝 돌고 아래(땅에 가까울수록)는 그림자가
  // 고이듯 더 짙어지는 세로 그라디언트로 깊이감을 준다. 그 위에 맵 중심에서
  // 가장자리로 갈수록 짙어지는 비네트를 한 겹 더 얹어, 통로 구석이 화면 프레임처럼
  // 딱 잘리지 않고 자연스럽게 어둠 속으로 스며들게 한다.
  const dusk = ctx.createLinearGradient(0, 0, 0, mapHeight);
  dusk.addColorStop(0, "rgba(24, 18, 36, 0.6)");
  dusk.addColorStop(0.55, "rgba(12, 9, 18, 0.55)");
  dusk.addColorStop(1, "rgba(5, 4, 8, 0.62)");
  ctx.fillStyle = dusk;
  ctx.fillRect(0, 0, mapWidth, mapHeight);

  const vignette = ctx.createRadialGradient(
    mapWidth / 2,
    mapHeight / 2,
    mapHeight * 0.25,
    mapWidth / 2,
    mapHeight / 2,
    mapHeight * 0.75,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.4)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, mapWidth, mapHeight);

  // 벽 채우기+AO+베벨은 stage가 바뀌기 전까지 절대 안 변하는 정적 레이어라
  // buildWallLayer()가 오프스크린 캔버스에 미리 그려둔 걸 매 프레임 한 번의
  // drawImage로만 합성한다(파일 상단 wallLayerCache 주석 참고).
  let wallLayer = wallLayerCache.get(stage);
  if (!wallLayer) {
    wallLayer = buildWallLayer(stage);
    wallLayerCache.set(stage, wallLayer);
  }
  ctx.drawImage(wallLayer, 0, 0);

  // 세이브 포인트·골을 "제단 촛불"로 그린다 — 광원(육각 랜턴, 기하학적·서 있는
  // 기둥형)과 실루엣이 겹치면 둘을 헷갈리게 되므로, 촛불은 각진 형태 없이 둥근
  // 받침 위에 유기적인 불꽃 하나만 두어 "잠시 쉬어가는 지점"이라는 성격을
  // 형태로도 구분한다. 통과한 세이브 포인트는 초록으로 바뀌어 계속 표시된다
  // (GameCanvas의 justPassedSavePoint로는 통과 여부를 눈으로 확인할 방법이 없다는
  // 피드백 반영). 미통과 색은 고정 팔레트의 크림톤 — 보라는 안전 구역 경계선/벽
  // 테두리 전용이라 재사용하면 "이것도 위험 경계인가?" 하는 혼동을 준다.
  // 좌표를 시드로 미세한 개체차를 준다 — 촛불마다 완전히 똑같이 찍어낸 스탬프처럼
  // 보이지 않도록, 불꽃이 살짝 한쪽으로 기울고 잔불 크기가 조금씩 달라지게 한다.
  const wobble = (n: number): number => {
    const v = Math.sin(n * 43.51) * 7891.23;
    return v - Math.floor(v);
  };

  const drawCandleMark = (x: number, y: number, color: string): void => {
    const rgb = hexToRgbString(color);
    const glow = `rgba(${rgb}, 0.9)`;
    const lean = (wobble(x * 3.1 + y * 7.7) - 0.5) * 3;

    // 그림자 — 촛대가 바닥에 실제로 서 있다는 걸 보여주는 부드러운 접지 그림자.
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 9, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 굽 — 접시를 받치는 짧은 다리
    ctx.fillStyle = "rgba(24, 19, 14, 0.85)";
    ctx.fillRect(x - 1.4, y - 1, 2.8, 5);

    // 받침 접시 — 금속/도자기 재질감을 내기 위해 단색 대신 방사형 그라디언트로
    // 중심이 밝고 가장자리가 어두워지는 입체감을 준다(이전엔 균일한 선 하나뿐이라
    // 스티커처럼 평평해 보였다).
    const dish = ctx.createRadialGradient(x - 2, y - 1, 0, x, y, 12);
    dish.addColorStop(0, "rgba(70, 62, 50, 0.95)");
    dish.addColorStop(0.6, "rgba(30, 26, 20, 0.9)");
    dish.addColorStop(1, "rgba(10, 8, 6, 0.85)");
    ctx.fillStyle = dish;
    ctx.beginPath();
    ctx.ellipse(x, y, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y - 0.5, 11, 4, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // 접시 중앙의 작은 촉(spike) — 실제 촛대 접시처럼 초를 꽂아 고정하는 부분
    ctx.fillStyle = "rgba(60, 52, 42, 0.9)";
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y);
    ctx.lineTo(x + 1.5, y);
    ctx.lineTo(x, y - 3);
    ctx.closePath();
    ctx.fill();

    // 초 — 밀랍은 상태와 무관하게 항상 같은 크림색이고, 오직 불꽃(포인트 색)만
    // 세이브 통과 여부에 따라 바뀐다 — "이 세계의 빛(상태)이 담기는 그릇"이라는
    // 의미를 형태로 나눈다. 좌우 그라디언트로 원통형 입체감을 주고, 옆면에 촛농이
    // 흘러내린 자국과 받침 위에 굳은 촛농 방울을 더해 밀랍 특유의 질감을 살린다.
    const wax = ctx.createLinearGradient(x - 3, y, x + 3, y);
    wax.addColorStop(0, "#cabe9c");
    wax.addColorStop(0.45, "#e9ddc2");
    wax.addColorStop(1, "#b8ac8c");
    ctx.fillStyle = wax;
    ctx.fillRect(x - 3, y - 9, 6, 7);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(x + 1.5, y - 8, 1, 6);
    ctx.fillStyle = "rgba(233, 221, 194, 0.8)";
    ctx.beginPath();
    ctx.ellipse(x - 2, y + 0.5, 1.3, 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // 불꽃 뒤 은은한 헤일로 — 실제로 빛을 뿜는 것처럼 부드럽게 번지는 광륜
    const haloRadius = 20;
    const halo = ctx.createRadialGradient(x, y - 14, 0, x, y - 14, haloRadius);
    halo.addColorStop(0, `rgba(${rgb}, 0.35)`);
    halo.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y - 14, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    // 불꽃 — 바깥의 넓고 옅은 겹 + 중간 포인트색 + 안쪽의 하얀 심지 불, 세 겹으로
    // 입체감을 주고 lean만큼 살짝 기울여 흔들리는 불꽃의 유기적인 느낌을 준다.
    const drawFlame = (topOffset: number, waistOffset: number, width: number, fillColor: string): void => {
      const flameTop = y - topOffset;
      const flameWaist = y - waistOffset;
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(x + lean, flameTop);
      ctx.quadraticCurveTo(x + width, y - 9, x, flameWaist);
      ctx.quadraticCurveTo(x - width + lean, y - 9, x + lean, flameTop);
      ctx.closePath();
      ctx.fill();
    };

    ctx.shadowColor = glow;
    ctx.shadowBlur = 11;
    drawFlame(17, 3, 5.5, `rgba(${rgb}, 0.55)`);
    ctx.shadowBlur = 8;
    drawFlame(15, 4, 3.6, color);
    ctx.shadowBlur = 4;
    drawFlame(12.5, 5.5, 1.8, "#fff8e6");
    ctx.shadowBlur = 0;

    // 잔불 — 불꽃 위로 옅게 흩어지는 불티 두 점으로 마무리감을 준다.
    for (let i = 0; i < 2; i++) {
      const t = wobble(x * 11 + y * 13 + i * 29);
      const ex = x + lean * 1.5 + (t - 0.5) * 10;
      const ey = y - 20 - t * 8;
      ctx.fillStyle = `rgba(${rgb}, ${(0.35 - t * 0.15).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 1 + t, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  stage.checkpoints.forEach((checkpoint, i) => {
    const passed = checkpointsPassed[i] ?? false;
    drawCandleMark(checkpoint.x, checkpoint.y, passed ? "#4caf50" : "#f0e6d2");
  });

  drawCandleMark(stage.goal.x, stage.goal.y, "#f5a623");
  ctx.shadowBlur = 0;
}
