interface RestartButtonProps {
  onRestart: () => void;
}

/**
 * 재시작 버튼 — 1R 스폰 상태로 되돌린다(사망 횟수는 유지되는 것이 사양이다,
 * `GameCanvasHandle.restart` 주석 참고).
 *
 * 위치·z-index는 부모인 `.overlay-buttons`(`src/index.css`)가 잡는다. 대사 박스나
 * 컷신이 DOM 순서로 위에 그려져도 이 버튼들은 항상 보이고 클릭 가능해야 한다.
 */
function RestartButton({ onRestart }: RestartButtonProps) {
  return (
    <button type="button" className="overlay-button" onClick={onRestart}>
      재시작
    </button>
  );
}

export default RestartButton;
