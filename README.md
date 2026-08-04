# 돌려돌려 그림자

NHN 주최 **NAN2026 AI 게임 개발 해커톤** 사전과제 제출용 웹 게임입니다.

**바로 플레이**: https://baeyounghwan.github.io/NAN2026/

---

## 사전과제 제출물 현황

> 마감: 2026-08-10. NAN2026 사전과제는 아래 5종 제출물을 모두 요구합니다.

| # | 제출물 | 형태 | 상태 | 위치/링크 |
|---|--------|------|------|-----------|
| 1 | 플레이 가능한 빌드 및 소스 코드 | 웹(GitHub Pages) + 소스 | ✅ 완료 | https://baeyounghwan.github.io/NAN2026/ |
| 2 | 플레이 동영상 (30~60초) | YouTube | ⏳ 미착수 | - |
| 3 | 게임 소개 및 설명 문서 | PDF | ⏳ 미착수 | - |
| 4 | AI 활용 기술 문서 | PDF | 🟡 초안(배영환 파트 완료, 원호 파트 대기) | [`docs/product-specs/ai-usage-report.md`](docs/product-specs/ai-usage-report.md) |
| 5 | 팀원 롤 기술서 | PDF | 🟡 초안(배영환 파트 완료, 원호 파트 대기) | [`docs/product-specs/team-roles.md`](docs/product-specs/team-roles.md) |

플레이 가능 빌드는 배포돼 있지만, PRD 미결 사항(그림자 길이·통로 폭·게임 제목 등, [`docs/exec-plans/active/phase-2-core-gameplay.md`](docs/exec-plans/active/phase-2-core-gameplay.md) §A 참고)이 확정되고 맵 디자인이 반영된 뒤 최종 밸런스로 갱신될 예정입니다.

---

## 게임 소개

저승사자가 동명이인 착오로 주인공을 저승에 데려온다. 아직 죽을 때가 아닌 주인공은 이승-저승 경계를 다시 넘어야 하는데, 경계를 넘는 동안 그림자가 불안정해져 몸과 그림자를 따로 붙잡고 있어야 한다.

캐릭터(WASD)와 그림자(`,`/`.`)를 **동시에** 조종하는 이중 조작 키보드 전용 액션 퍼즐입니다. 광원은 스테이지마다 정해진 위치에 있고, "캐릭터 뒤(광원 반대 방향) ± 허용 각도"가 안전 구역으로 매 프레임 재계산됩니다. 그림자는 안전 구역과 무관하게 플레이어가 직접 돌린 각도를 그대로 유지하므로, 캐릭터를 움직여 안전 구역이 이동할 때마다 그림자도 맞춰 돌려야 합니다 — 그림자 각도가 안전 구역을 벗어나는 순간 즉사·리스폰됩니다.

## 조작 방법

| 키 | 동작 |
|----|------|
| `W`/`A`/`S`/`D` 또는 방향키 | 캐릭터 이동 |
| `,` | 그림자 시계방향 회전 |
| `.` | 그림자 반시계방향 회전 |

3R(디메리트 라운드)에서는 캐릭터 이동키(WASD)가 상하좌우 반전됩니다 — 그림자 회전은 영향받지 않습니다.

## 라운드 구조

라운드마다 완전히 새로운 지형(절차적 생성, 결정론적 시드)으로 전환됩니다. 라운드 스테이지 내부에는 세이브 포인트가 있어, 사망 시 마지막으로 넘은 지점(없으면 스폰)으로 리스폰합니다.

| 라운드 | 핵심 변화 |
|--------|-----------|
| 1R | 안전 구역(부채꼴) 가이드라인이 화면에 표시됨 |
| 2R | 가이드라인 제거 — 안전 구역 위치를 스스로 기억/추측해야 함 |
| 3R | 허용 각도 절반 축소 + WASD 이동키 반전 (디메리트) |

이번 사전과제 데모는 1R~3R까지만 구현합니다. 4R 이상은 본선/이후 개발로 보류됩니다.

## 기술 스택

- **TypeScript + React + HTML5 Canvas** — UI는 React, 게임 렌더링·그림자 계산·각도 판정은 Canvas를 직접 제어
- **Vite** — 빌드/개발 서버
- **Vitest** + Testing Library — 유닛/컴포넌트 테스트
- 절차적 스테이지 생성은 클라이언트(브라우저) 측에서 수행 — 서버 비용 없음
- 배포: **GitHub Pages** (`main` 브랜치 push 시 GitHub Actions로 자동 배포)

## 로컬 실행

```bash
npm install
npm run dev       # 개발 서버 (http://localhost:5173)
npm run build     # 프로덕션 빌드 (tsc -b && vite build)
npm run preview   # 빌드 결과 로컬 미리보기
npm test          # vitest 유닛 테스트
```

## 프로젝트 구조

```
src/
├── core/         # Stage/Round 데이터 계약, 라운드 전이·디메리트 로직, 키보드 입력
├── shadow/       # ShadowCaster(그림자 각도·끝점 계산), ContainmentJudge(안전 구역 판정)
├── physics/      # 캐릭터 이동, 벽 충돌(collider)
├── procgen/      # 시드 기반 스테이지 절차적 생성(통로 carve, 광원/세이브포인트 배치), 도달가능성 검증
├── content/      # 저승사자 대사, 컷신 슬라이드 텍스트
└── ui/           # GameCanvas, HUD, DialogueBox, CutsceneSlide, 스프라이트·배경 아트 로딩
```

## 문서

| 문서 | 내용 |
|------|------|
| [`docs/product-specs/PRD-v1.md`](docs/product-specs/PRD-v1.md) | 제품 요구사항 정의서 |
| [`docs/design-docs/architecture-v1.md`](docs/design-docs/architecture-v1.md) | 아키텍처 설계 |
| [`docs/design-docs/ARD-v1.md`](docs/design-docs/ARD-v1.md) | 아키텍처 결정 근거 |
| [`docs/design-docs/adr/`](docs/design-docs/adr) | 개별 아키텍처 결정 기록(ADR) — 그림자 경계 판정, 이중 조작, 절차적 생성-충돌, 다중 광원 |
| [`docs/design-docs/shadow-mechanic-diagram.md`](docs/design-docs/shadow-mechanic-diagram.md) | 그림자 메커닉 다이어그램 |
| [`docs/exec-plans/`](docs/exec-plans) | 실행 계획(Phase별 진행 상황, `active`/`completed`) |

## 팀

NAN2026 사전과제는 2인 팀으로 진행합니다.

| 이름 | 역할 |
|------|------|
| 배영환 | 백엔드/아키텍처/WBS 총괄 |
| 송원호 | 프론트엔드·UI/콘텐츠/QA |

## 일정

- 사전과제 제출 마감: 2026-08-10
- 참가팀 발표: 2026-08-22
- 본행사(48시간 개발, 주제 현장 공개): 2026-09-04 ~ 09-06
