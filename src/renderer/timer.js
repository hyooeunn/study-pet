// Date.now() 기준이라 setInterval이 밀려도 시간이 정확함
export function createStopwatch() {
  let accumulated = 0;
  let startedAt = null;

  return {
    start() {
      if (startedAt === null) startedAt = Date.now();
    },
    pause() {
      if (startedAt === null) return;
      accumulated += Date.now() - startedAt;
      startedAt = null;
    },
    reset() {
      accumulated = 0;
      startedAt = null;
    },
    elapsed() {
      return accumulated + (startedAt === null ? 0 : Date.now() - startedAt);
    },
    isRunning() {
      return startedAt !== null;
    },
  };
}

export function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
