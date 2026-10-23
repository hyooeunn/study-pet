// -webkit-app-region: drag 를 안 쓰는 이유: Windows에서 우클릭/hover가 막힘
export function setupDrag(target: HTMLElement, { onStart, onEnd }: { onStart?: () => void; onEnd?: () => void } = {}) {
  let dragging = false;

  target.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    target.classList.add('dragging');
    window.petAPI.dragStart();
    onStart?.();
  });

  function stop() {
    if (!dragging) return;
    dragging = false;
    target.classList.remove('dragging');
    window.petAPI.dragEnd();
    onEnd?.();
  }

  window.addEventListener('mouseup', stop);
  window.addEventListener('blur', stop);

  return { isDragging: () => dragging };
}
