<h1 align="center">돌려돌려 그림자</h1>

<p align="center">
  <b>몸과 그림자를 따로 붙잡고 저승의 경계를 건너세요.</b><br>
  캐릭터와 그림자를 <b>동시에</b> 조종하는 키보드 전용 이중 조작 액션 퍼즐
</p>

<p align="center">
  <a href="https://baeyounghwan.github.io/NAN2026/"><b>▶ 바로 플레이</b></a> ·
  <a href="#조작-방법">조작법</a> ·
  <a href="#게임-소개">게임 소개</a> ·
  <a href="#사전과제-제출물-현황">제출물</a>
</p>

<p align="center">
  <a href="https://github.com/BaeYoungHwan/NAN2026/actions/workflows/deploy-pages.yml"><img alt="배포" src="https://github.com/BaeYoungHwan/NAN2026/actions/workflows/deploy-pages.yml/badge.svg"></a>
  <img alt="테스트" src="https://img.shields.io/badge/tests-222%20passed-brightgreen">
  <img alt="스택" src="https://img.shields.io/badge/TypeScript-React-blue">
  <img alt="플랫폼" src="https://img.shields.io/badge/platform-web%20(keyboard%20only)-lightgrey">
</p>

<p align="center">
  <img src="docs/submission/screenshots/03-round1-guide.png" alt="1R 플레이 화면 — 안전 구역 부채꼴 안에 그림자를 유지하며 이동한다" width="720">
</p>

> NHN 주최 **NAN2026 AI 게임 개발 해커톤** 사전과제 제출용 웹 게임입니다.

---

## 게임 소개

저승사자가 동명이인 착오로 주인공을 저승에 데려온다. 아직 죽을 때가 아닌 주인공은 이승-저승 경계를 다시 넘어야 하는데, 경계를 넘는 동안 그림자가 불안정해져 몸과 그림자를 따로 붙잡고 있어야 한다.

광원(가로등)은 스테이지마다 정해진 위치에 있고, **"캐릭터 뒤(광원 반대 방향) ± 허용 각도"** 가 안전 구역으로 매 프레임 재계산됩니다. 그림자는 안전 구역과 무관하게 **플레이어가 직접 돌린 각도를 그대로 유지**하므로, 캐릭터를 움직여 안전 구역이 이동할 때마다 그림자도 맞춰 돌려야 합니다 — 그림자 각도가 안전 구역을 벗어나는 순간 즉사·리스폰됩니다.

즉 **왼손으로는 걷고 오른손으로는 그림자를 붙잡는** 것이 이 게임의 전부입니다.

## 조작 방법

| 키 | 동작 |
|----|------|
| `W` `A` `S` `D` 또는 방향키 | 캐릭터 이동 |
| `,` | 그림자 시계방향 회전 |
| `.` | 그림자 반시계방향 회전 |
| `M` | 소리 켜기 / 끄기 |

마우스는 쓰지 않습니다. 3R에서는 이동키(WASD)가 상하좌우 반전됩니다 — 그림자 회전키는 영향받지 않습니다.

## 라운드 구조

라운드마다 완전히 새로운 지형(절차적 생성, 결정론적 시드)으로 전환됩니다. 스테이지 중간에는 세이브 포인트가 있어, 사망 시 직접 밟아 활성화한 지점(없으면 스폰)으로 리스폰합니다. **밟을지 말지는 플레이어의 선택**이며, 하나도 밟지 않고 클리어할 수 있습니다.

| 라운드 | 핵심 변화 | 화면 |
|--------|-----------|------|
| **1R** | 안전 구역(부채꼴) 가이드라인이 표시됨 | <img src="docs/submission/screenshots/03-round1-guide.png" width="260"> |
| **2R** | 가이드라인 제거 — 위치를 스스로 기억·추측해야 함 | <img src="docs/submission/screenshots/04-round2-no-guide.png" width="260"> |
| **3R** | 허용 각도 절반 축소 + 이동키 반전 (디메리트) | <img src="docs/submission/screenshots/05-round3-demerit.png" width="260"> |

가이드라인이 사라지는 2R부터는 **위험도에 비례해 빨라지는 경고음**이 시각 피드백의 공백을 메웁니다.

이번 사전과제 데모는 1R~3R까지입니다. 4R 이상은 본선/이후 개발로 보류했습니다.

<details>
<summary><b>스크린샷 더 보기</b> — 타이틀 화면, 튜토리얼</summary>
<br>
<img src="docs/submission/screenshots/01-title.png" alt="타이틀 화면" width="480">
<img src="docs/submission/screenshots/02-tutorial-dialogue.png" alt="저승사자 튜토리얼 대사" width="480">
</details>

---

## 기술 스택

- **TypeScript + React + HTML5 Canvas** — UI는 React, 게임 렌더링·그림자 계산·각도 판정은 Canvas를 직접 제어
- **Vite** 빌드 · **Vitest** + Testing Library 테스트 (**22개 파일 / 222개 테스트**)
- 절차적 스테이지 생성은 **클라이언트에서 수행** — 서버가 없어 운영 비용이 들지 않습니다
- **효과음 13종은 코드로 직접 합성** — 외부 의존성 없이 Node 표준 라이브러리만으로 PCM을 계산합니다([`scripts/generate-audio.mjs`](scripts/generate-audio.mjs))
- 배포: **GitHub Pages** — `main` push 시 GitHub Actions로 자동 배포되며, **배포 직전 테스트 게이트**를 통과해야 나갑니다

## 로컬 실행

```bash
npm install
npm run dev       # 개발 서버 (http://localhost:5173)
npm run build     # 프로덕션 빌드 (tsc -b && vite build)
npm run preview   # 빌드 결과 로컬 미리보기
npm test          # vitest 유닛 테스트
```

개발 서버에서만 쓸 수 있는 쿼리 파라미터가 두 개 있습니다. **프로덕션 빌드에서는 완전히 무시**되므로, 심사 대상 빌드에서 라운드를 건너뛰거나 밸런스를 바꿀 수 없습니다.

| 파라미터 | 용도 |
|----------|------|
| `?round=2` / `?round=3` | 해당 라운드로 바로 시작 (타이틀·오프닝 건너뜀) |
| `?tune=1` | 밸런스 튜닝 패널 — 그림자 길이·허용 각도·회전 속도·맵 크기를 슬라이더로 실시간 조정 |

밸런스 파라미터 13개는 전부 [`src/core/tuning.ts`](src/core/tuning.ts) 한 파일에 모여 있습니다.

## 프로젝트 구조

```
src/
├── core/         # Stage/Round 데이터 계약, 라운드 전이·디메리트, 키보드 입력, 밸런스 파라미터(tuning.ts)
├── shadow/       # ShadowCaster(그림자 각도·끝점 계산), ContainmentJudge(안전 구역 판정)
├── physics/      # 캐릭터 이동, 벽 충돌(collider)
├── procgen/      # 시드 기반 스테이지 생성(통로 carve, 광원·세이브포인트 배치), 도달가능성 검증
├── audio/        # 3단 믹서, 큐 재생·쿨다운, BGM 크로스페이드, 위험도 비례 경고음
├── content/      # 저승사자 대사, 컷신 슬라이드, 에셋 크레딧
└── ui/           # GameCanvas, TitleScreen, HUD, DialogueBox, CutsceneSlide, 스프라이트·배경 로딩
```

## 문서

| 문서 | 내용 |
|------|------|
| [`docs/product-specs/PRD-v1.md`](docs/product-specs/PRD-v1.md) | 제품 요구사항 정의서 |
| [`docs/design-docs/architecture-v1.md`](docs/design-docs/architecture-v1.md) · [`ARD-v1.md`](docs/design-docs/ARD-v1.md) | 아키텍처 설계와 결정 근거 |
| [`docs/design-docs/adr/`](docs/design-docs/adr) | 개별 결정 기록(ADR) — 그림자 경계 판정, 이중 조작, 절차적 생성·충돌, 다중 광원 |
| [`docs/design-docs/shadow-mechanic-diagram.md`](docs/design-docs/shadow-mechanic-diagram.md) | 그림자 메커닉 다이어그램 |
| [`docs/exec-plans/`](docs/exec-plans) | 실행 계획과 기술 부채 추적 |
| [`public/assets/ASSET_SOURCES.md`](public/assets/ASSET_SOURCES.md) | 전 에셋의 출처·생성 방법·라이선스 |

## 에셋과 라이선스

모든 에셋의 출처와 라이선스를 [`ASSET_SOURCES.md`](public/assets/ASSET_SOURCES.md)에 파일 단위로 기록합니다.

- **효과음 13종** — 코드로 직접 합성. 제3자 라이선스 없음
- **BGM 5곡** — [OpenGameArt.org](https://opengameart.org/) 음원(CC0 3곡 · CC-BY 3.0 1곡 · CC-BY 4.0 1곡). CC-BY 2곡의 표시 의무는 **타이틀 화면에 저작자·변경 사실·라이선스 URI를 렌더**해 이행하며, 표기가 빠지면 테스트가 실패합니다
- **캐릭터·배경·타일** — 생성형 AI로 제작 후 가공

## 팀

| 이름 | 역할 |
|------|------|
| 배영환 | 게임 로직·아키텍처·인프라 — 판정·절차적 생성·오디오·배포 |
| 송원호 | 프론트엔드·UI/콘텐츠/QA — 캐릭터/그림자 비주얼·컷신·아트 파이프라인 |

서버가 없는 클라이언트 전용 프로젝트라, 역할은 "화면에 보이는 것"과 "화면 뒤에서 판정하는 것"으로 갈랐습니다. 모든 PR은 상대의 리뷰를 거쳐 병합했습니다 — 자세한 분업은 [`docs/submission/team-roles.md`](docs/submission/team-roles.md) 참고.

---

## 사전과제 제출물 현황

> 마감: 2026-08-10. NAN2026 사전과제는 아래 5종 제출물을 모두 요구합니다.

| # | 제출물 | 형태 | 상태 | 위치/링크 |
|---|--------|------|------|-----------|
| 1 | 플레이 가능한 빌드 및 소스 코드 | 웹(GitHub Pages) + 소스 | ✅ 완료 | https://baeyounghwan.github.io/NAN2026/ |
| 2 | 플레이 동영상 (30~60초) | YouTube | ✅ 완료 | https://www.youtube.com/watch?v=zsrd9mrBQdI |
| 3 | 게임 소개 및 설명 문서 | PDF | ✅ 완료 | [`game-intro.md`](docs/submission/game-intro.md) · [PDF](docs/submission/pdf/game-intro.pdf) |
| 4 | AI 활용 기술 문서 | PDF | 🟡 PDF 완료 (라이선스 최종 확인 대기) | [`ai-usage-report.md`](docs/submission/ai-usage-report.md) · [PDF](docs/submission/pdf/ai-usage-report.pdf) |
| 5 | 팀원 롤 기술서 | PDF | ✅ 완료 | [`team-roles.md`](docs/submission/team-roles.md) · [PDF](docs/submission/pdf/team-roles.pdf) |

PDF는 `node scripts/build-submission-pdf.mjs`로 생성합니다 — 마크다운을 고치면 다시 돌리면 됩니다(외부 의존성 없이 Chrome의 인쇄 기능을 씁니다). 스크린샷을 다시 찍은 뒤에는 `node scripts/optimize-screenshots.mjs`로 용량을 정리합니다.

배포본은 2026-08-06에 갱신했습니다 — 타이틀 화면·HUD 정리·favicon·DPR 대응과 BGM 외부 음원 교체가 모두 반영돼 있습니다(라이브 실측: 리소스 37건 전부 200, 콘솔 에러 0건). PRD 미결 사항(그림자 길이·허용 각도·회전 속도·가로등 간격·3R 배율)을 플레이테스트로 확정하면 최종 밸런스로 한 번 더 갱신할 예정입니다 — 절차는 [`docs/ref/playtest-protocol.md`](docs/ref/playtest-protocol.md)에 정리해 뒀습니다.

## 일정

| 일정 | 날짜 |
|------|------|
| 사전과제 제출 마감 | 2026-08-10 |
| 참가팀 발표 | 2026-08-22 |
| 본행사 (48시간 개발, 주제 현장 공개) | 2026-09-04 ~ 09-06 |
