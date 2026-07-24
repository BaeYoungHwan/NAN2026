# 스테이지 배경 이미지 — 외부 AI 생성 프롬프트 가이드

> GPT / 마누스 / 제미나이 등 외부 이미지 생성 AI에게 Shadow-Step 스테이지 배경을 만들어달라고 할 때 쓰는 프롬프트 템플릿. PRD §7의 "지형/광원 렌더링은 아트 미정, 로직과 분리" 항목에 대응하는 산출물이다.

## 배경

스테이지 지형·통로·광원 배치는 이미 코드로 구현되어 있다(`src/procgen/stageGenerator.ts`, 시드 기반 random-walk carve, 20×15 타일 그리드 @ 40px, 캔버스 800×600 고정). 이 문서에서 다루는 건 그 위에 깔릴 **정적 배경 이미지**뿐이다.

## 세계관 / 톤 근거

- PRD §7-2: 저승사자의 실수(동명이인 착오)로 주인공이 저승에 끌려옴 → 이승 복귀 중 그림자가 불안정해져 몸과 그림자를 따로 붙잡아야 함
- 캐릭터 콘셉트("그림자씨"): 몸은 흰 천 인형, "임시직" ID표 착용 → **저승 오피스/백룸즈(liminal office)** 세계관
- 저승사자 NPC("저승청 실수 담당 계약직"): 인사고과·실적에 집착하는 소심한 공무원 — 관료제 저승 설정을 뒷받침
- 인게임 목업(캐릭터 시트 첨부): 어두운 타일 바닥, 캐릭터를 비추는 단일 스포트라이트, 보라색 안전 경계선

배경도 이 세계관을 시각적으로 드러내야 한다 — 캐릭터 설정과 무관한 추상적 던전이 아니라, 관료적 저승 사무 공간이 기이하게 왜곡된 느낌.

## 컬러 팔레트 (고정)

캐릭터 시트 기준 6색: 크림/오프화이트, 베이지, 다크 그레이, 블랙, **보라(포인트)**, **레드(포인트)**.

- 보라는 게임 UI(안전구역 경계선)에 이미 쓰이므로 배경에서는 은은한 조명 틴트 정도로만 사용
- 레드는 위험 신호용 포인트로만, 지배적으로 쓰지 않음

## 기술 제약

- 캔버스 800×600 고정 (4:3 비율) — `CANVAS_WIDTH`/`CANVAS_HEIGHT`가 유일 소스
- 광원 Y좌표 고정(`LIGHT_Y=30`, 화면 상단 근처) — 빛이 위에서 내려오는 구도와 시각적으로 어울림
- 타일/벽/캐릭터/그림자는 배경과 별도 레이어로 그 위에 렌더링됨 — 배경이 이들과 색상 대비를 해치면 안 됨
- 벽 아트 스타일 자체는 아직 미정 — 배경은 특정 팔레트에 종속되지 않는 무채색·저채도 톤으로 설계해 추후 벽 디자인과 맞출 여지를 남김

## 범위 (현재 라운드)

**순수 환경만.** 저승청 NPC 관련 소품(실적 현황판, 사망 처리 도장 등)이나 오프닝/엔딩 컷신 이미지는 이번 프롬프트에 포함하지 않는다 — 배경이 먼저 확정되면 후속 작업으로 요소를 하나씩 추가한다.

## 공통 베이스 프롬프트 (세 도구 공통)

```
2D top-down game background art, no characters, no UI elements, no text, no watermark, no logos.
Setting: a liminal afterlife bureaucratic office space — the "backrooms" of the underworld's
administrative department. Empty office corridors, waiting areas, or storage-room-like spaces
that feel slightly wrong: institutional tile or worn linoleum floor, water-stained ceiling tiles.
Keep this pass PURE ENVIRONMENT ONLY — no furniture, no props, no signage, no clutter of any kind.
Only floor texture, wall/corridor structure, and lighting. (Office props like filing cabinets,
bulletin boards, or stamps will be layered in as a separate later pass — do not add them yet.)
Mood: quiet dread, empty, bureaucratic unease — a single fixed light source from directly above
(like one working fluorescent panel or spotlight in an otherwise dim space), long soft falloff
into darkness at the edges.
Color palette (strict): cream / off-white, beige/tan, dark gray, black as the dominant tones;
use purple only as a faint ambient light tint (not a dominant color — purple is reserved for the
game's safety-boundary UI line), and a small amount of muted red only as a rare hazard accent
(e.g. a worn exit sign glow), never dominant.
Composition: flat, evenly lit floor texture with subtle noise/grain, no strong directional shadows
of its own (the game engine draws its own dynamic character shadow on top), keep the middle 70%
of the frame visually calm and low-contrast so gameplay elements stay readable.
Aspect ratio: 4:3 (closest supported option), high resolution, single static image (not a
repeating tile pattern).
```

## 라운드별 변형 문구

베이스 프롬프트에 아래 문장을 이어붙인다.

| 라운드 | 추가 문구 | 의도 |
|--------|-----------|------|
| 1R (가이드라인 표시) | `a slightly more open waiting-room area, calmer, faint warm ambient light, introductory tone` | 입문 라운드 — 상대적으로 안정적인 톤 |
| 2R (가이드라인 제거) | `a tighter corridor or cubicle-maze layout, dimmer, mild unease, fewer working lights` | 난이도 상승 — 답답함 |
| 3R (디메리트 적용) | `a cramped storage-room or dead-end corridor, noticeably darker, oppressive, most lights broken or flickering-implied, higher tension` | 최고 난이도 — 압박감 |

## 도구별 보정 노트

- **GPT (이미지 생성)**: aspect ratio를 `4:3` 또는 `1024x768`에 가장 가까운 프리셋으로 직접 지정 가능. 미지원 시 프롬프트에 `16:9 wide landscape composition, will be center-cropped to 4:3` 추가해 크롭 손실 최소화
- **제미나이 (Imagen)**: aspect ratio 옵션이 제한적(1:1, 16:9, 9:16 등)일 수 있음. 4:3 미지원 시 16:9로 생성 후 좌우 크롭 전제로 `keep the visually important content within the center 4:3 region` 추가
- **마누스**: 범용 텍스트 프롬프트 기반 — 공통 프롬프트 그대로 사용하되, 결과물의 실제 픽셀 해상도를 확인 후 800×600으로 리사이즈 필요

## 네거티브 프롬프트 (지원하는 도구에서 사용)

```
no text, no logos, no watermark, no people, no characters, no UI, no strong colors,
no busy patterns, no vignette, no directional shadows, no photo-realism,
no yellow monochrome "classic backrooms" color scheme, no bright saturated purple,
no furniture, no props, no signage, no clutter (environment/lighting only for this pass)
```

## 라이선스 체크리스트 (제출 전 필수 — 아직 미확인)

- [ ] 사용한 각 도구(GPT/마누스/제미나이)의 생성 이미지에 대한 **소유권·상업적 사용 허용 여부** 약관 확인
- [ ] 하케톤 규정상 AI 생성 에셋 사용이 허용되는지, 출처 명시 의무가 있는지 확인
- [ ] 최종 채택 도구 1곳으로 확정 후, 해당 이미지 생성 시 사용한 프롬프트를 AI 활용 기술 문서(제출물 5종 중 하나)에 기록

## 완료 기준

- 각 라운드(1R/2R/3R)당 후보 이미지 2~3장 생성 → 실제 캔버스(800×600) 위에 타일/벽/캐릭터/그림자를 겹쳐 렌더링한 상태로 가독성 확인 후 1장씩 최종 선정
- 선정 기준: 안전구역 부채꼴, 그림자, 캐릭터가 배경과 명확히 구분되는지 최우선
- 라이선스 체크리스트 전항목 확인 완료

## 다음 단계

1. 사용자가 직접 GPT/마누스/제미나이에 프롬프트 입력 → 결과 이미지 확보
2. 개발 서버에서 배경 이미지를 임시로 캔버스에 깔아 가독성 테스트
3. 라이선스 확인 후 최종 채택, AI 활용 기술 문서에 프롬프트 기록
4. (후속 작업) 저승청 NPC 소품 요소 추가, 오프닝/엔딩 컷신 이미지 프롬프트 별도 설계
