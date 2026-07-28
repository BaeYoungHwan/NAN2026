# NAN2026 아키텍처 v1 (Shadow-Step)

> 작성일: 2026-07-23 | 버전: v1 | 상태: Draft
> 참조 ARD: `docs/design-docs/ARD-v1.md`

---

## 1. 시스템 개요

NHN NAN2026 해커톤 사전과제 제출용 웹 게임 "Shadow-Step"(가제). 플레이어는 캐릭터(WASD 이동)와 그림자(`,`/`.` 회전)를 동시에 조종하는 이중 조작 액션 퍼즐 게임이다. 광원(가로등)은 스테이지의 통로 경로를 따라 여러 개 고정 배치되며, 매 프레임 캐릭터와 가장 가까운 광원이 판정에 쓰인다(ADR-004) — 캐릭터 뒤(그 광원 반대 방향) ± 허용 각도가 "안전 구역"으로 재계산된다. 그림자는 이 안전 구역과 무관하게 플레이어가 직접 설정한 각도를 그대로 유지하므로, 캐릭터를 움직이면(가장 가까운 광원이 바뀌는 경우 포함) 안전 구역이 이동해 그림자와 어긋난다 — 그림자 각도가 안전 구역을 벗어나는 순간 즉사·스테이지 리셋된다. "캐릭터 이동이 바꾸는 필요 각도"와 "그림자 회전으로 실제 맞춰야 하는 각도"를 동시에 다뤄야 하는 것이 퍼즐의 핵심 재미다. 심사자가 GitHub Pages 링크를 클릭해 설치 없이 브라우저에서 바로 플레이할 수 있어야 한다.

## 2. 컴포넌트 다이어그램

```
[심사자 / 플레이어 브라우저]
        │
        ▼
[GitHub Pages 정적 호스팅]
        │
        ▼
[게임 클라이언트 (React + TypeScript + HTML5 Canvas)]
    ├──▶ [React UI Layer (타이틀, 조작법, 재시작 버튼, 클리어 표시, 현재 라운드 표시, 저승사자 대사 박스, 오프닝/엔딩 컷신 슬라이드)]
    ├──▶ [Round State (1R 가이드라인 표시 → 2R 제거 → 3R 디메리트 적용, 4R은 데모 범위 밖)]
    ├──▶ [Canvas Render/Game Loop (캐릭터·그림자·안전 구역 부채꼴 렌더링, 라운드에 따라 가이드라인 표시 여부 결정)]
    ├──▶ [Shadow System (ShadowCaster: 광원+캐릭터 위치 → 안전 구역 자연 각도 계산, 캐릭터 위치+회전 입력 → 그림자 각도·끝점 계산 / ContainmentJudge: 그림자 각도가 안전 구역(자연 각도 ± 허용치) 안인지 판정)]
    ├──▶ [Physics (character.ts: 축 분리 이동 / collider.ts: 타일 그리드 기반 벽 충돌판정 — 그림자 판정과 무관, 캐릭터 이동에만 관여)]
    ├──▶ [Procedural Generation (stageGenerator.ts: 시드 기반 random-walk carve로 통로·스폰·골·광원 위치 생성)]
    ├──▶ [Pattern-Learning AI (플레이어 이동 동선 학습 → 차단 로직)]
    └──▶ [Local State (localStorage — 진행도 등, 필요 시)]

※ 백엔드 서버 없음 — 클라이언트 단독 실행.
```

## 3. 레이어 구조

```
src/
├── ui/             # React 컴포넌트 (타이틀, HUD, 재시작/클리어 화면)
├── shadow/         # ShadowCaster(자연 각도·그림자 끝점 계산) + ContainmentJudge(각도 허용치 판정) — shadow-physics 도메인
├── physics/        # character.ts(축 분리 이동) + collider.ts(타일 그리드 벽 충돌판정)
├── procgen/        # stageGenerator.ts — 시드 기반 통로 carve, 스폰·골·광원 위치 생성
├── ai/             # 이동 패턴 학습 및 동선 차단 알고리즘
├── assets/         # 이미지/사운드/폰트
└── core/           # 게임 루프, 입력 처리, 라운드 상태(1R~3R) 관리, 공통 유틸
```

## 4. 데이터 흐름

```
[앱 시작] → generateStage(seed) → Stage { lightSources, grid, spawn, goal } (procgen, 1회 생성)
         → createGridCollider(grid, radius) (physics, 1회 생성)

매 프레임:
[WASD 입력] → [moveCharacter: 벽 충돌(canOccupy) 반영, 축 분리 이동(physics)] ─┐
                                                                              │
[,/. 입력] → [그림자 각도 갱신(shadow, 독립 상태)] ───────────────────────────┤
                                                                              ▼
                              [ShadowCaster: 안전 구역 자연 각도 재계산(shadow)]
                                                                              │
                                                                              ▼
                              [ContainmentJudge: |그림자각 - 자연각| ≤ 허용치? (shadow)]
                                                                              │
                                            이탈 → 즉사·리셋(캐릭터+그림자각 모두 스폰값으로) / 정렬 → 계속
                                                                              │
                                                                              ▼
                              [골 도달 판정: 거리(캐릭터, goal) ≤ 임계값? → 클리어]
                                                                              │
                                                                              ▼
                                            [drawStage + Canvas 렌더링(ui) → 화면 출력]
        │
        ▼
[동선 기록 → 패턴 학습(ai)] → [다음 스테이지 절차 생성 시 학습 결과 반영(procgen)]
```

## 5. 주요 설계 결정

| 결정 | 선택 | 이유 | ADR |
|------|------|------|-----|
| 실행 환경 | 브라우저 클라이언트 단독 | 설치 없이 심사자가 즉시 플레이 가능해야 함 | - |
| 배포 | GitHub Pages | 대회 권장 방식, 무료, 링크 공유만으로 심사 가능 | - |
| 백엔드 | 불필요 | 인프라·일정 복잡도 최소화 (ARD 2번 조직적 제약) | - |
| UI/렌더링 | React + HTML5 Canvas | UI는 React 선언적 관리, 그림자 물리는 Canvas 직접 제어로 60 FPS 확보 | - |
| 그림자 판정 방식 | 각도 허용치 비교 (자연 각도 ± 허용치) | 그림자가 캐릭터에 부착된 독립 회전 상태이고 안전 구역도 캐릭터에 부착되므로, 레벨 고정 폴리곤 포함 판정(ADR-001)이 아니라 두 각도를 비교하는 방식이 실제 게임 구조와 일치. readback 없는 단순 연산이라 성능 부담도 없음 | [`ADR-002`](adr/ADR-002-shadow-dual-control.md) (ADR-001 대체) |
| AI 학습 위치 | 클라이언트(JS) 측 전량 수행 | 서버 비용 최소화, 대회 규정상 서버 기능(랭킹 등) 배제와도 일치 | - |
| 지형 표현·통로 생성 | 타일 그리드 + 시드 기반 random-walk carve | 충돌판정이 O(1) 셀 조회로 단순·예측 가능, 시드로 재현·디버깅 용이. 정교한 던전 생성기는 18일 일정에 과함 | [`ADR-003`](adr/ADR-003-procgen-corridor-collision.md) |
| 벽-캐릭터 충돌 | 판정자(predicate) 주입 + 축 분리(X→Y) 이동 | `physics`가 그리드 표현에 결합되지 않아 테스트·표현 교체에 유연. 축 분리로 벽을 따라 자연스럽게 미끄러짐 | [`ADR-003`](adr/ADR-003-procgen-corridor-collision.md) |

## 6. 비기능 요건 달성 전략

- **접근성**: 정적 파일만으로 구성해 GitHub Pages에 바로 배포, 별도 빌드 서버 불필요
- **성능**: 그림자 각도 계산·허용치 판정을 Canvas에서 직접 처리해 React 리렌더링 오버헤드 회피, readback 없는 단순 연산으로 60 FPS 목표
- **정확성**: 각도 차이를 (-π,π]로 정규화해 원 경계(0도/360도) 근처에서도 정확히 비교하고, 이 경계 케이스를 테스트로 고정
- **이식성**: Chrome/Edge 기준으로 개발하고 표준 웹 API 위주로 사용, 브라우저별 실험적 기능 지양
- **유지보수성**: `shadow/physics/procgen/ai` 도메인 분리로 48시간 본행사에서도 구조 재사용 가능하도록 설계

## 7. 보안 고려사항

- 결제/개인정보를 다루지 않는 게임이므로 인증·암호화 요건 없음 (변경 시 재검토)
- 외부 에셋 사용 시 출처·라이선스를 코드 저장소 및 AI활용기술문서에 함께 기록
- 저장소는 공개(public) 제출 권장 — 민감정보(API 키 등)가 커밋되지 않도록 `.gitignore` 유지

## 8. 배포 구성

- **호스팅**: GitHub Pages (저장소 `https://github.com/BaeYoungHwan/NAN2026`)
- **빌드**: 정적 빌드 산출물을 Pages 브랜치 또는 `docs/`(GitHub Pages 설정에 맞춰) 경로로 배포
- **비공개 시**: 심사 계정(dl_gameai_reviewer@nhn.com)을 저장소 협업자로 초대
