import type { LayerData } from '../shared/ipc.js';
import type { Appearance } from './state.js';
import { STATES, isStatus } from './states.config.js';

const ASSET_BASE = '../../assets/';
const PART_ORDER = ['base', 'hair', 'outfit', 'accessory'] as const;

const SPRITE_CLASS =
  'absolute inset-0 origin-[50%_85%] group-[.dragging]/char:animate-pet-wiggle motion-reduce:animate-none';
const LAYER_CLASS = 'absolute inset-0 size-full object-contain pointer-events-none';
const PLACEHOLDER_CLASS =
  'placeholder absolute inset-[10%] rounded-full bg-radial-[at_35%_30%] to-70% shadow-[inset_-6px_-8px_0_rgb(0_0_0/0.08)]';
const PLACEHOLDER_FACE = `
  <span class="absolute top-[40%] left-[30%] h-[12%] w-[10%] rounded-full bg-stone-800"></span>
  <span class="absolute top-[40%] right-[30%] h-[12%] w-[10%] rounded-full bg-stone-800"></span>
  <span class="absolute top-[60%] left-1/2 h-[10%] w-[20%] -translate-x-1/2 rounded-b-full border-b-4 border-stone-800"></span>
  <span data-badge class="absolute -top-[6%] -right-[6%] text-2xl"></span>`;

interface LoadedLayer extends LayerData {
  imgs: HTMLImageElement[];
}

// 이름 하나에 대해 "모션 폴더 → 한 장짜리 PNG" 순서로 찾는다
const variants = (name: string) => [name, `${name}.png`];

// 레이어마다 "이 순서로 찾아보고 처음 있는 걸 쓴다"는 후보 목록
function layerCandidates(status: string, appearance: Appearance | null): string[][] {
  if (!appearance) {
    return [[...variants(`states/${status}`), ...variants('base')]];
  }
  return PART_ORDER.flatMap((part) => {
    const id = appearance[part];
    if (part === 'base') {
      return [[...variants(`parts/base/${status}`), ...variants(`parts/base/${id || 'default'}`)]];
    }
    return id ? [variants(`parts/${part}/${id}`)] : [];
  });
}

function assetUrl(p: string) {
  return ASSET_BASE + p.split('/').map(encodeURIComponent).join('/');
}

async function loadFrames(layer: LayerData): Promise<LoadedLayer | null> {
  const imgs = await Promise.all(
    layer.frames.map(async (frame) => {
      const img = new Image();
      img.className = LAYER_CLASS;
      img.draggable = false;
      img.src = assetUrl(frame.path);
      try {
        await img.decode();
        return img;
      } catch {
        return null;
      }
    })
  );
  return imgs.every((i): i is HTMLImageElement => i !== null) ? { ...layer, imgs } : null;
}

// 친구 캐릭터도 이 함수로 만든다: createCharacter(box, { size: 110, appearance })
export function createCharacter(
  container: HTMLElement,
  { size = 150, appearance = null as Appearance | null } = {}
) {
  const el = document.createElement('div');
  el.className = 'character group/char relative cursor-grab [&.dragging]:cursor-grabbing';
  const sprite = document.createElement('div');
  sprite.className = SPRITE_CLASS;
  el.appendChild(sprite);
  container.appendChild(el);

  let layers: LoadedLayer[] = [];
  let frameIndex: number[] = [];
  let timers: ReturnType<typeof setInterval>[] = [];
  let usingPlaceholder = false;
  let renderToken = 0;

  function setSize(px: number) {
    el.style.width = `${px}px`;
    el.style.height = `${px}px`;
  }

  // 프레임 모션이 없을 때만 상태별 CSS 움직임을 켠다
  function applyMotion(status: string, isStatic: boolean) {
    const motion = isStatic && isStatus(status) ? STATES[status].motion : '';
    sprite.className = `${SPRITE_CLASS} ${motion}`;
  }

  function stopAnimation() {
    timers.forEach(clearInterval);
    timers = [];
  }

  function showFrame(li: number, fi: number) {
    layers[li].imgs.forEach((img, i) => img.classList.toggle('invisible', i !== fi));
    frameIndex[li] = fi;
  }

  function startAnimation() {
    stopAnimation();
    frameIndex = layers.map(() => 0);
    layers.forEach((layer, li) => {
      showFrame(li, 0);
      if (layer.frames.length < 2) return;
      const id = setInterval(() => {
        let next = frameIndex[li] + 1;
        if (next >= layer.frames.length) {
          if (!layer.loop) return clearInterval(id);
          next = 0;
        }
        showFrame(li, next);
      }, 1000 / layer.fps);
      timers.push(id);
    });
  }

  function showPlaceholder(status: string) {
    stopAnimation();
    usingPlaceholder = true;
    layers = [];
    const def = isStatus(status) ? STATES[status] : null;
    const ph = document.createElement('div');
    ph.className = `${PLACEHOLDER_CLASS} ${def?.color ?? ''}`;
    ph.innerHTML = PLACEHOLDER_FACE;
    ph.querySelectorAll('span').forEach((s) => s.classList.add('pointer-events-none'));
    ph.querySelector('[data-badge]')!.textContent = def?.emoji ?? '';
    sprite.replaceChildren(ph);
    applyMotion(status, true);
  }

  async function setStatus(status: string) {
    const token = ++renderToken;
    el.dataset.status = status;

    const found = await Promise.all(
      layerCandidates(status, appearance).map((c) => window.petAPI.loadLayer(c).catch(() => null))
    );
    const loaded = (
      await Promise.all(found.filter((l): l is LayerData => l !== null).map(loadFrames))
    ).filter((l): l is LoadedLayer => l !== null);

    // 빠르게 상태를 연타했을 때 늦게 끝난 옛 요청은 무시
    if (token !== renderToken) return;
    if (loaded.length === 0) return showPlaceholder(status);

    usingPlaceholder = false;
    layers = loaded;
    sprite.replaceChildren(...layers.flatMap((l) => l.imgs));
    applyMotion(status, layers.every((l) => l.frames.length === 1));
    startAnimation();
  }

  function setAppearance(next: Appearance | null) {
    appearance = next;
    return setStatus(el.dataset.status ?? '');
  }

  // 화면 좌표 (x, y)가 캐릭터의 "불투명한" 부분 위인지
  function hitTest(x: number, y: number) {
    if (usingPlaceholder) {
      return !!document.elementFromPoint(x, y)?.closest('.placeholder');
    }
    const r = sprite.getBoundingClientRect();
    const u = (x - r.left) / r.width;
    const v = (y - r.top) / r.height;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    return layers.some((layer, li) => {
      const { mask } = layer.frames[frameIndex[li]];
      const n = layer.size;
      return mask[Math.floor(v * n) * n + Math.floor(u * n)] === 1;
    });
  }

  setSize(size);

  return { el, setStatus, setAppearance, setSize, hitTest };
}

export type Character = ReturnType<typeof createCharacter>;
