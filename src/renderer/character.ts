import type { Appearance, LayerData } from '../shared/ipc.js';
import { DEFAULT_APPEARANCE } from './appearance.config.js';
import { ACTIVITIES, STATES, isStatus, type ActivityId } from './states.config.js';
import { createRigView, loadRigModel, type RigView } from './rig.js';

const ASSET_BASE = '../../assets/';

const FLIP_CLASS = 'absolute inset-0 transition-transform duration-150';
const SPRITE_CLASS =
  'absolute inset-0 origin-[50%_85%] group-[.dragging]/char:animate-pet-wiggle motion-reduce:animate-none';
const LAYER_CLASS = 'absolute inset-0 size-full object-contain pointer-events-none';
const CANVAS_CLASS = 'absolute pointer-events-none';
const PLACEHOLDER_CLASS =
  'placeholder absolute inset-[10%] rounded-full bg-radial-[at_35%_30%] to-70% shadow-[inset_-6px_-8px_0_rgb(0_0_0/0.08)]';
const PLACEHOLDER_FACE = `
  <span class="pointer-events-none absolute top-[40%] left-[30%] h-[12%] w-[10%] rounded-full bg-stone-800"></span>
  <span class="pointer-events-none absolute top-[40%] right-[30%] h-[12%] w-[10%] rounded-full bg-stone-800"></span>
  <span class="pointer-events-none absolute top-[60%] left-1/2 h-[10%] w-[20%] -translate-x-1/2 rounded-b-full border-b-4 border-stone-800"></span>
  <span data-badge class="pointer-events-none absolute -top-[6%] -right-[6%] text-2xl"></span>`;

interface LoadedLayer extends LayerData {
  imgs: HTMLImageElement[];
}

// 이름 하나에 대해 "모션 폴더 → 한 장짜리 PNG" 순서로 찾는다
const variants = (name: string) => [name, `${name}.png`];

// 그림 파일 후보. 파츠 조립 캐릭터(rig)가 있으면 base 대신 rig가 기본 모습
function imageCandidates(status: string, activity: ActivityId | null, hasRig: boolean): string[] {
  return [
    ...(activity ? variants(`motions/${activity}`) : []),
    ...variants(`states/${status}`),
    ...(hasRig ? [] : variants('base')),
  ];
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
  {
    size = 150,
    appearance: initialAppearance = DEFAULT_APPEARANCE,
    still = false, // true면 상태별 CSS 움직임(숨쉬기 등)을 끔
  }: { size?: number; appearance?: Appearance; still?: boolean } = {}
) {
  const el = document.createElement('div');
  el.className = 'character group/char relative cursor-grab [&.dragging]:cursor-grabbing';
  const flip = document.createElement('div');
  flip.className = FLIP_CLASS;
  const sprite = document.createElement('div');
  sprite.className = SPRITE_CLASS;
  flip.appendChild(sprite);
  el.appendChild(flip);
  container.appendChild(el);

  let currentSize = size;
  let status = '';
  let activity: ActivityId | null = null;
  let facingLeft = false;
  let layers: LoadedLayer[] = [];
  let frameIndex: number[] = [];
  let timers: ReturnType<typeof setInterval>[] = [];
  let mode: 'images' | 'rig' | 'placeholder' = 'images';
  let renderToken = 0;

  let appearance = initialAppearance;
  let rigView: RigView | null = null;
  let rigToken = 0;

  function loadRig(): Promise<RigView | null> {
    const token = ++rigToken;
    return loadRigModel(appearance).then((model) => {
      // 머리색을 연달아 바꿨을 때 늦게 끝난 옛 결과는 버림
      if (!model || token !== rigToken) return null;
      rigView?.setWalking(false);
      rigView = createRigView(model, CANVAS_CLASS);
      rigView.setSize(currentSize);
      return rigView;
    });
  }
  let rigReady = loadRig();

  function setSize(px: number) {
    currentSize = px;
    el.style.width = `${px}px`;
    el.style.height = `${px}px`;
    rigView?.setSize(px);
  }

  // 프레임 모션이 없을 때만 CSS 움직임을 켠다 (활동 중이면 활동 움직임 우선)
  function applyMotion(isStatic: boolean) {
    let motion = '';
    if (isStatic && !still) {
      if (activity) motion = ACTIVITIES[activity].motion;
      else if (isStatus(status)) motion = STATES[status].motion;
    }
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

  function showPlaceholder() {
    mode = 'placeholder';
    layers = [];
    const def = isStatus(status) ? STATES[status] : null;
    const ph = document.createElement('div');
    ph.className = `${PLACEHOLDER_CLASS} ${def?.color ?? ''}`;
    ph.innerHTML = PLACEHOLDER_FACE;
    ph.querySelector('[data-badge]')!.textContent = def?.emoji ?? '';
    sprite.replaceChildren(ph);
    applyMotion(true);
  }

  function showRig(view: RigView) {
    mode = 'rig';
    layers = [];
    const walking = activity === 'walk';
    view.setWalking(walking);
    if (view.canvas.parentElement !== sprite) sprite.replaceChildren(view.canvas);
    applyMotion(!walking);
  }

  function showImages(loaded: LoadedLayer[]) {
    mode = 'images';
    layers = loaded;
    sprite.replaceChildren(...layers.flatMap((l) => l.imgs));
    applyMotion(layers.every((l) => l.frames.length === 1));
    startAnimation();
  }

  async function render() {
    const token = ++renderToken;
    el.dataset.status = status;
    el.dataset.activity = activity ?? '';

    const rig = await rigReady;
    // rig가 있으면 걷기는 항상 파츠 조립 애니메이션
    const found =
      rig && activity === 'walk'
        ? null
        : await window.petAPI.loadLayer(imageCandidates(status, activity, !!rig)).catch(() => null);
    const loaded = found ? await loadFrames(found) : null;

    // 빠르게 상태를 연타했을 때 늦게 끝난 옛 요청은 무시
    if (token !== renderToken) return;

    stopAnimation();
    if (mode === 'rig' && (loaded || !rig)) rig?.setWalking(false);

    if (loaded) showImages([loaded]);
    else if (rig) showRig(rig);
    else showPlaceholder();
  }

  function setStatus(next: string) {
    status = next;
    return render();
  }

  function setAppearance(next: Appearance) {
    appearance = next;
    rigReady = loadRig();
    return render();
  }

  // 걷기 모션은 오른쪽을 보는 그림 기준. 왼쪽으로 갈 때 좌우 반전
  function setActivity(next: ActivityId | null, dir: 1 | -1 = 1) {
    facingLeft = next !== null && dir < 0;
    flip.classList.toggle('-scale-x-100', facingLeft);
    if (next === activity) return;
    activity = next;
    return render();
  }

  // 화면 좌표 (x, y)가 캐릭터의 "불투명한" 부분 위인지
  function hitTest(x: number, y: number) {
    if (mode === 'placeholder') {
      return !!document.elementFromPoint(x, y)?.closest('.placeholder');
    }

    const target = mode === 'rig' ? sprite.querySelector('canvas') : sprite;
    if (!target) return false;
    const r = target.getBoundingClientRect();
    let u = (x - r.left) / r.width;
    const v = (y - r.top) / r.height;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    if (facingLeft) u = 1 - u;

    if (mode === 'rig') return !!rigView?.hitTest(u, v);

    return layers.some((layer, li) => {
      const { mask } = layer.frames[frameIndex[li]];
      const n = layer.size;
      return mask[Math.floor(v * n) * n + Math.floor(u * n)] === 1;
    });
  }

  setSize(size);

  return { el, setStatus, setActivity, setAppearance, setSize, hitTest };
}

export type Character = ReturnType<typeof createCharacter>;
