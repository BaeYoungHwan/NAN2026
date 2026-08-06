interface MuteButtonProps {
  muted: boolean;
  onToggle: () => void;
}

/**
 * 음소거 토글 버튼.
 *
 * 음소거는 원래 `M` 키로만 가능했고(`audio/useAudio.ts`), 상태는 HUD 텍스트로만
 * 표시됐다 — 키를 모르는 사람은 소리를 끌 방법이 없었다. 키 조작은 그대로 두고
 * 클릭 경로를 추가한다(둘 다 같은 `toggleMute`를 호출하므로 상태가 어긋나지 않는다).
 */
function MuteButton({ muted, onToggle }: MuteButtonProps) {
  return (
    <button
      type="button"
      className={muted ? "overlay-button overlay-button--muted" : "overlay-button"}
      onClick={onToggle}
      aria-pressed={muted}
      title="소리 켜기/끄기 (M)"
    >
      {muted ? "🔇 소리 꺼짐" : "🔊 소리 켜짐"}
    </button>
  );
}

export default MuteButton;
