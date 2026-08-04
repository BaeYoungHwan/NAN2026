import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { AudioEngine } from "./audioEngine";
import { loadSfxBuffers } from "./audioAssets";
import type { BgmCue, SfxCue } from "./soundCues";

/** 뮤트 설정을 새로고침 후에도 유지한다. */
const MUTE_STORAGE_KEY = "shadow-step:muted";

export interface GameAudio {
  /**
   * 게임 루프(rAF)가 매 프레임 읽는 엔진 참조 — 로드가 끝나기 전에는 null이다.
   * 상태가 아니라 ref인 이유는 스프라이트·배경과 달리 오디오는 렌더 결과에 영향을
   * 주지 않아서, 로드 완료로 게임 루프를 재시작시킬 이유가 없기 때문이다.
   */
  engineRef: MutableRefObject<AudioEngine | null>;
  /**
   * 엔진 준비 완료 여부. 오디오 초기화(디코딩)는 비동기라 첫 렌더 시점에는 아직
   * 끝나지 않는다 — BGM 재생을 거는 쪽이 이 값을 의존성에 넣어야, 준비 전에 요청한
   * 곡(오프닝 BGM 등)이 준비 완료 시 다시 시도된다.
   */
  ready: boolean;
  muted: boolean;
  toggleMute: () => void;
  /** React 이벤트 핸들러용 단발 재생 — 엔진이 아직 없으면 조용히 무시된다. */
  play: (cue: SfxCue) => void;
  playBgm: (cue: BgmCue) => void;
  stopBgm: () => void;
}

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  } catch {
    // 사생활 보호 모드 등에서 localStorage 접근이 막힐 수 있다 — 기본값으로 진행한다.
    return false;
  }
}

/**
 * 게임 오디오 훅 — AudioContext 생성, 효과음 프리로드, autoplay 잠금 해제,
 * M 키 뮤트 토글을 담당한다.
 *
 * 에셋이 하나도 없어도 정상 동작한다(`audioAssets.ts` 폴백 계약). 엔진 생성 자체가
 * 실패해도(구형 브라우저 등) engineRef가 null로 남아 게임은 무음으로 진행된다.
 */
export function useAudio(): GameAudio {
  const engineRef = useRef<AudioEngine | null>(null);
  // 컨텍스트를 엔진과 별도로 들고 있는다 — 엔진은 효과음 디코딩이 끝나야 만들어지지만,
  // autoplay 잠금 해제는 그보다 먼저 오는 첫 입력에서 이미 처리해야 하기 때문이다.
  const contextRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(readStoredMute);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let context: AudioContext | null = null;

    try {
      context = new AudioContext();
    } catch {
      // WebAudio를 못 쓰는 환경 — 무음으로 진행한다.
      return;
    }

    const activeContext = context;
    contextRef.current = activeContext;
    // StrictMode는 마운트를 두 번 실행한다 — 첫 cleanup에서 컨텍스트를 닫은 뒤, 그때
    // 아직 진행 중이던 loadSfxBuffers가 나중에 resolve되면서 같은 컨텍스트를 또 닫으려
    // 한다. 이미 닫힌 AudioContext의 close()는 reject되므로, 한 번만 닫도록 잠근다.
    let contextClosed = false;
    const closeContext = () => {
      if (contextClosed) return;
      contextClosed = true;
      activeContext.close().catch(() => {});
    };

    loadSfxBuffers(activeContext).then((buffers) => {
      if (cancelled) {
        closeContext();
        return;
      }
      engineRef.current = new AudioEngine({
        context: activeContext,
        buffers,
        muted: readStoredMute(),
      });
      setReady(true);
    });

    return () => {
      cancelled = true;
      setReady(false);
      engineRef.current?.dispose();
      engineRef.current = null;
      contextRef.current = null;
      closeContext();
    };
  }, []);

  /**
   * 브라우저는 사용자 제스처 전까지 AudioContext를 suspended로 둔다. window 레벨에서
   * 모든 입력을 받아 깨운다.
   *
   * **첫 입력 한 번만 처리하고 리스너를 떼면 안 된다.** 플레이어는 페이지가 뜨자마자
   * 오프닝 컷신을 넘기려고 Enter를 누르는데, 그 시점에는 효과음 디코딩이 아직 끝나지
   * 않아 컨텍스트가 준비되기도 전일 수 있다. 그 한 번으로 기회를 소진해 버리면 이후
   * 컨텍스트가 영영 suspended로 남아 소리가 전혀 나지 않는다(느린 기기·첫 로드에서
   * 실제로 발생하는 조건이다). 그래서 잠금이 실제로 풀릴 때까지 리스너를 유지하고,
   * 이미 풀린 뒤에는 상태 확인 한 번으로 즉시 빠져나온다.
   */
  useEffect(() => {
    const unlock = () => {
      const context = contextRef.current;
      // 컨텍스트가 아직 없으면(초기화 전이거나 WebAudio 미지원) 다음 입력에서 다시 본다.
      if (!context || context.state !== "suspended") return;

      context
        .resume()
        .then(() => {
          // 잠금 때문에 재생이 거부됐던 BGM을 다시 밀어준다. 엔진이 아직 없으면
          // 준비 완료 시점의 `ready` 갱신이 BGM 재생을 다시 걸어준다.
          engineRef.current?.resumeBgm();
        })
        .catch(() => {
          // 제스처로 인정되지 않은 경우 — 리스너가 살아 있으므로 다음 입력에서 재시도된다.
        });
    };

    window.addEventListener("keydown", unlock);
    window.addEventListener("pointerdown", unlock);
    return () => {
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((previous) => {
      const next = !previous;
      engineRef.current?.setMuted(next);
      try {
        localStorage.setItem(MUTE_STORAGE_KEY, String(next));
      } catch {
        // 저장 실패는 이번 세션 동안만 뮤트가 유지되는 것으로 충분하다.
      }
      return next;
    });
  }, []);

  // M 키 뮤트 토글. `core/input.ts`의 KEY_MAP에는 넣지 않는다 — InputState는
  // 게임플레이 입력 계약이고, 뮤트는 대사·컷신 중(inputDisabled)에도 동작해야 하는
  // 메타 조작이다. event.key 대신 event.code를 쓰는 이유는 한글 입력 상태에서도
  // 물리 키 위치로 인식되게 하기 위함이다.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyM" || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      toggleMute();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMute]);

  const play = useCallback((cue: SfxCue) => {
    engineRef.current?.play(cue);
  }, []);

  const playBgm = useCallback((cue: BgmCue) => {
    engineRef.current?.playBgm(cue);
  }, []);

  const stopBgm = useCallback(() => {
    engineRef.current?.stopBgm();
  }, []);

  return { engineRef, ready, muted, toggleMute, play, playBgm, stopBgm };
}
