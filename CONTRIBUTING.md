# 기여 가이드

## 브랜치 전략
- `main`: 배포 브랜치 (직접 푸시 금지 — `develop`에서 PR로만 병합)
- `develop`: 통합 브랜치 (feature 브랜치들이 먼저 모이는 곳)
- `feature/<작업명>`: 작업 브랜치

## 작업 흐름
1. `git checkout -b feature/<작업명> develop`
2. 작업 후 커밋 (`/commit` 스킬 사용)
3. `develop`으로 PR 생성 (`/PR` 스킬 사용)
4. 코드 리뷰 1인 이상 후 `develop`에 머지
5. `develop`이 안정되면 배영환이 `develop` → `main` PR을 생성·머지 (배포 시점 결정)

## 커밋 컨벤션
`.claude/commands/commit.md` 참조
