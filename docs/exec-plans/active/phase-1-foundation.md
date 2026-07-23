# Phase 1 — 기반 구축 및 그림자 핵심 로직 스파이크

> 출처: `docs/design-docs/adr/ADR-001-shadow-boundary-judgment.md` 결정 + 팀 역할 분담(`TeamMate.md`)
> 생성: 2026-07-23

## 목표

Shadow-Step 레포 골격을 세우고, 그림자 계산(ShadowCaster)·경계 판정(ContainmentJudge) 핵심 로직이 실제로 60 FPS로 동작하며 "억울한 죽음" 없이 정확한지 프로토타입으로 검증한다. 이 스파이크가 통과해야 P1(MVP 기능) 착수가 안전하다.

## 태스크

- [ ] 레포 폴더 구조 생성 (`src/ui`, `src/shadow`, `src/physics`, `src/procgen`, `src/ai`, `src/entities`, `src/core`) — 담당: 배영환
- [ ] React + TypeScript + Canvas 셋업, Hello World 렌더 확인 — 담당: 송원호
- [ ] `Stage` 데이터 계약 타입 정의 (`lightPos`, `boundaryPolygon`, `obstacles`, `spawn`) — 담당: 배영환
- [ ] ShadowCaster 구현 (광원+캐릭터 위치 → 그림자 선분, `d = normalize(C - L)`, `tip = C + d·ℓ`) — 담당: 배영환
- [ ] ContainmentJudge 구현 (point-in-polygon + 선분-다각형 교차) + 경계 케이스 단위 테스트 (정점 접촉, 공선) — 담당: 배영환
- [ ] 임시 정적 스테이지(경계 다각형 하드코딩)로 캐릭터 이동 + 그림자 + 판정 결과 시각화 프로토타입 — 담당: 송원호
- [ ] 60 FPS 프레임타임 측정 (저사양 환경 시뮬레이션 포함) — 담당: 배영환·송원호
- [ ] GitHub Pages 배포 파이프라인 초안 구성 — 담당: 배영환

## 검증 기준

- [ ] 그림자 선분이 광원-캐릭터 위치에 맞춰 매 프레임 시각적으로 정확히 그려짐
- [ ] 경계 이탈 시 정확히 사망 판정, 정점/공선 경계 케이스에서도 "억울한 죽음" 없음
- [ ] 60 FPS 유지 확인 (Chrome/Edge)
- [ ] GitHub Pages 링크로 배포 및 접속 확인 (설치 없이 브라우저 플레이)

## 미결 (Phase 1 진행 중 결정 필요)

- 게임 제목 확정 (현재 "Shadow-Step" 가제) — 문서 전반에 반영 필요
- 그림자 길이 `ℓ` 산출 규칙 (고정값 vs 광원-캐릭터 거리 비례) — 프로토타입으로 실제 플레이해보며 결정
- 장애물의 그림자 occlusion 여부 — 미정 시 MVP 범위 제외로 진행
