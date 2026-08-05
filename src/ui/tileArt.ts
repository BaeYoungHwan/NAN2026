const ASSET_BASE = `${import.meta.env.BASE_URL}assets/tiles/`;

const FLOOR_TILE_FILE = "floor.png";
const WALL_TILE_FILE = "wall.png";

export interface TileArt {
  floor: HTMLImageElement | null;
  wall: HTMLImageElement | null;
}

function loadImage(fileName: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${fileName}`));
    img.src = ASSET_BASE + fileName;
  });
}

async function loadOrNull(fileName: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(fileName);
  } catch {
    return null;
  }
}

/**
 * 바닥/벽 실사 타일 텍스처(tile-art-prompt-guide.md 프롬프트로 생성)를 로드한다.
 * 정사각형 seamless 타일 한 장씩을 반복(pattern) 렌더링용으로 쓴다 — 절차적으로
 * 매번 다른 모양이 되는 통로 그리드 위에, 셀 좌표와 무관하게 같은 재질이
 * 이어지도록 하기 위함(개별 셀마다 다른 이미지를 붙이는 방식이 아님).
 * 로드 실패 시 null을 반환하고, `drawStage`는 null이면 기존 절차적 렌더링으로
 * 폴백한다(배경 이미지 로더와 동일한 관례).
 */
export async function loadTileArt(): Promise<TileArt> {
  const [floor, wall] = await Promise.all([loadOrNull(FLOOR_TILE_FILE), loadOrNull(WALL_TILE_FILE)]);
  return { floor, wall };
}
