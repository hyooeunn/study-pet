import type { Appearance, ItemDef, ItemSlot, PetRig, RigData, RigPartId, Vec2 } from '../shared/ipc.js';

const PARTS: RigPartId[] = ['head', 'face', 'torso', 'arm_l', 'arm_r', 'leg_l', 'leg_r'];
// crop 바깥으로 이만큼 여유를 더 그림 (머리 위 포니테일, 몸이 들썩이는 양이 잘리지 않게)
const MARGIN = 0.15;

interface Sprite {
  bitmap: ImageBitmap;
  x: number; // 원본 2048 캔버스에서 잘라 낸 위치
  y: number;
  mask: Uint8Array;
  maskSize: number;
}

interface LoadedItem extends ItemDef {
  sprite: Sprite;
}

export interface RigModel {
  rig: RigData;
  parts: Record<RigPartId, Sprite>;
  items: LoadedItem[];
}

type Pose = Record<RigPartId, DOMMatrix> & { legOrder: ['leg_l' | 'leg_r', 'leg_l' | 'leg_r']; uL: number };

interface DrawnLayer {
  sprite: Sprite;
  matrix: DOMMatrix;
}

function assetUrl(p: string) {
  return '../../assets/' + p.split('/').map(encodeURIComponent).join('/');
}

// 마스크(64x64)로 그림이 있는 영역만 잘라서 매 프레임 2048 전체를 그리지 않게 함
async function loadSprite(rel: string, canvasSize: number): Promise<Sprite | null> {
  const layer = await window.petAPI.loadLayer([rel]).catch(() => null);
  if (!layer) return null;
  const { mask } = layer.frames[0];
  const n = layer.size;
  const cell = canvasSize / n;

  let minX = n, minY = n, maxX = -1, maxY = -1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const cx = i % n, cy = Math.floor(i / n);
    minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
    minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
  }
  if (maxX < 0) return null;

  const pad = 2; // 마스크에 안 잡힌 얇은 선까지 포함되게 여유
  const x = Math.max(0, (minX - pad) * cell);
  const y = Math.max(0, (minY - pad) * cell);
  const w = Math.min(canvasSize, (maxX + 1 + pad) * cell) - x;
  const h = Math.min(canvasSize, (maxY + 1 + pad) * cell) - y;

  const img = new Image();
  img.src = assetUrl(rel);
  try {
    await img.decode();
  } catch {
    return null;
  }
  return { bitmap: await createImageBitmap(img, x, y, w, h), x, y, mask, maskSize: n };
}

// items.json 경로의 {hairColor} 같은 자리를 내 캐릭터 설정값으로 채움
function fillTemplate(image: string, appearance: Appearance) {
  return image.replace(/\{(\w+)\}/g, (_, key: string) => String(appearance[key as keyof Appearance] ?? ''));
}

export async function loadRigModel(appearance: Appearance): Promise<RigModel | null> {
  const data: PetRig | null = await window.petAPI.loadRig().catch(() => null);
  if (!data) return null;
  const size = data.rig.canvas[0];

  const sprites = await Promise.all(PARTS.map((id) => loadSprite(`pet/${id}.png`, size)));
  if (sprites.some((s) => !s)) return null;
  const parts = Object.fromEntries(PARTS.map((id, i) => [id, sprites[i]!])) as Record<RigPartId, Sprite>;

  const items = (
    await Promise.all(
      data.items.map(async (item) => {
        const sprite = await loadSprite(`pet/${fillTemplate(item.image, appearance)}`, size);
        return sprite && PARTS.includes(item.attachTo) ? { ...item, sprite } : null;
      })
    )
  ).filter((i): i is LoadedItem => i !== null);

  return { rig: data.rig, parts, items };
}

// ---------- 포즈 계산 (rig.json 규칙 그대로, 회전 + = 시계방향) ----------

const TAU = Math.PI * 2;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

function rotAbout(deg: number, [px, py]: Vec2) {
  return new DOMMatrix().translate(px, py).rotate(deg).translate(-px, -py);
}

function foot(u: number, A: number, HL: number) {
  if (u < 0.5) return { x: A * (1 - 4 * u), lift: 0 };
  const s = (u - 0.5) * 2;
  const e = (1 - Math.cos(Math.PI * s)) / 2;
  return { x: -A + 2 * A * e, lift: HL * Math.sin(Math.PI * s) };
}

function idlePose(): Pose {
  const id = new DOMMatrix();
  return {
    head: id, face: id, torso: id, arm_l: id, arm_r: id, leg_l: id, leg_r: id,
    legOrder: ['leg_l', 'leg_r'],
    uL: 0,
  };
}

// 오른쪽으로 걷는 k번째 프레임. 왼쪽은 화면에서 통째로 좌우 반전
function walkPose(rig: RigData, k: number): Pose {
  const P = rig.params;
  const pv = rig.pivots;
  const uL = k / P.frames;
  const uR = (uL + 0.5) % 1;

  const roll = -P.rollDeg * Math.sin(TAU * uL);
  const bob = P.bobPx * Math.abs(Math.sin(TAU * uL));
  const body = new DOMMatrix().translate(0, -bob).multiply(rotAbout(roll + P.leanDeg, pv.roll));
  const head = body.multiply(rotAbout(-P.headCounterRoll * roll, pv.neck));

  const armL = P.armBaseDeg + P.armSwingDeg * Math.sin(TAU * uL);
  const armR = P.armBaseDeg + P.armSwingDeg * Math.sin(TAU * uR);

  const leg = (u: number, hip: Vec2) => {
    const f = foot(u, P.footTravelPx, P.footLiftPx);
    const sway = P.legSwayFollow * (body.transformPoint({ x: hip[0], y: hip[1] }).x - hip[0]);
    const m = new DOMMatrix().translate(sway, -f.lift).multiply(rotAbout(-toDeg(f.x / P.legLenPx), hip));
    return { m, lift: f.lift };
  };
  const legL = leg(uL, pv.hipL);
  const legR = leg(uR, pv.hipR);

  return {
    torso: body,
    head,
    face: head.multiply(new DOMMatrix().translate(P.faceShiftPx, 0)),
    arm_l: body.multiply(rotAbout(armL, pv.shoulderL)),
    arm_r: body.multiply(rotAbout(-armR, pv.shoulderR)),
    leg_l: legL.m,
    leg_r: legR.m,
    // 든 발(lift가 큰 쪽)을 나중에 그려서 위에 오게
    legOrder: legL.lift > legR.lift ? ['leg_r', 'leg_l'] : ['leg_l', 'leg_r'],
    uL,
  };
}

// ---------- 그리기 ----------

type DrawStep = { part: RigPartId } | { slot: ItemSlot };

function drawSteps(pose: Pose): DrawStep[] {
  return [
    { part: pose.legOrder[0] },
    { part: pose.legOrder[1] },
    { slot: 'hair_back' },
    { part: 'torso' },
    { slot: 'bottom' },
    { slot: 'top' },
    { part: 'arm_l' },
    { part: 'arm_r' },
    { part: 'head' },
    { part: 'face' },
    { slot: 'hair_front' },
  ];
}

function itemMatrix(item: LoadedItem, pose: Pose, walking: boolean) {
  const base = pose[item.attachTo];
  if (!item.sway || !walking) return base;
  const angle = item.sway.deg * Math.sin(TAU * (pose.uL - (item.sway.lag ?? 0)));
  return base.multiply(rotAbout(angle, item.sway.pivot));
}

export function createRigView(model: RigModel, className: string) {
  const { rig } = model;
  const canvas = document.createElement('canvas');
  canvas.className = className;
  // 박스(=crop)보다 MARGIN만큼 크게 깔아서 crop 영역이 정확히 캐릭터 박스에 맞게
  Object.assign(canvas.style, {
    left: `${-MARGIN * 100}%`,
    top: `${-MARGIN * 100}%`,
    width: `${(1 + 2 * MARGIN) * 100}%`,
    height: `${(1 + 2 * MARGIN) * 100}%`,
  });
  const ctx = canvas.getContext('2d')!;
  const view = {
    x: rig.crop.x - rig.crop.size * MARGIN,
    y: rig.crop.y - rig.crop.size * MARGIN,
    size: rig.crop.size * (1 + 2 * MARGIN),
  };

  let walking = false;
  let frame = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let drawn: DrawnLayer[] = [];

  function draw() {
    const pose = walking ? walkPose(rig, frame) : idlePose();
    const scale = canvas.width / view.size;
    const base = new DOMMatrix().scale(scale).translate(-view.x, -view.y);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    drawn = [];

    const paint = (sprite: Sprite, matrix: DOMMatrix) => {
      ctx.setTransform(base.multiply(matrix));
      ctx.drawImage(sprite.bitmap, sprite.x, sprite.y);
      drawn.push({ sprite, matrix });
    };

    for (const step of drawSteps(pose)) {
      if ('part' in step) {
        paint(model.parts[step.part], pose[step.part]);
      } else {
        for (const item of model.items) {
          if (item.slot === step.slot) paint(item.sprite, itemMatrix(item, pose, walking));
        }
      }
    }
  }

  function setSize(cssPx: number) {
    const px = Math.round(cssPx * (1 + 2 * MARGIN) * window.devicePixelRatio);
    canvas.width = px;
    canvas.height = px;
    draw();
  }

  function setWalking(next: boolean) {
    if (next === walking) return;
    walking = next;
    frame = 0;
    if (timer) clearInterval(timer);
    timer = null;
    if (walking) {
      timer = setInterval(() => {
        frame = (frame + 1) % rig.params.frames;
        draw();
      }, 1000 / rig.params.fps);
    }
    draw();
  }

  // u, v = 캔버스 안에서의 위치 (0~1). 마지막으로 그린 파츠들을 역변환해서 마스크 확인
  function hitTest(u: number, v: number) {
    const p = new DOMPoint(view.x + u * view.size, view.y + v * view.size);
    const canvasSize = rig.canvas[0];
    return drawn.some(({ sprite, matrix }) => {
      const local = matrix.inverse().transformPoint(p);
      const n = sprite.maskSize;
      const mx = Math.floor((local.x / canvasSize) * n);
      const my = Math.floor((local.y / canvasSize) * n);
      return mx >= 0 && my >= 0 && mx < n && my < n && sprite.mask[my * n + mx] === 1;
    });
  }

  return { canvas, setSize, setWalking, hitTest };
}

export type RigView = ReturnType<typeof createRigView>;
