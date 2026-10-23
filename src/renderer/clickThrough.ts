import type { Character } from './character.js';

const HIDE_DELAY = 500;

export function setupClickThrough({
  root,
  character,
  isDragging,
  onHoverChange,
}: {
  root: HTMLElement;
  character: Character;
  isDragging: () => boolean;
  onHoverChange?: (hovering: boolean) => void;
}) {
  let ignoring = true;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function isInteractive(x: number, y: number) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    if (el.closest('.hit-ui')) return true;
    if (el.closest('.character')) return character.hitTest(x, y);
    return false;
  }

  function setInteractive(on: boolean) {
    if (on) {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = null;
      root.classList.add('hovering');
    } else if (!hideTimer && root.classList.contains('hovering')) {
      // 캐릭터 → 닫기 버튼으로 가는 사이 버튼이 사라지지 않게 살짝 늦게 숨김
      hideTimer = setTimeout(() => {
        root.classList.remove('hovering');
        hideTimer = null;
      }, HIDE_DELAY);
    }

    if (ignoring === !on) return;
    ignoring = !on;
    window.petAPI.setIgnoreMouse(ignoring);
    onHoverChange?.(on);
  }

  // forward: true 덕분에 클릭 통과 중에도 mousemove는 들어온다
  document.addEventListener('mousemove', (e) => {
    if (isDragging()) return;
    setInteractive(isInteractive(e.clientX, e.clientY));
  });

  document.addEventListener('mouseleave', () => {
    if (!isDragging()) setInteractive(false);
  });
}
