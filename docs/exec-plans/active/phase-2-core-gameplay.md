# Phase 2 — 핵심 게임플레이 확장 및 제출 준비

> 생성: 2026-07-28
> Phase 1(레포 골격, ShadowCaster/ContainmentJudge, GitHub Pages 배포)은 완료되어 [`completed/phase-1-foundation.md`](../completed/phase-1-foundation.md)로 이동함.
> 이 문서는 Phase 1 완료 시점(2026-07-23) 이후 `develop`에 이미 병합된 작업을 사후 정리한 것과, 사전과제 제출까지 남은 작업을 함께 다룬다.

## 이미 완료된 작업 (사후 정리, 커밋 로그 기준)

- [x] 다중 광원(가로등) 메커닉 — 최근접 광원 기반 안전구역 판정 — ADR-004 — PR #7
- [x] 배경 아트 프롬프트 가이드 — 야외 가로등 거리 세계관 — PR #8, [[project-background-art-world-setting]]
- [x] 이동 패턴 학습 AI — 단순 빈도 기반 동선 차단 (PRD §7/§12) — PR #5
- [x] 라운드 진행 시스템 — 세이브 포인트 기반 전환 + 3R 디메리트 (PRD §7-1) — PR #4, #6
- [x] 캐릭터·그림자 스프라이트 적용 + 사망 시퀀스 (PRD §7-2) — PR #9
- [x] GitHub Pages 최초 배포 — 2026-07-28: `develop→main` PR #10 머지, Pages를 GitHub Actions 소스로 활성화, `https://baeyounghwan.github.io/NAN2026/` 접속 확인 완료

## 남은 작업

### A. PRD 미결 사항 확정 (P1 플레이테스트로 결정)

- [ ] 그림자 길이(ℓ)·회전 속도·허용 각도 실제 값 확정 (임시값: 80px, 180도/초, ±30도)
- [ ] 통로 폭·길이·최소 스폰-골 거리 실제 값 확정 (2026-07-28 Jump King식 난이도 실험으로 40스텝→80스텝, 최소 10셀→16셀로 1차 조정 완료 — `docs/design-docs/adr/ADR-003-procgen-corridor-collision.md`, 최종 확정은 플레이테스트로)
- [ ] 장애물 그림자 occlusion 기믹 추가 여부 — MVP 제외 권장, 최종 확정 필요
- [ ] 게임 제목 확정 (현재 "Shadow-Step" 가제) — **제출 문서 작성 전까지** 필요
- [ ] 3R 디메리트 수치 확정 (임시값: 허용 각도 배율 0.5, `src/core/round.ts`)

### B. 맵 디자인 확정 및 절차적 생성 전환

- [ ] 맵 디자인 확정 시 광원·스폰·골 위치를 절차적 생성 → 고정값으로 전환 ([[project-procgen-temporary-scope]] 참고, ADR-004 "재검토 조건" 확인)

### D. 라운드-스테이지 분리 및 이동 패턴 학습 AI 제거 (2026-07-28, 구현 완료 — PR #11 리뷰 중)

- [x] 라운드마다 독립적인 스테이지(새 파생 시드)로 전환 — `seedForRound`, `roundAfterClear` 도입, "라운드 전환"과 "스테이지 내부 세이브 포인트"를 분리(ADR-003 재검토 조건 해소 기록 참고)
- [x] 이동 패턴 학습 AI(`src/ai/`) 완전 제거 — 존재 의의 불명확 판단. `CLAUDE.md`/PRD-v1.md §5·§7·§9·§12 서술 갱신 포함
- [x] 시드 sweep 테스트로 체크포인트 좌표 겹침·라운드 시드 충돌 버그 2건 발견·수정 (`hasDistinctCells`, `deriveRoundSeed`)
- [ ] PR #11(`feature/round-independent-stages` → `develop`) 리뷰 반영 및 머지
- [ ] 머지 후 로컬 `develop` 정리(`git pull`) — 현재 로컬 develop이 origin보다 3커밋 앞선 상태(리셋이 보안 훅에 막혀 보류)
- [x] 브라우저 실측 검증(1차) — 자동화 도구 복구됨, 로컬 `npm run dev`(포트 5174)로 확인
  - [x] 오프닝 컷씬 → 1R 진입, 재시작 버튼(사망 횟수 리셋 + 스폰 복귀), 사망 시 즉시 체크포인트 리스폰 — 정상 동작 확인
  - [ ] 1R→2R→3R 지형 전환 — 미확인. 1R 스테이지 통로가 스폰에서 바로 우측이 아니라 하단 분기를 거쳐야 하는 구조로 보여, 스크립트 입력만으로는 골 도달 실패 — 실제 플레이(수동)로 재확인 필요
  - [x] **버그 발견 및 수정**: `drawShadowSprite`(`src/ui/GameCanvas.tsx`)의 전단(shear) 전용 변환이 `shadowAngle`이 정확히 수평(0° 또는 180°, sinθ≈0)일 때 완전히 퇴화(degenerate)되어 그림자 실루엣이 화면에 전혀 렌더링되지 않던 문제. `ctx.transform(1, 0, -stretch·cosθ, -stretch·sinθ, 0, 0)`에서 x축·y축 기저벡터가 둘 다 수평이 되어 2D 이미지가 폭 0으로 찌그러짐. 캔버스 픽셀 캡처로 재현 확인(각도 0°→비가시, 90°→정상 렌더링) 후 `shadowVerticalComponent()` 헬퍼로 sinθ에 최소 크기(0.12)를 강제하는 방식으로 수정 — 각도가 아주 살짝 어긋나 보이는 대가로 그림자가 항상 화면에 보이게 함. 회귀 테스트 4건 추가(`GameCanvas.test.ts`), 전체 98개 테스트 통과, 브라우저 실측으로 수정 확인. 같은 브랜치(`feature/round-independent-stages`)에 추가 커밋으로 반영(PR #11에 포함)
- [ ] 오늘 결정사항(Jump King 튜닝, 라운드=독립 스테이지, AI 제거) 배경·근거를 AI활용기술문서용으로 기록 (§C 참고)

### C. 사전과제 제출물 5종 (마감 2026-08-10)

- [ ] 플레이 가능 빌드 (GitHub Pages — 배포 완료, PRD 미결 사항 확정 후 최종 밸런스 반영 필요)
- [ ] 플레이 영상 (유튜브 공개 업로드 + 링크만 제출 — [[project-submission-video-hosting]])
- [ ] 게임소개 PDF
- [ ] AI활용기술문서 PDF (Claude Code 활용 내역 — 설계 결정·프롬프트 기록 필요)
- [ ] 팀원 롤 기술서 PDF (배영환: 백엔드/아키텍처/WBS, 송원호: 프론트엔드·UI/콘텐츠/QA)

## 검증 기준

- [ ] PRD 미결 사항 5개 모두 팀 확정 및 문서 반영
- [ ] 제출물 5종 모두 준비 완료
- [ ] 최종 GitHub Pages 빌드로 골든 패스(오프닝 → 1R~3R → 사망/클리어) 브라우저 실플레이 확인
