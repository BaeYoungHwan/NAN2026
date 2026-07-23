# 설계 문서 목차

이 프로젝트의 핵심 설계 원칙과 아키텍처 문서입니다.

---

## 문서 목록

| 문서 | 설명 |
|------|------|
| [`core-beliefs.md`](core-beliefs.md) | 에이전트 우선 운영 원칙 |
| [`golden-principles.md`](golden-principles.md) | 코드베이스 일관성 황금 원칙 |
| [`architecture-layers.md`](architecture-layers.md) | 레이어 구조 및 허용/금지 의존성 |
| [`ARD-v1.md`](ARD-v1.md) | 아키텍처 요건 명세 (품질 속성/제약) |
| [`architecture-v1.md`](architecture-v1.md) | NAN2026 게임 아키텍처 초안 |
| [`shadow-mechanic-diagram.md`](shadow-mechanic-diagram.md) | Shadow-Step 핵심 메커니즘 개념도 (팀 공유용) |

---

## ADR (Architecture Decision Records)

설계 결정 기록은 `docs/design-docs/adr/`에 저장합니다.

형식: [`docs/ref/ADR-template.md`](../ref/ADR-template.md)

---

## 갱신 정책

- 아키텍처 결정 변경 시 반드시 ADR 작성
- `doc-gardener` 에이전트가 코드와 불일치하는 문서를 감지해서 `docs/exec-plans/tech-debt-tracker.md`에 기록
