const ASSET_BASE = '../../assets/';
const PART_ORDER = ['base', 'hair', 'outfit', 'accessory'];

// 레이어마다 "이 순서로 찾아보고 처음 있는 걸 쓴다"는 후보 목록
function layerCandidates(status, appearance) {
  if (!appearance) {
    return [[`states/${status}.png`, 'base.png']];
  }
  return PART_ORDER.map((part) => {
    const id = appearance[part];
    if (part === 'base') {
      return [`parts/base/${status}.png`, `parts/base/${id || 'default'}.png`];
    }
    return id ? [`parts/${part}/${id}.png`] : null;
  }).filter(Boolean);
}

async function loadImage(layer) {
  const img = new Image();
  img.className = 'layer';
  img.draggable = false;
  img.src = ASSET_BASE + layer.path;
  try {
    await img.decode();
    return { img, layer };
  } catch {
    return null;
  }
}

// 친구 캐릭터도 이 함수로 만든다: createCharacter(box, { size: 110, appearance })
export function createCharacter(container, { size = 150, appearance = null } = {}) {
  const el = document.createElement('div');
  el.className = 'character';
  container.appendChild(el);

  let layers = [];
  let usingPlaceholder = false;
  let renderToken = 0;

  function setSize(px) {
    el.style.width = `${px}px`;
    el.style.height = `${px}px`;
  }

  function showPlaceholder() {
    usingPlaceholder = true;
    layers = [];
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.innerHTML = '<span class="eye left"></span><span class="eye right"></span><span class="mouth"></span>';
    el.replaceChildren(ph);
  }

  async function setStatus(status) {
    const token = ++renderToken;
    el.dataset.status = status;

    const found = await Promise.all(
      layerCandidates(status, appearance).map((c) => window.petAPI.loadLayer(c).catch(() => null))
    );
    const loaded = (await Promise.all(found.filter(Boolean).map(loadImage))).filter(Boolean);

    // 빠르게 상태를 연타했을 때 늦게 끝난 옛 요청은 무시
    if (token !== renderToken) return;
    if (loaded.length === 0) return showPlaceholder();

    usingPlaceholder = false;
    layers = loaded.map((l) => l.layer);
    el.replaceChildren(...loaded.map((l) => l.img));
  }

  function setAppearance(next) {
    appearance = next;
    return setStatus(el.dataset.status);
  }

  // 화면 좌표 (x, y)가 캐릭터의 "불투명한" 부분 위인지
  function hitTest(x, y) {
    if (usingPlaceholder) {
      return !!document.elementFromPoint(x, y)?.closest('.placeholder');
    }
    const r = el.getBoundingClientRect();
    const u = (x - r.left) / r.width;
    const v = (y - r.top) / r.height;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    return layers.some(({ mask, size: n }) => mask[Math.floor(v * n) * n + Math.floor(u * n)] === 1);
  }

  setSize(size);

  return { el, setStatus, setAppearance, setSize, hitTest };
}
