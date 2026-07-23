# TODO — NAN2026 (Shadow-Step, 가제)

> 워크플로우: `[ ]` 대기 → `[🔄]` 진행 중 → `[x]` 완료
> 재시작 시: `docs/ref/session-state.md` 확인 후 `[🔄]` 항목부터 재개

---

## 시작 전

- [x] `/init-project` 실행 완료
- [x] 게임 주제/컨셉 확정 — Shadow-Step, 그림자 회피 액션 퍼즐
- [x] 기술 스택 확정 — TypeScript + React + HTML5 Canvas
- [x] `docs/design-docs/architecture-v1.md` 검토 및 확정 — 그림자 경계 판정 방식 확정 (`ADR-001`)
- [ ] `docs/design-docs/ARD-v1.md` 비기능 요건 확정
- [x] Phase 분할 후 `docs/exec-plans/active/`에 실행 계획 생성 — [`phase-1-foundation.md`](docs/exec-plans/active/phase-1-foundation.md)

---

## P0 — 기반 구축

- [ ] 레포 초기화 및 폴더 구조 생성 (src/, tests/ 등)
- [ ] React + TypeScript + Canvas 셋업 및 Hello World 확인
- [ ] 그림자 각도/궤적 계산 로직 프로토타입 스파이크 (핵심 재미 검증)
- [ ] GitHub Pages 배포 파이프라인 초안 구성 (심사자가 링크만으로 플레이 가능해야 함)

---

## P1 — MVP 핵심 기능

- [ ] WASD / 방향키 기반 캐릭터 이동 시스템
- [ ] 광원(태양) 고정 위치 지정 및 캐릭터 위치 기반 실시간 그림자 궤적/각도 계산 (ShadowCaster — 선분 모델)
- [ ] 그림자 경계 이탈 판정 (즉사 및 스테이지 리셋, 기하학적/벡터 방식 — ContainmentJudge)
- [ ] 스테이지 지형·광원 위치·안전 경계 다각형 절차적 생성 (Procedural Generation)
- [ ] 플레이어 이동 패턴 학습 → 자주 가는 동선 차단 AI 알고리즘
- [ ] 실패 시 즉시 재시작(리트라이) 흐름
- [ ] 최소 UI (조작법 안내, 재시작 버튼, 클리어 표시)

---

## P2 — 사전과제 제출물 준비 (마감: 2026-08-10)

> 5종 모두 필수 제출 — 하나라도 누락 시 심사 제외

- [ ] 1. 플레이 가능한 빌드 + 전체 소스코드 (GitHub Pages 링크, 커밋 기록 유지)
- [ ] 2. 플레이 동영상 30~60초 (YouTube, 실제 플레이 화면만)
- [ ] 3. 게임 소개 및 설명 문서 PDF (개요/플레이방법/실행방법/링크)
- [ ] 4. AI 활용 기술 문서 PDF (사용 도구, 주요 프롬프트, 외부 에셋 출처/라이선스)
- [ ] 5. 팀원 롤 기술서 PDF (배영환/송원호 담당 역할 및 구현 영역)
- [ ] 신청서 및 사전과제 제출 (Google Form)
- [ ] 저장소 공개 상태 확인 (비공개 시 dl_gameai_reviewer@nhn.com 초대)

---

## 참고 일정

| 일정 | 날짜 |
|------|------|
| 사전과제 제출 마감 | 2026-08-10 |
| 참가팀 발표 | 2026-08-22 |
| 본행사 (48시간 개발, 주제 현장 공개) | 2026-09-04 ~ 09-06 |
