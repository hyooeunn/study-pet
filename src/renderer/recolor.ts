// 파츠 그림의 색을 바꾼다 (피부: 피부 픽셀만 / 머리카락: 그림 전체에서 외곽선·머리끈 빼고)
export type RGB = [number, number, number];
export type Tint = 'skin' | 'hair';

// 원본 그림의 색. 이 색을 고르면 그림이 그대로 나옴
export const BASE_COLORS: Record<Tint, string> = { skin: '#ffeae4', hair: '#493b30' };

const BASE_SKIN: RGB = [255, 234, 228];
const BASE_HAIR: RGB = [73, 59, 48];   // 갈색 머리 칠한 색
const HAIR_LINE: RGB = [20, 16, 14];   // 크레용 외곽선 색

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

export function hexToRgb(hex: string): RGB {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------- 피부 ----------

// 피부 판별: R이 G·B보다 확실히 높은 분홍 계열 (흰 티, 파란 반바지, 검은 윤곽선은 제외)
// 0~1 가중치라서 경계가 계단 없이 부드럽게 섞임
function skinWeights(image: ImageData): Float32Array {
  const d = image.data;
  const w = new Float32Array(d.length / 4);
  for (let i = 0, p = 0; p < w.length; i += 4, p++) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (d[i + 3] === 0 || r <= 150 || b <= 120) continue;
    w[p] = clamp01((r - g - 4) / 12) * clamp01((r - b - 2) / 12);
  }
  return w;
}

// 새 색 = 원본색 × (목표 피부색 / 기준 피부색), 가중치만큼 원본과 섞기
function recolorSkin(src: Uint8ClampedArray, d: Uint8ClampedArray, weights: Float32Array, target: RGB) {
  const f = [target[0] / BASE_SKIN[0], target[1] / BASE_SKIN[1], target[2] / BASE_SKIN[2]];
  for (let p = 0, i = 0; p < weights.length; p++, i += 4) {
    const w = weights[p];
    if (w === 0) continue;
    for (let c = 0; c < 3; c++) {
      const v = src[i + c];
      d[i + c] = v + (Math.min(255, v * f[c]) - v) * w;
    }
  }
}

// ---------- 머리카락 ----------

// 픽셀마다 "외곽선(0) ~ 칠한 색(1)" 위치. 머리끈처럼 채도 높은 픽셀은 -1(그대로 둠)
function hairWeights(image: ImageData): Float32Array {
  const d = image.data;
  const w = new Float32Array(d.length / 4);
  const lo = lum(...HAIR_LINE);
  const hi = lum(...BASE_HAIR);
  for (let i = 0, p = 0; p < w.length; i += 4, p++) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (d[i + 3] === 0 || (max > 115 && (max - min) / max > 0.45)) {
      w[p] = -1;
      continue;
    }
    w[p] = clamp01((lum(r, g, b) - lo) / (hi - lo));
  }
  return w;
}

// 외곽선 색과 새 머리색 사이를 위치(t)만큼 섞어서 다시 칠함
function recolorHair(d: Uint8ClampedArray, weights: Float32Array, target: RGB) {
  for (let p = 0, i = 0; p < weights.length; p++, i += 4) {
    const t = weights[p];
    if (t < 0) continue;
    for (let c = 0; c < 3; c++) d[i + c] = HAIR_LINE[c] + (target[c] - HAIR_LINE[c]) * t;
  }
}

// ---------- 공용 ----------

export function tintWeights(tint: Tint, image: ImageData) {
  return tint === 'skin' ? skinWeights(image) : hairWeights(image);
}

export function recolor(tint: Tint, image: ImageData, weights: Float32Array, color: string): ImageData {
  const out = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const target = hexToRgb(color);
  if (tint === 'skin') recolorSkin(image.data, out.data, weights, target);
  else recolorHair(out.data, weights, target);
  return out;
}
