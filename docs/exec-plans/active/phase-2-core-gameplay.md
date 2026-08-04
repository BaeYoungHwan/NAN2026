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
- [x] 게임 제목 확정 — **「돌려돌려 그림자」** (2026-08-04 확정). 가제 "Shadow-Step"을 대체. 문서 11곳 반영 완료(README, index.html `<title>`, CLAUDE.md, PRD-v1, game-intro, ai-usage-report, architecture-v1, shadow-mechanic-diagram, design-docs/index, background-art-prompt-guide, ADR-001). npm 패키지명(`package.json`의 `shadow-step`)과 완료된 exec-plan·`shadow-step.md`(초기화 양식 원본)는 역사 기록·영문 슬러그로 의도적 유지
- [ ] 3R 디메리트 수치 확정 (임시값: 허용 각도 배율 0.5, `src/core/round.ts`)

### B. 맵 디자인 확정 및 절차적 생성 전환

- [ ] 맵 디자인 확정 시 광원·스폰·골 위치를 절차적 생성 → 고정값으로 전환 ([[project-procgen-temporary-scope]] 참고, ADR-004 "재검토 조건" 확인)

### D. 라운드-스테이지 분리 및 이동 패턴 학습 AI 제거 (2026-07-28, 구현 완료 — PR #11 리뷰 중)

- [x] 라운드마다 독립적인 스테이지(새 파생 시드)로 전환 — `seedForRound`, `roundAfterClear` 도입, "라운드 전환"과 "스테이지 내부 세이브 포인트"를 분리(ADR-003 재검토 조건 해소 기록 참고)
- [x] 이동 패턴 학습 AI(`src/ai/`) 완전 제거 — 존재 의의 불명확 판단. `CLAUDE.md`/PRD-v1.md §5·§7·§9·§12 서술 갱신 포함
- [x] 시드 sweep 테스트로 체크포인트 좌표 겹침·라운드 시드 충돌 버그 2건 발견·수정 (`hasDistinctCells`, `deriveRoundSeed`)
- [x] PR #11(`feature/round-independent-stages` → `develop`) 머지 완료 (origin/develop 커밋 `ac8abd6`)
- [x] 머지 후 로컬 `develop` 동기화 완료 (fast-forward, 충돌 없음)
- [x] 브라우저 실측 검증(1차) — 자동화 도구 복구됨, 로컬 `npm run dev`(포트 5174)로 확인
  - [x] 오프닝 컷씬 → 1R 진입, 재시작 버튼(사망 횟수 리셋 + 스폰 복귀), 사망 시 즉시 체크포인트 리스폰 — 정상 동작 확인
  - [x] **1R→2R→3R 지형 전환 실측 완료 — 헤드리스 + 실제 브라우저 이중 검증 (2026-08-03)**:
    1. 1차: GameCanvas가 쓰는 실제 프로덕션 함수(`generateStage`/`seedForRound`/`moveCharacter`/`naturalAngle`/`alignmentMargin`/`progressAt`/`isStageCleared`/`respawnPointFor`/`roundAfterClear`/`effectiveAngleTolerance`)를 React/Canvas 없이 그대로 조합한 헤드리스 시뮬레이션(임시 vitest 테스트, 실행 후 삭제)으로 로직 검증 — "완벽한 조종사" 봇이 1R→2R→3R→전체클리어까지 사망 없이 통과, 각 라운드가 서로 다른 그리드/스폰/골을 갖는 것도 확인. 부가 발견: 이동을 멈추지 않는 봇은 3R(허용각도 0.5배)에서 광원 근접 구간(최소거리 ~40px)을 반복 통과하지 못해 대량 사망 — 자연각 변화 속도가 순간적으로 회전속도(180도/초)에 근접/초과할 수 있어 "멈춰서 재정렬 후 전진" 전략이 아니면 통과가 매우 어려운 구간이 존재함(설계상 참고, 버그 아님 — P1 플레이테스트 시 3R 체감 난이도 항목으로 확인 권장).
    2. 2차(재검증 요청에 따라 추가): 헤드리스 결과만으로는 실제 렌더링/입력 파이프라인까지 검증되지 않는다는 점을 보완하기 위해, `GameCanvas.tsx`에 임시 디버그 훅(`window.__ssDebug`, 커밋 전 원복 완료·diff 없음 확인됨)을 추가하고, 실제 브라우저(로컬 `npm run dev`, chrome-devtools MCP)에서 진짜 `KeyboardEvent`(keydown/keyup, WASD/`,`/`.`)를 dispatch해 실시간으로 자동 조종 — 결과: **1R 클리어(19.4초) → 2R 클리어(22.1초, 안전구역 가이드라인 정상 제거 확인) → 3R 클리어(12.0초, "디메리트: 이동키 반전 + 허용 각도 축소" HUD 정상 표시) → 엔딩 컷씬 진입("어라... 진짜로 무사히 통과하셨네요?")**까지 전 구간 스크린샷으로 시각 확인. 콘솔 에러 없음(`/favicon.ico` 404만 존재, 기능과 무관).
  - [x] **버그 발견 및 수정**: `drawShadowSprite`(`src/ui/GameCanvas.tsx`)의 전단(shear) 전용 변환이 `shadowAngle`이 정확히 수평(0° 또는 180°, sinθ≈0)일 때 완전히 퇴화(degenerate)되어 그림자 실루엣이 화면에 전혀 렌더링되지 않던 문제. `ctx.transform(1, 0, -stretch·cosθ, -stretch·sinθ, 0, 0)`에서 x축·y축 기저벡터가 둘 다 수평이 되어 2D 이미지가 폭 0으로 찌그러짐. 캔버스 픽셀 캡처로 재현 확인(각도 0°→비가시, 90°→정상 렌더링) 후 `shadowVerticalComponent()` 헬퍼로 sinθ에 최소 크기(0.12)를 강제하는 방식으로 수정 — 각도가 아주 살짝 어긋나 보이는 대가로 그림자가 항상 화면에 보이게 함. 회귀 테스트 4건 추가(`GameCanvas.test.ts`), 전체 98개 테스트 통과, 브라우저 실측으로 수정 확인. 같은 브랜치(`feature/round-independent-stages`)에 추가 커밋으로 반영(PR #11에 포함)
  - [x] **버그 발견 및 수정 (PR #11 리뷰 중)**: 진척도 판정(`nearestPathIndex`)이 캐릭터 위치에서 `stage.path` 중 유클리드 거리로 가장 가까운 인덱스를 찾는 방식이라 벽을 전혀 몰랐음. `carveCorridor`가 좁은 그리드 안에서 통로가 자기 자신 근처를 지나가는 경우가 흔해(300시드 전수 실측), 벽 하나 너머의 먼 인덱스(체크포인트·골 근처)가 "가장 가깝다"고 오판되는 사례가 실제 프로덕션 시드(`DEFAULT_SEED=12345` 1R 포함)에서 확인됨 — 체크포인트/골 조기 통과 가능한 정확성 버그. 스폰 기준 BFS 그래프 거리 필드(`Stage.distanceField`, `bfsDistances`)로 교체해 벽을 넘는 판정이 구조적으로 불가능하도록 수정(`progressAt`/`respawnPointFor`가 `nearestPathIndex`/`respawnIndexFor` 대체). 부수적으로 체크포인트 진행도 오름차순 재시도 게이트(`isAscendingProgress`) 추가, 재시도 예산 30→200회로 조정. 회귀 테스트 다수 추가(합성 그리드 벽 우회 검증, 200시드 sweep), `npm test`(107개) 전부 통과, `tsc`/`build` 클린. 상세 기록: `docs/design-docs/adr/ADR-003-procgen-corridor-collision.md` "버그 수정 기록 (2026-07-28)". 같은 브랜치에 추가 커밋으로 반영(PR #11에 포함)
  - [x] **버그 발견 및 수정 (2026-08-04, 플레이 제보)**: "찍지도 않은 세이브 포인트가 활성 표시되고, 죽으면 처음 보는 지점에서 재개된다" — 세이브 포인트 활성화 판정이 `farthestProgress >= checkpointProgress[i]`, 즉 방향 정보가 없는 스칼라(스폰 기준 BFS 거리) 비교라, 체크포인트와 정반대 갈래로 진행해도 통과 처리되던 문제. 체크포인트 반경 2칸을 통행 금지로 막고 BFS를 돌린 실측에서 전 라운드 6/6 체크포인트가 "근처에 얼씬도 않고" 통과 가능함을 확인. 2차 증상으로 배치(carve 순서 인덱스 균등 분할)와 판정(BFS 거리)의 척도가 달라 체크포인트가 코스 초반에 몰려 있었음(골 진행도 22인 1R에서 체크포인트 진행도 3, 5). 수정: ① 활성화 판정을 실제 접촉(`hasTouchedCheckpoint`, 반경 40px = 통로 폭의 절반)으로 교체 + 프레임 래치, ② 배치 기준을 "스폰→골 최단 경로 위 + BFS 진행도 균등 분할"로 교체 — 최단 경로 제한은 세이브 포인트를 골로 가는 길목에 놓기 위한 것(이전 배치는 2R·3R 체크포인트가 최단 경로 밖, 2R은 맵 구석에 있어 일부러 찾아가야 했음), 진행도 분할은 코스 중간에 놓기 위한 것(1~200 시드 실측 전부 정확히 50% 지점). 실측상 밟는 데 드는 추가 이동이 중앙값 -5px·최대 30px로 사실상 공짜이면서 우회도 100/100 시드 가능, ③ 개수 2→1(라운드당 코스 중간 1개). 세이브 포인트를 밟을지는 플레이어 선택이며 하나도 안 밟고 클리어 가능한 것이 의도된 사양임을 확인(캐릭터 충돌 반경 반영 픽셀 단위 우회 탐색으로 1~30 시드 전부 우회 가능 실측). 회귀 테스트 추가(접촉 판정 경계값, 배치 진행도 비율 30~70% 게이트), `npm test`(113개) 전부 통과, `tsc -b` 클린. 상세 기록: `docs/design-docs/adr/ADR-003-procgen-corridor-collision.md` "버그 수정 기록 (2026-08-04)"
- [x] 오늘 결정사항(Jump King 튜닝, 라운드=독립 스테이지, AI 제거) 배경·근거를 AI활용기술문서용으로 기록 — `docs/product-specs/ai-usage-report.md` 초안 작성 완료 (§C 참고)

### E. 오디오 시스템 (2026-08-04, 구현 완료)

> 맵 디자인(§B, 송원호 담당)에 물리지 않는 독립 작업으로 선행. 게임플레이 근거: 2R부터 안전 구역 가이드라인(부채꼴)이 사라져(`isGuideVisible`) 시각 피드백이 그림자 색상 하나로 줄어드는데, 위험도 비례 경고음이 그 공백을 메운다.

- [x] 사운드 20종 자체 합성 — `scripts/generate-audio.mjs` (외부 의존성 0, Node 표준 라이브러리만). 외부 음원을 받지 않아 라이선스를 팀 소유로 확정. 포맷은 WAV(ffmpeg 부재로 mp3 인코딩 불가, `decodeAudioData`는 WAV 완전 지원). 총 4.5MB
- [x] 오디오 엔진 — `src/audio/` 신설. GainNode 3단 믹서(cue→bus→master), 효과음은 `AudioBuffer` 프리로드·BGM은 `HTMLAudioElement` 스트리밍으로 분리, 큐별 쿨다운·피치 변조·루프 관리·BGM 크로스페이드
- [x] 에셋 폴백 — `ui/backgroundArt.ts`와 동일 계약. 파일이 없거나 손상된 큐만 null로 남기고 재생 요청을 조용히 무시한다. **오디오 폴더를 통째로 비운 상태로 브라우저 실측 검증 완료: 콘솔 에러 0건, 게임 전 구간 정상 진행**
- [x] autoplay 정책 대응 — window 첫 입력(`keydown`/`pointerdown`, once)에서 `AudioContext.resume()`, 준비 전 요청된 BGM은 준비 완료 시 재시도(`ready` 플래그)
- [x] 위험 경고음 — `dangerTone.ts`가 margin(0~1 연속값)을 재생 간격 500→120ms·음량 0.2→1.0으로 매핑. 임계값 0.6은 `selectBodyPose`/`selectShadowExpression`(몸 포즈 flinch·그림자 표정 surprised 전환점)과 일치시켜 시청각이 같은 순간에 반응하게 함
- [x] `moveCharacter` 반환을 `MoveResult`(`position`/`blockedX`/`blockedY`)로 확장 — 축 분리 이동이라 "위치 미변화"로는 대각선 중 한 축만 막힌 경우를 놓친다
- [x] `M` 키 음소거 토글(localStorage 유지, HUD 표시). `core/input.ts`의 KEY_MAP에는 넣지 않음 — `InputState`는 게임플레이 입력 계약이고 뮤트는 대사·컷신 중에도 동작해야 하는 메타 조작. `event.code` 판정이라 한글 입력 상태에서도 동작
- [x] 테스트 37건 추가(`dangerTone` 11, `audioEngine` 20, `audioAssets` 6) + `character.test.ts` 5건 추가 — **`npm test` 155개 전부 통과, 기존 118개 회귀 없음**. `tsc -b`/`npm run build` 클린
- [x] 문서 — `docs/design-docs/audio-asset-guide.md` 신규(큐 목록·합성 레시피·교체 절차·루프 제약), `public/assets/ASSET_SOURCES.md`에 라이선스 기재
- [ ] 실제 스피커로 청감 확인 — 자동 검증(파형 분석·이벤트 계측)까지만 완료. 음량 밸런스와 음색 취향은 사람이 들어야 판단 가능하며, 조정은 `soundCues.ts`의 `volume`(밸런스) 또는 `scripts/generate-audio.mjs`의 레시피(음색)에서 한다

### C. 사전과제 제출물 5종 (마감 2026-08-10)

- [x] README에 제출물 5종 현황 표 추가 (2026-08-03) — 스크린샷/GIF는 맵 디자인 확정 후 다시 촬영해야 해서 보류(§B 완료 후 진행)
- [ ] 플레이 가능 빌드 (GitHub Pages — 배포 완료, PRD 미결 사항 확정 후 최종 밸런스 반영 필요)
- [ ] 플레이 영상 (유튜브 공개 업로드 + 링크만 제출 — [[project-submission-video-hosting]])
- [ ] 게임소개 PDF — `docs/product-specs/game-intro.md` 초안 작성됨. 남은 작업: 플레이 영상 링크, 스크린샷(맵 확정 후), PDF 변환
- [ ] AI활용기술문서 PDF — `docs/product-specs/ai-usage-report.md` 초안 작성됨(배영환 파트). 남은 작업: 원호님 파트(콘텐츠/QA AI 활용) 보강, 스크린샷 첨부, PDF 변환
- [ ] 팀원 롤 기술서 PDF — `docs/product-specs/team-roles.md` 초안 작성됨(배영환 파트 완료, 송원호 파트는 커밋 로그 기반 초안만 — 본인 작성 필요)

## 검증 기준

- [ ] PRD 미결 사항 5개 모두 팀 확정 및 문서 반영
- [ ] 제출물 5종 모두 준비 완료
- [ ] 최종 GitHub Pages 빌드로 골든 패스(오프닝 → 1R~3R → 사망/클리어) 브라우저 실플레이 확인
