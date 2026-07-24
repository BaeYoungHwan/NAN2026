import type { Round } from "../core/round";

/**
 * 저승사자 대사 스크립트 (초안). 실수해놓고 재촉하는 병맛 코미디 캐릭터 — PRD §7-2.
 * 최종 스크립트/에셋 확정 전까지의 플레이스홀더이며, 콘텐츠 담당(송원호)이 교체한다.
 */

export const TUTORIAL_LINES: readonly string[] = [
  "아이고... 제가 서류를 잘못 넘겨드렸네요.",
  "원래 저승 가시는 길인데, 안전 구역 밖으로 나가면 진짜로 저 세상 갑니다.",
  "WASD로 움직이시고, 그림자는 , 랑 . 로 돌리세요.",
  "그림자가 안전 구역(부채꼴) 밖으로 나가면 그 즉시 리셋입니다 — 조심하세요.",
  "저 앞에 주황색 원까지 가시면 다음 라운드예요. 빨리 좀 가주세요, 제 실적에 감점돼요.",
];

export const DEATH_LINES: readonly string[] = [
  "으악, 또 죽으셨네요! 제 서류에 도장을 또 찍어야 하잖아요...",
  "죄송합니다, 제가 안내를 잘못 드렸나 봐요. 다시 해보세요.",
  "빨리 넘어가주세요, 이러다 저 짤려요.",
  "그림자가 삐끗하면 바로 저 세상입니다. 다시 한번!",
];

export const ROUND_ADVANCE_LINES: Readonly<Record<Round, string>> = {
  1: "",
  2: "오, 2라운드! 이제부터는 안전 구역 표시를 안 해드려요. 알아서 잘 맞춰보세요.",
  3: "마지막 3라운드입니다. 이제부터 조금 방해가 들어갈 거예요. 저도 어쩔 수 없어요...",
};

export const STAGE_CLEAR_LINE =
  "축하드립니다! 어... 이번엔 진짜로 무사히 통과하셨네요. 수고하셨습니다!";

export function pickRandomLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}
