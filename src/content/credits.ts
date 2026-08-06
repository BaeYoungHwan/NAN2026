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
  /**
   * 이 라이선스가 저작자 표시를 **요구하는지**. 화면 표기 누락을 막는 테스트의
   * 판정 기준이라 반드시 정확해야 한다.
   *
   * `license` 문자열을 파싱해서(`startsWith("CC BY")` 같은 식으로) 판별하지 않는
   * 이유: 표기 흔들림에 안전망이 통째로 걸린다. 실제로 `ASSET_SOURCES.md`는
   * "CC-BY 3.0"(하이픈), 여기는 "CC BY 3.0"(공백)을 쓰는데, 누가 문서에 맞춰
   * 하이픈으로 통일하는 순간 문자열 판별은 의무 대상을 하나도 못 찾고 조용히
   * 통과한다. 곡을 추가할 때 이 필드를 채우며 라이선스를 한 번 더 확인하게 되는
   * 효과도 있다.
   */
  requiresAttribution: boolean;
  /** 원본 페이지 — 화면에는 나가지 않고 출처 추적용이다. */
  url: string;
}

/** 배경음 5곡. 순서는 게임에서 등장하는 순서(오프닝 → 1R → 2R → 3R → 엔딩)를 따른다. */
export const BGM_CREDITS: readonly AssetCredit[] = [
  {
    title: "Intro Music",
    author: "RonyDkid",
    license: "CC0",
    requiresAttribution: false,
    url: "https://opengameart.org/content/intro-music-0",
  },
  {
    title: "Dark Theme",
    author: "JaggedStone",
    license: "CC0",
    requiresAttribution: false,
    url: "https://opengameart.org/content/dark-theme",
  },
  {
    title: "Dark Shrine Loop",
    author: "qubodup",
    license: "CC0",
    requiresAttribution: false,
    url: "https://opengameart.org/content/dark-shrine-loop",
  },
  {
    title: "Mystical Theme",
    author: "Alexandr Zhelanov",
    license: "CC BY 3.0",
    requiresAttribution: true,
    url: "https://opengameart.org/content/mystical-theme",
  },
  {
    title: "Epilogue",
    author: "tcarisland",
    license: "CC BY 4.0",
    requiresAttribution: true,
    url: "https://opengameart.org/content/epilogue",
  },
];

/** 에셋을 받은 곳 — 크레딧 줄 끝에 붙는다. */
export const ASSET_SOURCE_SITE = "OpenGameArt.org";

/** `제목 (저작자, 라이선스)` 한 항목의 표시 문자열. */
export function formatCredit(credit: AssetCredit): string {
  return `${credit.title} (${credit.author}, ${credit.license})`;
}

/** 저작자 표시가 의무인 항목만 — 화면 표기와 그 회귀 테스트가 이 목록을 기준으로 삼는다. */
export const ATTRIBUTION_REQUIRED: readonly AssetCredit[] = BGM_CREDITS.filter(
  (credit) => credit.requiresAttribution,
);
