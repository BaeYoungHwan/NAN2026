/**
 * 외부 에셋 크레딧 — 게임 화면에 표시할 저작자 표기의 단일 출처.
 *
 * BGM 5곡 중 2곡이 CC-BY(3.0 / 4.0)이라 **저작자 표시 + 변경 사항 표시가 라이선스상
 * 의무**다 — 5곡 모두 음량 정규화·루프 가공을 거쳐 원본 그대로가 아니다.
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
  /**
   * 원본을 **가공해서** 실었는지. CC BY 4.0 §3(a)(1)(B)와 CC BY 3.0 §4(c)는 저작자
   * 표시와 별개로 "변경했다는 사실"을 알릴 것을 요구하므로, 참이면 화면 크레딧에
   * `편집됨`이 붙는다.
   *
   * BGM 5곡은 전부 `scripts/process-bgm.mjs`로 음량 정규화·루프 가공을 거쳤다
   * (곡별 상세 내역은 `public/assets/ASSET_SOURCES.md`의 "가공 내역" 표). CC0 곡은
   * 고지 의무가 없지만 사실 그대로 참으로 둔다 — 의무 있는 곡만 골라 표시하려다
   * 빠뜨리는 것이 `requiresAttribution`과 똑같은 사고 유형이다.
   */
  modified: boolean;
  /**
   * 라이선스 전문 URI.
   *
   * CC BY 4.0 §3(a)(1)(C)는 "이 라이선스의 전문, 또는 그 URI·하이퍼링크를 포함할 것"을
   * 요구한다 — `CC BY 4.0`이라는 **이름만 적는 것으로는 부족하다.** 화면에는 같은
   * 라이선스가 여러 곡에 걸치므로 중복을 없앤 목록(`LICENSE_URLS`)으로 한 번만 싣는다.
   */
  licenseUrl: string;
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
    modified: true,
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    url: "https://opengameart.org/content/intro-music-0",
  },
  {
    title: "Dark Theme",
    author: "JaggedStone",
    license: "CC0",
    requiresAttribution: false,
    modified: true,
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    url: "https://opengameart.org/content/dark-theme",
  },
  {
    title: "Dark Shrine Loop",
    author: "qubodup",
    license: "CC0",
    requiresAttribution: false,
    modified: true,
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    url: "https://opengameart.org/content/dark-shrine-loop",
  },
  {
    title: "Mystical Theme",
    author: "Alexandr Zhelanov",
    license: "CC BY 3.0",
    requiresAttribution: true,
    // 103.2s → 80.4s(꼬리 20.8s 페이드아웃 제거 + 심리스 루프) + 음량 정규화.
    modified: true,
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    url: "https://opengameart.org/content/mystical-theme",
  },
  {
    title: "Epilogue",
    author: "tcarisland",
    license: "CC BY 4.0",
    requiresAttribution: true,
    // 길이는 그대로, 음량 정규화(-21.7 → -21.8 dB).
    modified: true,
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    url: "https://opengameart.org/content/epilogue",
  },
];

/** 에셋을 받은 곳 — 크레딧 줄 끝에 붙는다. */
export const ASSET_SOURCE_SITE = "OpenGameArt.org";

/** 가공한 음원임을 알리는 문구 — CC BY의 "변경 사항 표시" 의무를 이 한 단어로 이행한다. */
export const MODIFIED_NOTICE = "편집됨";

/** `제목 (저작자, 라이선스, 편집됨)` 한 항목의 표시 문자열. */
export function formatCredit(credit: AssetCredit): string {
  const parts = [credit.author, credit.license];
  if (credit.modified) parts.push(MODIFIED_NOTICE);
  return `${credit.title} (${parts.join(", ")})`;
}

/** 저작자 표시가 의무인 항목만 — 화면 표기와 그 회귀 테스트가 이 목록을 기준으로 삼는다. */
export const ATTRIBUTION_REQUIRED: readonly AssetCredit[] = BGM_CREDITS.filter(
  (credit) => credit.requiresAttribution,
);

/**
 * 라이선스 URI를 화면에 실을 때의 표시 문자열 — `https://`와 끝 슬래시를 뺀다.
 * 클릭할 수 없는 텍스트라 스킴이 정보를 더해주지 않고 줄 수만 늘린다.
 */
export function formatLicenseUrl(url: string): string {
  return url.replace(/^https:\/\//, "").replace(/\/$/, "");
}

/**
 * 화면에 실을 라이선스 URI 목록 — 같은 라이선스를 여러 곡이 공유하므로 중복을 없앤다.
 * 곡마다 URI를 붙이면 크레딧 줄이 세 배로 길어지는데, CC BY가 요구하는 것은 "라이선스
 * 전문 또는 그 URI를 포함할 것"이지 곡별 반복이 아니다.
 */
export const LICENSE_URLS: readonly string[] = [
  ...new Set(BGM_CREDITS.map((credit) => credit.licenseUrl)),
].map(formatLicenseUrl);
