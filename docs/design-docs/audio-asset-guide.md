# 오디오 에셋 가이드 — 「돌려돌려 그림자」

> 작성: 2026-08-04
> 관련 코드: `src/audio/`, `scripts/generate-audio.mjs`
> 라이선스 기록: [`public/assets/ASSET_SOURCES.md`](../../public/assets/ASSET_SOURCES.md)

## 요약

사운드는 **전량 자체 합성**이다. 외부 음원을 받아오지 않았다. 이 프로젝트는 파일별 출처·라이선스를 기재하고 그 목록을 AI활용기술문서(제출물)에 반영하는데, 받아온 파일의 약관을 검증했다고 쓸 수 없으므로 라이선스를 팀 소유로 확정했다.

포맷은 **WAV**다. 개발 환경에 ffmpeg가 없어 mp3 인코딩이 불가능하고, npm 인코더 추가는 기술 스택 고정 규칙에 걸린다. 브라우저 `decodeAudioData`는 WAV를 완전히 지원하므로 재생에 차이가 없다(22050Hz 모노, 효과음 1초 ≈ 44KB, 전체 4.5MB).

## 재생성

```bash
node scripts/generate-audio.mjs            # 20개 전부
node scripts/generate-audio.mjs death       # 이름에 death가 들어간 큐만 (레시피 조정 반복용)
node scripts/generate-audio.mjs bgm         # bgm 5개만
```

## 큐 목록

### 효과음 — `public/assets/audio/sfx/`

| 파일 | 트리거 | 길이 | 런타임 음량 | 쿨다운 |
|---|---|---|---|---|
| `danger-beep.wav` | 위험도(margin) 0.6 이상. **간격·음량을 위험도에 비례해 코드가 조절** | 0.08초 | 0.5 | 없음(간격을 직접 계산) |
| `safe-return.wav` | 위험 구간에서 안전으로 복귀한 순간 | 0.34초 | 0.45 | 400ms |
| `rotate-loop.wav` | `,`/`.`를 누르는 동안 (**루프**) | 0.80초 | 0.3 | — |
| `light-switch.wav` | 최근접 가로등이 바뀌어 1.2초 무적 유예 발동 | 0.35초 | 0.5 | 300ms |
| `death.wav` | 정렬 이탈로 사망 | 1.50초 | 0.8 | 300ms |
| `respawn.wav` | 사망 시퀀스(1.6초) 종료 후 리스폰 | 0.50초 | 0.5 | 300ms |
| `checkpoint.wav` | 세이브 포인트를 직접 밟아 활성화 | 0.79초 | 0.6 | 200ms |
| `round-up.wav` | 1R→2R, 2R→3R 승급 | 1.47초 | 0.7 | 500ms |
| `clear.wav` | 3R 골 도달, 전체 클리어 | 2.72초 | 0.8 | 500ms |
| `footstep.wav` | 이동 중, 걷기 애니메이션 주기(160ms)마다 | 0.12초 | 0.22 | 120ms + 피치 ±8% |
| `wall-bump.wav` | 벽에 막혀 이동 실패 | 0.10초 | 0.15 | 260ms + 피치 ±10% |
| `dialogue-open.wav` | 저승사자 대사가 새로 표시됨 | 0.15초 | 0.4 | 80ms |
| `dialogue-advance.wav` | 대사를 **직접** 넘김(자동 사라짐은 제외) | 0.10초 | 0.3 | 80ms |
| `cutscene-advance.wav` | 오프닝·엔딩 슬라이드 넘김 | 0.25초 | 0.35 | 80ms |
| `ui-click.wav` | 재시작 버튼 | 0.06초 | 0.35 | 80ms |

### 배경음 — `public/assets/audio/bgm/`

| 파일 | 재생 시점 | 길이 | 음량 | 루프 |
|---|---|---|---|---|
| `round1.wav` | 1R | 16초 | 0.45 | ○ |
| `round2.wav` | 2R | 16초 | 0.45 | ○ |
| `round3.wav` | 3R | 16초 | 0.5 | ○ |
| `opening.wav` | 오프닝 컷신 | 24초 | 0.5 | ✕ |
| `ending.wav` | 엔딩 컷신 | 24초 | 0.5 | ✕ |

BGM 3곡은 같은 근음(D2)·악기 구성에서 레이어만 더해 파생시킨다 — 라운드 전환 시 크로스페이드해도 음색이 튀지 않는다. 1R은 드론 2겹, 2R은 단3도(F3) 추가, 3R은 반음 불협(Eb3)과 1Hz 저역 펄스를 더해 압박감을 키운다.

## 설계상 지켜야 할 제약

**심리스 루프** — `rotate-loop`과 BGM 3곡은 끝에서 처음으로 이어질 때 파형이 연속돼야 한다. `seamlessLoop()`이 버퍼 끝을 잘라 시작에 크로스페이드하고, LFO·펄스 주기는 파일 길이의 정수 약수로 잡는다. 이 조건이 깨지면 루프 한 바퀴마다 딸깍거린다(실제로 `round3`의 저역 펄스가 16초에 587.36주기여서 이음매 점프가 다른 BGM의 30배였고, 반송파를 36.71→36.75Hz로 미세 조정해 해결했다).

**루프 큐는 끝단 페이드 금지** — `scripts/generate-audio.mjs`의 `LOOPING_CUES`와 `src/audio/soundCues.ts`의 `loop` 설정은 반드시 일치해야 한다. 루프 큐에 종료 페이드아웃이 걸리면 한 바퀴마다 음량이 꺼졌다 켜진다.

**danger-beep은 잔향 금지** — 위험도가 높아지면 재생 간격이 120ms까지 좁아진다. 꼬리가 남으면 소리가 뭉쳐 위험도를 읽을 수 없게 된다.

**음량 밸런스는 파일이 아니라 코드에서** — 생성된 파일은 전부 피크 정규화되어 있고, 실제 밸런스는 `src/audio/soundCues.ts`의 `volume`으로 잡는다. 파일을 교체해도 밸런스가 유지되게 하기 위함이다.

## 나중에 실제 음원으로 교체하려면

로더는 확장자를 모른다. `src/audio/soundCues.ts`의 `file` 값만 바꾸면 된다:

```ts
death: { file: "sfx/death.mp3", volume: 0.8, minIntervalMs: 300 },
```

교체 시 확인할 것:
1. 루프 큐(`rotate-loop`, `bgm/round1~3`)는 이음매가 연속되는 파일이어야 한다.
2. `danger-beep`은 0.12초보다 짧고 잔향이 없어야 한다.
3. 새 파일의 출처·라이선스를 `public/assets/ASSET_SOURCES.md`에 반드시 추가한다(CLAUDE.md 규칙).
4. 파일이 없거나 손상돼도 게임은 무음으로 정상 동작한다 — 교체 도중 깨진 상태로 배포돼도 게임이 멈추지는 않는다.

## 조작

`M` 키로 음소거를 토글한다(대사·컷신 표시 중에도 동작). 설정은 `localStorage`에 저장되어 새로고침 후에도 유지된다. HUD에 현재 상태가 표시된다.

`event.key`가 아니라 `event.code`로 판정하므로 한글 입력 상태에서도 동작한다.
