import { useEffect, useRef } from "react";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

/**
 * Hello World 수준의 Canvas 마운트 + 렌더 루프 확인용 컴포넌트.
 * 실제 캐릭터·그림자·경계 렌더링은 feature/render-prototype에서 구현한다.
 */
function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;

    const draw = () => {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#eee";
      ctx.font = "24px sans-serif";
      ctx.fillText("Shadow-Step — Canvas OK", 20, 40);

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(frameId);
  }, []);

  return <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />;
}

export default GameCanvas;
