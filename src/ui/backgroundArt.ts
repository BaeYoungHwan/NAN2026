const ASSET_BASE = `${import.meta.env.BASE_URL}assets/backgrounds/`;
const BACKGROUND_FILE = "stage.png";

function loadImage(fileName: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${fileName}`));
    img.src = ASSET_BASE + fileName;
  });
}

/**
 * 스테이지 배경 이미지를 로드한다. 라운드마다 별도 PNG를 두지 않고 한 장을
 * 공유한다 — 라운드별 명암 차이는 `drawStage`가 `ROUND_BACKGROUND_BRIGHTNESS`
 * 배율로 그려서 낸다(PR #17 리뷰: round2/3.png가 round1.png를 밝기만 바꿔
 * 다시 구운 것이라 4.6MB가 순수 중복이었다). 로드에 실패해도 게임 진행이
 * 막히지 않도록 null을 반환하고, `drawStage`는 null이면 단색 배경으로 폴백한다.
 */
export async function loadBackgroundArt(): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(BACKGROUND_FILE);
  } catch {
    return null;
  }
}
