import type { Character } from './character.js';

export function setupClickThrough({
  character,
  isDragging,
  onHoverChange,
}: {
  character: Character;
  isDragging: () => boolean;
  onHoverChange?: (hovering: boolean) => void;
}) {
  let ignoring = true;

  // .hit-ui 클래스를 붙인 요소는 투명 영역이어도 클릭 가능 (나중에 버튼 UI 추가할 때)
  function isInteractive(x: number, y: number) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    if (el.closest('.hit-ui')) return true;
    if (el.closest('.character')) return character.hitTest(x, y);
    return false;
  }

  function setInteractive(on: boolean) {
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
