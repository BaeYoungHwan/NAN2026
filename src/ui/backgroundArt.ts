import type { Round } from "../core/round";

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/backgrounds/`;

const BACKGROUND_FILES: Record<Round, string> = {
  1: "round1.png",
  2: "round2.png",
  3: "round3.png",
};

function loadImage(fileName: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${fileName}`));
    img.src = ASSET_BASE + fileName;
  });
}

/**
 * 라운드별 배경 이미지를 로드한다. 아직 배경 에셋이 준비되지 않은 라운드가 있어도
 * 게임 진행이 막히지 않도록, 해당 라운드만 null로 남기고 나머지는 정상 로드한다
 * (drawStage가 null이면 기존 단색 배경으로 폴백한다).
 */
export async function loadBackgroundArt(): Promise<Record<Round, HTMLImageElement | null>> {
  const entries = await Promise.all(
    (Object.entries(BACKGROUND_FILES) as [string, string][]).map(async ([round, file]) => {
      try {
        return [Number(round) as Round, await loadImage(file)] as const;
      } catch {
        return [Number(round) as Round, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<Round, HTMLImageElement | null>;
}
