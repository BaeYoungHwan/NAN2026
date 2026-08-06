/**
 * 외부 에셋 크레딧 — 게임 화면에 표시할 저작자 표기의 단일 출처.
 *
 * BGM 5곡 중 2곡이 CC-BY(3.0 / 4.0)이라 **저작자 표시가 라이선스상 의무**다.
 * CC0 곡은 표기 의무가 없지만 같은 줄에 함께 적는다 — 어느 곡이 어떤 조건인지
 * 한눈에 보이고, 나중에 곡을 교체할 때 의무 있는 항목만 골라내는 실수를 막는다.
 *
 * 전체 출처 정보(다운로드 URL, 추가일, 가공 내역)는 `public/assets/ASSET_SOURCES.md`에
 * 있다. 여기에는 화면에 실제로 나갈 최소 정보만 둔다.
 */

export interface AssetCredit {
  /** 원곡 제목 (OpenGameArt 등록명). */
  title: string;
  author: string;
  /** 표시용 라이선스 이름. CC0는 표기 의무가 없지만 구분을 위해 함께 적는다. */
  license: string;
  /** 원본 페이지 — 화면에는 나가지 않고 출처 추적용이다. */
  url: string;
}

/** 배경음 5곡. 순서는 게임에서 등장하는 순서(오프닝 → 1R → 2R → 3R → 엔딩)를 따른다. */
export const BGM_CREDITS: readonly AssetCredit[] = [
  {
    title: "Intro Music",
    author: "RonyDkid",
    license: "CC0",
    url: "https://opengameart.org/content/intro-music-0",
  },
  {
    title: "Dark Theme",
    author: "JaggedStone",
    license: "CC0",
    url: "https://opengameart.org/content/dark-theme",
  },
  {
    title: "Dark Shrine Loop",
    author: "qubodup",
    license: "CC0",
    url: "https://opengameart.org/content/dark-shrine-loop",
  },
  {
    title: "Mystical Theme",
    author: "Alexandr Zhelanov",
    license: "CC BY 3.0",
    url: "https://opengameart.org/content/mystical-theme",
  },
  {
    title: "Epilogue",
    author: "tcarisland",
    license: "CC BY 4.0",
    url: "https://opengameart.org/content/epilogue",
  },
];

/** 에셋을 받은 곳 — 크레딧 줄 끝에 붙는다. */
export const ASSET_SOURCE_SITE = "OpenGameArt.org";

/** `제목 (저작자, 라이선스)` 한 항목의 표시 문자열. */
export function formatCredit(credit: AssetCredit): string {
  return `${credit.title} (${credit.author}, ${credit.license})`;
}
