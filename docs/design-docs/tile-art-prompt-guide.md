# 스테이지 바닥/벽 타일셋 — 외부 AI 생성 프롬프트 가이드

> GPT / 마누스 / 제미나이 등 외부 이미지 생성 AI에게 Shadow-Step 통로의 **바닥 타일 1장 + 벽 타일 1장**을 만들어달라고 할 때 쓰는 프롬프트 템플릿. [`background-art-prompt-guide.md`](background-art-prompt-guide.md)가 다루는 정적 배경(가로등 거리 분위기)과 달리, 이 문서는 절차적으로 매번 다르게 생성되는 통로 그리드(`stageGenerator.ts`) 위에 실제로 **타일링해서 반복 배치할 텍스처**를 다룬다.

## 왜 "통짜 맵 이미지"가 아니라 타일셋인가

스테이지는 시드 기반 random-walk carve로 매 실행마다 통로 모양이 달라진다(`src/procgen/stageGenerator.ts`, 20×15 셀 그리드 @ 40px, 캔버스 800×600 고정 — `TILE_SIZE=40`, `GRID_COLS=20`, `GRID_ROWS=15`). AI에게 "전체 맵 레이아웃"을 한 장으로 그려달라고 하면 그 통로 모양이 실제 절차적 결과와 절대 일치하지 않는다. 대신 **바닥 셀 하나, 벽 셀 하나**에 쓸 반복 가능한 텍스처만 뽑아서, 렌더러가 그리드의 각 셀 좌표에 맞춰 이 텍스처를 찍어 그리는 방식으로 가야 한다.

현재 `GameCanvas.tsx`에는 벽/바닥을 시각적으로 그리는 코드가 없다(충돌 판정용 논리 그리드만 존재) — 이 프롬프트로 얻는 이미지가 그 시각 레이어를 처음 채우게 된다.

> **2026-07-29 수정**: 벽 타일이 평평한 색칠 라인처럼 보여 입체감이 없었다. 실제 스테이지 구조(`stageGenerator.ts`의 `CORRIDOR_WIDTH=2` 고정 폭 외길, 분기 없음)에 맞춰 "좁은 외길"이라는 전제는 유지하되, 벽에 높이감(베벨+AO)을 추가해 평면 블루프린트처럼 보이지 않도록 다시 짰다. `background-art-prompt-guide.md`와 "공통 스타일 앵커" 문구를 공유한다.
>
> **2026-08-03 수정**: `background-art-prompt-guide.md` 쪽에서 실제 맵이 (`PATH_STEPS` 40→80 튜닝 이후) 매끈한 외길이 아니라 미로처럼 밀집된 형태로 나온다는 게 확인됐다. 이 문서의 바닥/벽 프롬프트는 40×40 단위로 방향 무관하게 반복 배치되는 seamless 텍스처라 전체 맵 형태(미로 밀도)와 무관하게 그대로 유효하다 — 통로 폭이 "항상 균일하다"는 전제만 지키면 되므로 이번 수정 대상에서 제외한다.

## 공통 스타일 앵커 (배경·타일 프롬프트 공유)

`background-art-prompt-guide.md`와 같은 화면에 겹쳐지므로, 바닥/벽 타일 프롬프트 맨 앞에 항상 이 문구를 공통으로 붙인다.

```
Shared visual identity: flat 2D game art, muted low-saturation palette (cream/off-white,
beige/tan, dark gray, black; purple only as faint ambient tint; red only as rare hazard
accent), no painterly brush texture, no photo-realism, no strong baked-in directional
shadow (the game engine renders its own dynamic shadow/lighting on top of this layer).
```

## 세계관 / 팔레트 (배경 가이드와 동일하게 유지)

- 세계관: 저승-이승 경계의 인적 없는 거리, 가로등이 드문드문 켜진 인도 (`background-art-prompt-guide.md` 참고)
- 컬러 팔레트(고정): 크림/오프화이트, 베이지, 다크 그레이, 블랙 기본 + 보라(안전구역 UI 전용, 텍스처에는 은은한 틴트만) + 레드(위험 신호 포인트, 지배적 사용 금지)
- 바닥과 벽은 배경 이미지와 같은 무채색·저채도 톤 계열이어야 하며, 서로는 명도 차이로 뚜렷이 구분되어야 한다(플레이어가 통로/벽을 즉시 구분해야 하는 게임플레이 요구사항)

## 기술 제약

- **타일 단위**: 그리드 셀 1칸 = 40×40px. 다만 AI 생성 해상도를 그대로 40px로 요청하면 디테일이 뭉개지므로, **512×512 또는 1024×1024 정사각형**으로 생성 후 코드에서 40px로 다운스케일 + 반복 렌더링한다.
- **완전 타일링(seamless)**: 한 장의 텍스처를 그리드 전체에 반복 배치하므로, 이미지의 상하좌우 경계가 이어붙였을 때 이음매가 보이면 안 된다 — "seamless tileable texture" 요구가 핵심.
- **방향 무관**: 통로가 어느 방향으로 꺾이든 렌더러는 같은 벽 텍스처를 반복 배치할 가능성이 높다(코드에 아직 코너/직선 벽을 구분하는 로직이 없음) — 벽 텍스처는 특정 방향성(예: 한쪽에만 그림자 지는 디자인)이 없는 대칭적 디자인으로 요청해야 자연스럽게 반복된다.
- **평면 조명**: 텍스처 자체에 강한 방향성 그림자나 하이라이트를 넣지 않는다 — 그림자/광원은 게임 엔진이 별도 레이어로 그 위에 실시간으로 그린다(배경 가이드와 동일 원칙).
- **가독성 우선**: 바닥 타일은 저대비·저채도로 차분하게, 벽 타일은 바닥보다 확실히 어둡거나 밝아 경계가 한눈에 보이되 캐릭터·그림자·보라색 안전구역 경계선과 색상 충돌이 없어야 한다.

## 범위 (이번 라운드)

**바닥 타일 1종 + 벽 타일 1종**만 다룬다. 코너/교차로 전용 타일, 라운드별(1R/2R/3R) 별도 타일 변형은 이번 프롬프트에 포함하지 않는다 — 구조 텍스처는 라운드 전체에서 동일하게 쓰고, 라운드별 분위기 차이는 이미 배경 이미지(밝기·틴트)와 광원 개수 로직으로 표현되므로 타일 자체를 라운드마다 새로 뽑을 필요는 없다.

## 공통 베이스 프롬프트 — 바닥 타일

```
[공통 스타일 앵커]
Seamless tileable top-down texture for a 2D game floor tile, square image, orthographic
(no perspective, no vanishing point), flat even lighting with no directional shadows or
highlights baked in, no vignette.
Setting: worn outdoor pavement/sidewalk from a quiet liminal street between the afterlife
and the world of the living — plain concrete or stone slab texture, faint cracks, subtle
weathering, very slight noise/grain.
Color palette (strict): cream / off-white and beige/tan tones, muted and low-contrast, no
strong saturated colors, only a faint cool ambient tint allowed.
The texture must tile perfectly edge-to-edge with no visible seams when repeated in a grid.
The image must fill the entire frame edge-to-edge with texture — no border, no vignette,
no rounded corners, no drop shadow around the tile itself (this will be cropped and
repeated by code, any framing artifact will repeat as a visible seam).
No characters, no props, no text, no logos, no watermark.
```

## 공통 베이스 프롬프트 — 벽 타일

```
[공통 스타일 앵커]
Seamless tileable top-down texture for a 2D game wall tile, square image, orthographic
(no perspective, no vanishing point), flat even lighting with no directional shadows or
highlights baked in, no vignette.
Setting: a raised stone curb/ledge bordering a narrow single-width alley (the player's
corridor is always exactly this width — never wider). To give the wall a sense of height
and volume instead of reading as a flat painted line: add a subtle beveled top edge (a thin
lighter strip along the rim, as if the top face catches faint ambient light) and a soft
ambient-occlusion darkening where the base meets the floor. Keep this shading symmetric and
non-directional — equal on all sides — since the tile is reused at any rotation; it must not
read as a single light source.
Color palette (strict): dark gray to near-black tones, clearly darker in value than the
cream/beige floor tile for instant visual contrast, only a faint ambient purple tint allowed
(no dominant purple, no saturated colors), no red.
The texture must tile perfectly edge-to-edge with no visible seams when repeated in a grid,
and must look visually correct regardless of rotation (no baked-in single light direction).
The image must fill the entire frame edge-to-edge with texture — no border, no vignette,
no rounded corners.
No characters, no props, no text, no logos, no watermark.
```

## 도구별 보정 노트

- **GPT (이미지 생성)**: "seamless tileable texture" 요청을 명시적으로 이해하므로 위 프롬프트 그대로 사용 가능. 결과물에 은근한 이음매가 남는 경우 `tile this texture 2x2 and show me the seams are invisible` 식으로 재확인 요청 가능.
- **제미나이 (Imagen)**: 타일링 품질이 도구마다 편차가 큼 — 생성 후 반드시 코드/이미지 편집 툴에서 2×2 이상 이어붙여 이음매를 눈으로 확인. 정사각형(1:1) 프리셋 사용.
- **마누스**: 범용 텍스트 프롬프트 기반 — 공통 프롬프트 그대로 사용하되, 결과물이 정사각형이 아니면 중앙 크롭 후 정사각형으로 맞춰야 반복 배치 시 왜곡이 없다.

## 네거티브 프롬프트 (지원하는 도구에서 사용)

```
no text, no logos, no watermark, no people, no characters, no props, no UI,
no perspective, no vanishing point, no vignette, no strong directional shadow,
no single light source baked in, no photo-realism, no busy or high-contrast pattern,
no saturated colors, no visible seams, not a single centered object (must read as
a repeatable material, not a scene), no flat blueprint/schematic/map-diagram look,
no border, no frame, no rounded corners
```

## 라이선스 체크리스트 (제출 전 필수 — 아직 미확인)

- [ ] 사용한 도구(GPT/마누스/제미나이)의 생성 이미지 소유권·상업적 사용 허용 여부 확인
- [ ] 하케톤 규정상 AI 생성 에셋 사용 허용 여부, 출처 명시 의무 확인
- [ ] 최종 채택 도구 확정 후 사용한 프롬프트를 AI 활용 기술 문서(제출물 5종 중 하나)에 기록

## 완료 기준

- 바닥/벽 각 2~3장 후보 생성 → 2×2 이상 반복 배치했을 때 이음매가 안 보이는지 우선 확인
- 실제 캔버스(40px 셀)로 축소했을 때도 바닥/벽 구분이 명확한지 확인
- 배경 이미지 위에 겹쳐 캐릭터·그림자·보라색 안전구역 경계선과 대비가 유지되는지 확인
- 라이선스 체크리스트 전항목 확인 완료

## 다음 단계

1. 사용자가 직접 GPT/마누스/제미나이에 프롬프트 입력 → 바닥/벽 타일 이미지 확보
2. 2×2 반복 배치로 이음매 확인 후 최종 후보 선정
3. 라이선스 확인 후 최종 채택, AI 활용 기술 문서에 프롬프트 기록
4. (후속 작업, 이번 세션 범위 아님) 실제 코드 연동은 이미지가 최종 확정된 뒤 별도로 진행 — `GameCanvas.tsx`에 그리드 셀별 타일 반복 렌더링 로직 추가
