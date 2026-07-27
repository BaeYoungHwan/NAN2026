export type BodyPose = "idle" | "walk" | "flinch" | "danger" | "death1" | "death2" | "death3" | "death4";
export type ShadowExpression = "normal" | "surprised" | "scared" | "annoyed" | "disappointed" | "delighted";

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/characters/`;

// walk 애니메이션 시행착오 기록:
// 1) 다리 하나만 회전 — 한쪽 다리로만 계속 뛰는 것처럼 보임(실패)
// 2) 몸 전체를 좌우반전해 다리 위치를 흉내 — 반전은 얼굴 방향까지 뒤집어서
//    실패, 그리고 애초에 얼굴 방향은 이동 방향에 따라서만 바뀌어야 함
// 3) "이동"(body-walk.png)·"달리기"(body-run.png) 두 정지 그림을 프레임처럼
//    번갈아 그림 — 두 그림이 원래 서로 반대 방향(왼쪽/오른쪽)을 본 채로
//    그려져 있어서, 방향을 맞춰도(반전 통일) 결국 "같은 쪽 다리만 계속
//    앞으로 나오는" 그림이라 제자리에서 한 발로 뛰는 것처럼 보였다(실패).
// 4) (현재) 상체(코트+머리, 얼굴 방향 고정)와 다리(컷아웃)를 분리해서, 다리
//    레이어만 매 프레임 좌우 반전한다. 다리는 좌/우가 대략 대칭이라
//    반전해도 자연스러운 "반대쪽 다리가 앞으로 나온" 포즈로 읽히는 반면,
//    상체는 한 번도 반전되지 않아 얼굴·몸통 방향이 걷는 내내 흔들리지
//    않는다 — 진짜 좌우 교대 스텝 + 고정된 얼굴 방향을 동시에 만족한다.
//    (facingRight에 의한 전체 반전은 여전히 이동 방향에 따라 적용된다.)
const BODY_SPRITE_FILES: Record<Exclude<BodyPose, "walk">, string> = {
  idle: "body-idle-pose.png",
  flinch: "body-flinch.png",
  danger: "body-danger.png",
  death1: "death1.png",
  death2: "death2.png",
  death3: "death3.png",
  death4: "death4.png",
};

const WALK_TORSO_FILE = "body-run-torso.png"; // 코트+머리 — 걷는 동안 절대 반전하지 않는 고정 상체
const WALK_LEGS_FILE = "body-run-legs.png"; // 다리 컷아웃 — 이 레이어만 프레임마다 반전해 좌/우 스텝 교대

// crop-regions.mjs가 원본 시트에서 잘라낸 좌표: body-run-torso(x=760,y=413,w=143,h=142),
// body-run-legs(x=780,y=543,w=123,h=70). 두 크롭이 같은 시트 좌표계에서 나왔으므로
// 이 차이가 곧 합성 시 다리 레이어의 상대 오프셋이다(다리가 상체보다 20px 오른쪽,
// 130px 아래에서 시작).
export const WALK_LEGS_OFFSET_X_PX = 780 - 760;
export const WALK_LEGS_OFFSET_Y_PX = 543 - 413;

// body-run.png(분리 전 전체 그림, x=760~903)에서 실측한 목/넥타이 무게중심 x —
// torso 크롭이 같은 x=760,w=143 기준이라 그대로 재사용한다. 200은 그 실측 기준이 된
// body-run.png의 원본 높이(px) — torso/legs를 같은 배율로 맞추기 위한 공통 분모다.
export const WALK_TORSO_PIVOT_OFFSET_PX = 101;
export const WALK_REFERENCE_HEIGHT_PX = 200;

const SHADOW_SPRITE_FILES: Record<ShadowExpression, string> = {
  normal: "face-normal.png",
  surprised: "face-surprised.png",
  scared: "face-scared.png",
  annoyed: "face-annoyed.png",
  disappointed: "face-disappointed.png",
  delighted: "face-delighted.png",
};

export interface CharacterSprites {
  body: Record<Exclude<BodyPose, "walk">, HTMLImageElement>;
  shadow: Record<ShadowExpression, HTMLImageElement>;
  walkTorso: HTMLImageElement;
  walkLegs: HTMLImageElement;
  walkLegsMirrored: HTMLImageElement;
}

function loadImage(fileName: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${fileName}`));
    img.src = ASSET_BASE + fileName;
  });
}

/** 이미지를 좌우 반전한 새 이미지를 만든다 — 걷기 다리 레이어의 반대쪽 스텝 프레임을 만드는 데 쓴다. */
function flipHorizontally(img: HTMLImageElement): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("캔버스 2D 컨텍스트를 만들 수 없음"));
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    const flipped = new Image();
    flipped.onload = () => resolve(flipped);
    flipped.onerror = () => reject(new Error("이미지 반전 실패"));
    flipped.src = canvas.toDataURL();
  });
}

async function loadAll<K extends string>(files: Record<K, string>): Promise<Record<K, HTMLImageElement>> {
  const entries = await Promise.all(
    (Object.entries(files) as [K, string][]).map(async ([key, file]) => [key, await loadImage(file)] as const),
  );
  return Object.fromEntries(entries) as Record<K, HTMLImageElement>;
}

/** 캐릭터·그림자 스프라이트를 전부 미리 로드한다. 게임 루프 시작 전 한 번만 호출한다. */
export function loadCharacterSprites(): Promise<CharacterSprites> {
  return Promise.all([loadAll(BODY_SPRITE_FILES), loadAll(SHADOW_SPRITE_FILES), loadImage(WALK_TORSO_FILE), loadImage(WALK_LEGS_FILE)]).then(
    async ([body, shadow, walkTorso, walkLegs]) => ({
      body,
      shadow,
      walkTorso,
      walkLegs,
      walkLegsMirrored: await flipHorizontally(walkLegs),
    }),
  );
}
