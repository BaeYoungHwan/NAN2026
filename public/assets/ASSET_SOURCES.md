# 외부 에셋 출처 기록

> 이미지 등 외부 에셋을 추가할 때마다 여기 한 줄씩 남긴다 (CLAUDE.md 규칙 — 출처·라이선스 확인 및 고지 필수).
> AI 활용 기술 문서(P2 제출물)에도 이 목록을 반영한다.

| 파일 경로 | 내용 | 생성 방법 / 출처 | 라이선스·사용 조건 | 추가일 |
|-----------|------|------------------|---------------------|--------|
| `scripts/게임캐릭터.png` | 주인공 "그림자씨" 캐릭터 디자인 시트 원본 (턴어라운드·표정 6종·동작 5종·죽음 모션 4단계·팔레트) — `public/`이 아니라 `scripts/`에 둔다: `crop-regions.mjs` 1회성 스크립트에서만 참조되고 런타임 게임 코드는 잘라낸 개별 PNG만 로드하므로, `public/`에 두면 Vite 빌드 시 dist에 그대로 복사되어 배포 용량만 늘어난다(PR #9 리뷰 반영, 원래 `public/assets/characters/`에 있었음) | ChatGPT(DALL·E) 이미지 생성 기능으로 직접 생성 | OpenAI 이용약관상 생성자(사용자) 소유 — 상업적 이용 관련 최신 약관은 제출 전 재확인 권장 | 2026-07-24 |
| `characters/body-idle-pose.png`, `body-run-torso.png`, `body-run-legs.png`, `body-flinch.png`, `body-danger.png`, `face-normal.png`, `face-surprised.png`, `face-scared.png`, `face-annoyed.png`, `face-disappointed.png`, `face-delighted.png`, `death1~4.png` | 위 원본 시트에서 `scripts/crop-regions.mjs`로 잘라낸 파생 스프라이트 중 실제 코드에서 쓰는 15장 (배경은 코너 플러드필로 투명 처리) — `body-run-torso`/`body-run-legs`는 걷기 애니메이션을 상체(고정)·다리(좌우반전) 레이어로 분리 렌더링하기 위한 컷아웃. (`body-idle.png`, `body-walk.png`, `body-run.png`, `body-death-pose.png`는 같은 스크립트로 뽑았지만 최종 렌더링에 쓰이지 않아 커밋에서 제외함 — 좌표는 `scripts/crop-regions.mjs`에 남아있어 필요하면 재생성 가능) | 위 원본과 동일 | 위 원본과 동일 | 2026-07-24 |
