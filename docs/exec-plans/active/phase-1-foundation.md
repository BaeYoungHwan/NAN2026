# Phase 1 — 기반 구축 및 그림자 핵심 로직 스파이크

> 출처: `docs/design-docs/adr/ADR-001-shadow-boundary-judgment.md` 결정 + 팀 역할 분담(`TeamMate.md`)
> 생성: 2026-07-23

## 목표

Shadow-Step 레포 골격을 세우고, 그림자 계산(ShadowCaster)·경계 판정(ContainmentJudge) 핵심 로직이 실제로 60 FPS로 동작하며 "억울한 죽음" 없이 정확한지 프로토타입으로 검증한다. 이 스파이크가 통과해야 P1(MVP 기능) 착수가 안전하다.

## 태스크

- [x] 레포 폴더 구조 생성 (`src/ui`, `src/shadow`, `src/physics`, `src/procgen`, `src/ai`, `src/entities`, `src/core`) — 담당: 배영환 — `feature/repo-scaffold` 병합 완료
- [ ] React + TypeScript + Canvas 셋업, Hello World 렌더 확인 — 담당: 송원호
- [x] `Stage` 데이터 계약 타입 정의 (`lightPos`, `boundaryPolygon`, `obstacles`, `spawn`) — 담당: 배영환 — `src/core/stage.ts`
- [x] ShadowCaster 구현 (광원+캐릭터 위치 → 그림자 선분, `d = normalize(C - L)`, `tip = C + d·ℓ`) — 담당: 배영환 — `feature/shadow-core` 병합 완료, 단위 테스트 포함
- [x] ContainmentJudge 구현 (point-in-polygon + 선분-다각형 교차) + 경계 케이스 단위 테스트 (정점 접촉, 공선) — 담당: 배영환 — `feature/shadow-core` 병합 완료
- [ ] 임시 정적 스테이지(경계 다각형 하드코딩)로 캐릭터 이동 + 그림자 + 판정 결과 시각화 프로토타입 — 담당: 송원호
- [ ] 60 FPS 프레임타임 측정 (저사양 환경 시뮬레이션 포함) — 담당: 배영환·송원호
- [ ] GitHub Pages 배포 파이프라인 초안 구성 — 담당: 배영환

## 브랜치 전략

`CONTRIBUTING.md`의 3단계 전략(`feature/*` → `develop` → `main`)을 이 Phase의 태스크에 매핑한다. `Stage` 데이터 계약이 배영환·송원호 작업 모두의 기반이므로, 병합 순서를 지키지 않으면 충돌이 커진다.

| 순서 | 브랜치 | 담당 | 포함 태스크 | 선행 조건 | PR 대상 |
|------|--------|------|-------------|-----------|---------|
| 1 | `feature/repo-scaffold` | 배영환 | 레포 폴더 구조 생성, `Stage` 데이터 계약 타입 정의, 프로젝트 설정(package.json/tsconfig 등) | 없음 — 가장 먼저 병합 | `develop` |
| 2a | `feature/canvas-setup` | 송원호 | React+TS+Canvas 셋업, Hello World 렌더 확인 | `repo-scaffold`가 `develop`에 병합된 후 시작 (설정 파일 충돌 방지) | `develop` |
| 2b | `feature/shadow-core` | 배영환 | ShadowCaster·ContainmentJudge 구현 + 경계 케이스 단위 테스트 | `repo-scaffold`가 `develop`에 병합된 후 시작 (`Stage` 타입 필요). `canvas-setup`과는 서로 다른 파일이라 병렬 진행 가능 | `develop` |
| 3 | `feature/render-prototype` | 송원호 | 정적 스테이지(경계 다각형 하드코딩)로 캐릭터·그림자·판정 결과 시각화 | `canvas-setup`과 `shadow-core` 둘 다 `develop`에 병합된 후 시작 | `develop` |
| 4 | `feature/pages-deploy` | 배영환 | GitHub Pages 배포 파이프라인 초안 | 없음 — 아무 때나 독립적으로 진행 가능 | `develop` |

60 FPS 프레임타임 측정은 별도 브랜치 없이 `render-prototype`이 `develop`에 병합된 후 공동 확인한다.

**충돌 방지 규칙**: `package.json`/`tsconfig.json` 등 프로젝트 설정 파일은 `repo-scaffold`에서만 만들고, 이후 브랜치는 이를 베이스로 시작한다 — 설정 파일을 여러 브랜치에서 동시에 건드리지 않는다.

**최종 배포 병합**: Phase 1 검증 기준을 모두 통과하고 `develop`이 안정되면, 배영환이 `develop` → `main` PR을 생성·머지한다.

## 검증 기준

- [ ] 그림자 선분이 광원-캐릭터 위치에 맞춰 매 프레임 시각적으로 정확히 그려짐
- [ ] 경계 이탈 시 정확히 사망 판정, 정점/공선 경계 케이스에서도 "억울한 죽음" 없음
- [ ] 60 FPS 유지 확인 (Chrome/Edge)
- [ ] GitHub Pages 링크로 배포 및 접속 확인 (설치 없이 브라우저 플레이)

## 미결 (Phase 1 진행 중 결정 필요)

- 게임 제목 확정 (현재 "Shadow-Step" 가제) — 문서 전반에 반영 필요
- 그림자 길이 `ℓ` 산출 규칙 (고정값 vs 광원-캐릭터 거리 비례) — 프로토타입으로 실제 플레이해보며 결정
- 장애물의 그림자 occlusion 여부 — 미정 시 MVP 범위 제외로 진행
