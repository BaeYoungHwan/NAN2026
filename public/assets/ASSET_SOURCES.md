# 외부 에셋 출처 기록

> 이미지 등 외부 에셋을 추가할 때마다 여기 한 줄씩 남긴다 (CLAUDE.md 규칙 — 출처·라이선스 확인 및 고지 필수).
> AI 활용 기술 문서(P2 제출물)에도 이 목록을 반영한다.

| 파일 경로 | 내용 | 생성 방법 / 출처 | 라이선스·사용 조건 | 추가일 |
|-----------|------|------------------|---------------------|--------|
| `scripts/게임캐릭터.png` | 주인공 "그림자씨" 캐릭터 디자인 시트 원본 (턴어라운드·표정 6종·동작 5종·죽음 모션 4단계·팔레트) — `public/`이 아니라 `scripts/`에 둔다: `crop-regions.mjs` 1회성 스크립트에서만 참조되고 런타임 게임 코드는 잘라낸 개별 PNG만 로드하므로, `public/`에 두면 Vite 빌드 시 dist에 그대로 복사되어 배포 용량만 늘어난다(PR #9 리뷰 반영, 원래 `public/assets/characters/`에 있었음) | ChatGPT(DALL·E) 이미지 생성 기능으로 직접 생성 | OpenAI 이용약관상 생성자(사용자) 소유 — 2026-08-07 약관 원문 확인 완료, 아래 "생성형 AI 이미지 라이선스 확인" 절 참고 | 2026-07-24 |
| `characters/body-idle-pose.png`, `body-run-torso.png`, `body-run-legs.png`, `body-flinch.png`, `body-danger.png`, `face-normal.png`, `face-surprised.png`, `face-scared.png`, `face-annoyed.png`, `face-disappointed.png`, `face-delighted.png`, `death1~4.png` | 위 원본 시트에서 `scripts/crop-regions.mjs`로 잘라낸 파생 스프라이트 중 실제 코드에서 쓰는 15장 (배경은 코너 플러드필로 투명 처리) — `body-run-torso`/`body-run-legs`는 걷기 애니메이션을 상체(고정)·다리(좌우반전) 레이어로 분리 렌더링하기 위한 컷아웃. (`body-idle.png`, `body-walk.png`, `body-run.png`, `body-death-pose.png`는 같은 스크립트로 뽑았지만 최종 렌더링에 쓰이지 않아 커밋에서 제외함 — 좌표는 `scripts/crop-regions.mjs`에 남아있어 필요하면 재생성 가능) | 위 원본과 동일 | 위 원본과 동일 | 2026-07-24 |
| `audio/sfx/*.wav` (13개) | 게임 효과음 전량. 목록·용도는 [`docs/design-docs/audio-asset-guide.md`](../../docs/design-docs/audio-asset-guide.md) 참고 | **외부 음원을 일절 쓰지 않고 `scripts/generate-audio.mjs`로 직접 합성 생성** (Node 표준 라이브러리만 사용, 외부 의존성 0). 오실레이터·노이즈·필터·엔벨로프를 조합해 PCM 샘플을 계산하고 WAV로 인코딩한다. `node scripts/generate-audio.mjs`로 언제든 재생성 가능하며, 같은 코드는 항상 같은 파일을 만든다(노이즈 계열 제외) | **팀 자체 저작물 — 제3자 라이선스 없음.** 외부 사이트에서 받은 음원이 아니므로 출처 표기·사용 조건 제약이 없다 | 2026-08-04 |
| `audio/bgm/*.mp3` (5개) | 배경음 전량 — 아래 표에 곡별로 상세 기록. **2026-08-06에 자체 합성 BGM 5개(`bgm/*.wav`)를 외부 음원으로 전량 교체했다**: 기존 곡은 `drone()` 기반 지속음이라 멜로디·리듬·화성이 없어 음악으로 들리지 않았다(효과음 13개는 그대로 자체 합성 유지) | [OpenGameArt.org](https://opengameart.org/)에서 다운로드 후 가공 | **곡마다 다름 — 아래 표 참고. CC-BY 2곡은 저작자 표시가 의무**이며 `src/content/credits.ts` → 타이틀 화면에 표시한다 | 2026-08-06 |
| `tiles/floor.png`, `tiles/wall.png` | 스테이지 바닥/벽 반복(seamless) 타일 텍스처 1장씩 — [`docs/design-docs/tile-art-prompt-guide.md`](../../docs/design-docs/tile-art-prompt-guide.md)의 프롬프트로 생성. 원본은 1254×1254px였으나 배포 용량 축소를 위해 512×512px로 리사이즈해 커밋(PR #20 리뷰 반영, 원본 대비 약 1/7 용량) | ChatGPT(DALL·E) 이미지 생성 기능으로 직접 생성 | OpenAI 이용약관상 생성자(사용자) 소유 — 2026-08-07 약관 원문 확인 완료, 아래 "생성형 AI 이미지 라이선스 확인" 절 참고 (위 `게임캐릭터.png`와 동일 조건) | 2026-08-04 |
| `scripts/저승사자캐릭터.png` | 저승사자 NPC 캐릭터 디자인 시트 원본(턴어라운드·표정 8종·동작 8종·대화 박스 스타일 참고안 포함) — `게임캐릭터.png`와 같은 이유로 `public/`이 아니라 `scripts/`에 둔다(`crop-reaper.mjs` 1회성 스크립트에서만 참조) | ChatGPT(DALL·E) 이미지 생성 기능으로 직접 생성 | OpenAI 이용약관상 생성자(사용자) 소유 — 2026-08-07 약관 원문 확인 완료, 아래 "생성형 AI 이미지 라이선스 확인" 절 참고 (위 `게임캐릭터.png`와 동일 조건) | 2026-08-05 |
| `characters/reaper-portrait-neutral.png` | 위 원본 시트의 "표정/반응 예시" 그리드 중 기본(평상시) 표정 칸을 `scripts/crop-reaper.mjs`로 잘라낸 것(배경은 코너 플러드필로 투명 처리) — 대화 박스 위 초상으로 사용 | 위 원본과 동일 | 위 원본과 동일 | 2026-08-05 |

---

## 생성형 AI 이미지 라이선스 확인 (2026-08-07)

위 표의 이미지 에셋(캐릭터 시트 2종과 그 파생 스프라이트, 바닥·벽 타일)은 전부 ChatGPT의 이미지 생성 기능으로 만들었다. 그동안 "상업적 이용 관련 최신 약관은 제출 전 재확인 권장"으로 미뤄 두었던 항목을 제출 전에 확인했다.

**근거: [OpenAI 이용약관](https://openai.com/policies/terms-of-use/) — 발효일 2026년 1월 1일** (확인일 2026-08-07). 아래는 한국어판 원문이다.

> **콘텐츠의 소유권.** 귀하와 OpenAI 간에 관련 법률이 허용하는 한도 내에서, 귀하는 (a) 입력에 대한 소유권을 유지하고 (b) 출력을 소유합니다. 당사는 출력에 대한 모든 권리, 소유권 및 이권을 이로써 귀하에게 양도합니다.

출력에 대한 권리가 전부 사용자에게 양도되며, 용도를 상업적/비상업적으로 나누어 제한하는 문구는 약관에 없다. **이 프로젝트가 생성 이미지를 게임에 싣고 웹으로 배포하는 데 약관상 제약이 없다.**

다만 두 가지가 따라붙는다.

**1. 소유하지만 독점하지는 못한다.**

> **콘텐츠 유사성.** 서비스와 인공지능의 일반적인 특성상, 출력은 독창적이지 않을 수 있으며 다른 사용자들도 서비스로부터 유사한 출력을 받을 수 있습니다. 위 조항에 따른 당사의 양도는 다른 사용자의 출력이나 제3자 출력에 적용되지 않습니다.

제3자가 유사한 이미지를 만들어 쓰는 것을 막을 수단이 없다는 뜻이다. 사전과제 제출에는 영향이 없지만, 이 에셋을 브랜드 자산처럼 다루면 안 된다.

**2. AI 생성 사실을 감추면 약관 위반이다.** 금지 행위 목록에 다음이 있다.

> 출력이 사람이 생성한 것이 아님에도 불구하고 사람이 생성하였다고 하는 행위.

이 문서와 [`docs/submission/ai-usage-report.md`](../../docs/submission/ai-usage-report.md)가 파일별 생성 도구를 명시하고 있으므로 현재 상태는 이 조항을 충족한다. **에셋을 추가하면서 출처 기록을 빠뜨리면 관행 위반이 아니라 약관 위반이 된다** — 이 표를 채우는 규칙이 그래서 있다.

> 참고: OpenAI 헬프센터의 "Can I sell images I create with DALL·E?" 문서도 같은 취지를 안내하지만, 자동화 도구로는 접근이 차단돼(Cloudflare) 원문을 확인하지 못했다. 위 판단의 근거는 전적으로 법적 정본인 이용약관 본문이다.

---

## BGM 곡별 출처 (2026-08-06 교체)

전 곡 [OpenGameArt.org](https://opengameart.org/)에서 받았다. **OpenGameArt는 CC0 전용 사이트가 아니며** CC0 · CC-BY · CC-BY-SA · GPL이 섞여 있으므로, 곡을 교체할 때는 반드시 개별 페이지에서 라이선스를 확인한다.

| 슬롯 | 원곡 / 저작자 | 라이선스 | 원본 페이지 |
|------|---------------|----------|-------------|
| `opening.mp3` | **Intro Music** / RonyDkid | CC0 (표기 불필요) | <https://opengameart.org/content/intro-music-0> |
| `round1.mp3` | **Dark Theme** / JaggedStone | CC0 (표기 불필요) | <https://opengameart.org/content/dark-theme> |
| `round2.mp3` | **Dark Shrine Loop** / qubodup (yd의 LMMS 곡 "Shrine" 리믹스) | CC0 (표기 불필요) | <https://opengameart.org/content/dark-shrine-loop> |
| `round3.mp3` | **Mystical Theme** / Alexandr Zhelanov | **CC-BY 3.0 — 저작자 표시 + 변경 사항 표시 의무** | <https://opengameart.org/content/mystical-theme> |
| `ending.mp3` | **Epilogue** / tcarisland | **CC-BY 4.0 — 저작자 표시 + 변경 사항 표시 + 라이선스 URI 의무** | <https://opengameart.org/content/epilogue> |

라이선스 전문:

- CC0 1.0 — <https://creativecommons.org/publicdomain/zero/1.0/>
- CC BY 3.0 — <https://creativecommons.org/licenses/by/3.0/>
- CC BY 4.0 — <https://creativecommons.org/licenses/by/4.0/>

### 게임 내 표기

CC-BY 2곡의 표시 의무는 `src/content/credits.ts`에 데이터를 두고 **타이틀 화면 하단**에 렌더해 이행한다. 표기 의무가 없는 CC0 3곡도 같은 줄에 함께 적는다 — 어느 곡이 어떤 조건인지 한눈에 보이고, 곡 교체 시 의무 있는 항목만 골라내다 빠뜨리는 사고를 막는다.

화면에 나가는 것은 저작자 이름만이 아니다. CC BY가 요구하는 세 가지를 모두 싣는다(빠지면 `src/ui/TitleScreen.test.tsx`가 실패한다):

1. **저작자·제목**(§3(a)(1)(A) / 3.0 §4(c)) — `제목 (저작자, 라이선스, …)` 형태. 구현은 `formatCredit()`.
2. **변경 사실**(§3(a)(1)(B) / 3.0 §4(c)) — 아래 "가공 내역"대로 원본을 그대로 쓰지 않았으므로 곡마다 `편집됨`을 붙인다. 구현은 `AssetCredit.modified`.
3. **라이선스 전문 URI**(§3(a)(1)(C)) — `CC BY 4.0`이라는 이름만으로는 부족하다. 같은 라이선스를 여러 곡이 공유하므로 중복을 없앤 URI 목록(`LICENSE_URLS`)을 크레딧 둘째 줄에 한 번만 싣는다.

크레딧을 담은 `<p>`에는 클릭 핸들러를 걸지 않는다 — 타이틀 화면 오버레이는 좁은 화면에서 스크롤되는데, 스크롤 컨테이너에 "클릭하면 게임 시작"을 걸어두면 **스크롤바 트랙을 클릭하는 것만으로 게임이 시작된다**(실측으로 재현). 하필 스크롤이 생기는 상황이 이 크레딧을 읽으려 내리는 순간이라, 시작 입력은 본문 영역에만 받는다.

### 가공 내역 (원본을 그대로 쓰지 않았다)

원본은 곡 간 RMS가 최대 23dB까지 벌어져 있었고, 라운드용 3곡은 끝이 페이드아웃·무음으로 끝나 루프에 부적합했다(제목에 "Loop"가 붙은 `Dark Shrine Loop`조차 끝 0.5초가 완전 무음이었다). 배치 전 아래와 같이 가공했다 — **CC-BY 4.0의 "변경 사항 표시" 의무를 위한 기록이기도 하다.**

| 슬롯 | 길이 | 음량(RMS) | 비고 |
|------|------|-----------|------|
| `opening` | 82.3s → 80.1s | -18.0 → -20.0 dB | 꼬리 0.2s 제거 + 심리스 루프. 원본은 확장자가 `.mp3`였으나 실제 내용은 **무압축 WAV(14.5MB)**였다 |
| `round1` | 61.8s → 59.4s | **-40.8 → -21.1 dB (+19.6dB)** | 꼬리 0.4s 제거 + 심리스 루프. 원본이 유독 조용해 크게 증폭(피크 상한에 걸려 -21.1dB에서 멈춤) |
| `round2` | 56.6s → 51.8s | -23.4 → -20.0 dB | 꼬리 **2.8s**(무음) 제거 + 심리스 루프 |
| `round3` | 103.2s → 80.4s | -14.5 → -20.0 dB | 꼬리 **20.8s**(긴 페이드아웃) 제거 + 심리스 루프 |
| `ending` | 86.4s (유지) | -21.7 → -21.8 dB | **루프 가공 없음** — `loop: false`라 페이드아웃이 그대로 마무리가 된다. 음량 정규화만 |

공통 처리:

- **심리스 루프화**: 끝 2초를 잘라 시작 2초에 크로스페이드로 겹쳐 파형을 연속시킨다. `scripts/generate-audio.mjs`의 `seamlessLoop()`과 같은 원리이며, 대상이 합성 버퍼가 아니라 외부 음원일 뿐이다. 가공 후 이음매 불연속은 전 곡 0.006 이하다.
- **음량 정규화**: 목표 RMS -20 dBFS, 피크 상한 -1 dBFS. 이 덕분에 `src/audio/soundCues.ts`의 `volume`은 곡별 보정이 아니라 순수한 연출 의도(3R만 0.5로 높임)로 남는다.
- **인코딩**: 128 kbps MP3(libmp3lame). 전 곡 합계 **24MB → 5.5MB**.

  **Xing/LAME 헤더를 반드시 남긴다(libmp3lame 기본값).** MP3는 인코딩 과정에서 앞뒤에 패딩이 생기는데 그 양이 이 헤더에 기록되고, 디코더는 헤더를 보고 패딩을 제거한다. `-write_xing 0`으로 헤더를 빼면 디코더가 패딩을 그대로 재생해 **루프 한 바퀴마다 약 46ms의 무음**이 끼어든다 — 위에서 이음매를 0.006까지 맞춰놓은 것이 통째로 헛수고가 된다.

  실측(가공본 WAV → MP3 → 다시 디코딩했을 때의 샘플 수 증가):

  | 인코딩 | 샘플 증가 | 시간 | 용량 |
  |--------|-----------|------|------|
  | `-write_xing 0` | +2,024 | 45.9 ms | 810 KB |
  | 헤더 유지(현재) | **+8** | **0.18 ms** | 810 KB |
  | OGG Vorbis `-q:a 4` | +8 | 0.18 ms | 677 KB |

  OGG가 용량은 16% 작지만 MP3를 쓴다 — gapless 특성이 동일하고, MP3는 대상 브라우저(Chrome/Edge/Firefox/Safari) 전부에서 디코딩이 보장되는 반면 Safari의 OGG Vorbis 지원은 버전 편차가 있다. 0.9MB를 아끼려고 호환성을 걸 이유가 없다.

- **재현**: 위 과정 전체가 [`scripts/process-bgm.mjs`](../../scripts/process-bgm.mjs)에 있다. 원본 파일은 용량 때문에 저장소에 두지 않으므로, 위 표의 URL에서 다시 받아 한 폴더에 넣고 `node scripts/process-bgm.mjs <원본폴더>`를 실행하면 커밋된 것과 같은 결과가 나온다(ffmpeg 필요 — PATH에 없으면 `FFMPEG` 환경변수로 경로 지정).
