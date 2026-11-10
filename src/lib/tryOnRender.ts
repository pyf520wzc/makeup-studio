import type { InventoryItem } from '../types';
import { isHeadshot, type Pt } from './faceMesh';

/** Face-oval indices, used as a fan so makeup stays inside the contour. */
const OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

const FEATURE_TRIS: [number, number, number][] = [
  [33, 133, 159],
  [33, 133, 145],
  [263, 362, 386],
  [263, 362, 374],
  [70, 63, 105],
  [105, 66, 107],
  [300, 293, 334],
  [334, 296, 336],
  [61, 291, 0],
  [61, 291, 17],
  [61, 146, 91],
  [291, 375, 321],
];

type Layout = {
  width: number;
  height: number;
  scale: number;
  ox: number;
  oy: number;
  simulated: boolean;
  chin: Pt;
  forehead: Pt;
  leftEar: Pt;
  rightEar: Pt;
  cx: number;
  headW: number;
  shoulderY: number;
  shoulderW: number;
  hemY: number;
};

export async function paintTryOn(
  canvas: HTMLCanvasElement,
  userImg: HTMLImageElement,
  userLm: Pt[],
  workImg: HTMLImageElement | null,
  workLm: Pt[] | null,
  clothingImg: HTMLImageElement | null,
  clothingLm: Pt[] | null,
  accessories: InventoryItem[],
  accessoryImages: HTMLImageElement[],
  makeupOpacity: number,
  clothingOpacity: number,
): Promise<{ simulated: boolean }> {
  const simulated = isHeadshot(userImg, userLm);
  const layout = simulated ? layoutHeadshot(userImg, userLm) : layoutPhoto(userImg, userLm);
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { simulated };

  ctx.clearRect(0, 0, layout.width, layout.height);
  if (simulated) {
    drawStudio(ctx, layout);
    drawBody(ctx, layout, skinColor(userImg, userLm));
    drawHead(ctx, userImg, layout);
  } else {
    ctx.drawImage(userImg, layout.ox, layout.oy, userImg.naturalWidth * layout.scale, userImg.naturalHeight * layout.scale);
  }

  if (workImg && workLm) {
    paintMakeup(ctx, workImg, workLm, userLm, layout, makeupOpacity);
  }

  if (clothingImg) {
    paintGarment(ctx, clothingImg, clothingLm, layout, clothingOpacity);
  }

  accessories.forEach((item, index) => {
    const img = accessoryImages[index];
    if (img) paintAccessory(ctx, item, img, layout);
  });

  return { simulated };
}

function layoutPhoto(img: HTMLImageElement, lm: Pt[]): Layout {
  const maxW = 720;
  const scale = Math.min(1, maxW / img.naturalWidth);
  return finishLayout(img.naturalWidth * scale, img.naturalHeight * scale, scale, 0, 0, false, lm);
}

function layoutHeadshot(_img: HTMLImageElement, lm: Pt[]): Layout {
  const left = lm[234];
  const right = lm[454];
  const forehead = lm[10];
  const chin = lm[152];
  const faceW = Math.max(8, Math.hypot(right.x - left.x, right.y - left.y));
  const headH = Math.max(8, chin.y - forehead.y);
  const width = 720;
  const destFaceW = width * 0.34;
  const scale = destFaceW / faceW;
  const srcCx = (left.x + right.x) / 2;
  const ox = width / 2 - srcCx * scale;
  const destChin = 250;
  const oy = destChin - chin.y * scale;
  const height = Math.round(destChin + headH * scale * 4.15);
  return finishLayout(width, height, scale, ox, oy, true, lm);
}

function finishLayout(
  width: number,
  height: number,
  scale: number,
  ox: number,
  oy: number,
  simulated: boolean,
  lm: Pt[],
): Layout {
  const map = (p: Pt) => ({ x: p.x * scale + ox, y: p.y * scale + oy });
  const forehead = map(lm[10]);
  const chin = map(lm[152]);
  const leftEar = map(lm[234]);
  const rightEar = map(lm[454]);
  const cx = (leftEar.x + rightEar.x) / 2;
  const headW = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y);
  const shoulderY = chin.y + headW * (simulated ? 0.22 : 0.38);
  const shoulderW = headW * 2.25;
  const hemY = simulated
    ? Math.min(height * 0.96, shoulderY + headW * 4.6)
    : Math.min(height * 0.98, shoulderY + headW * 3.4);
  return {
    width: Math.round(width),
    height: Math.round(height),
    scale,
    ox,
    oy,
    simulated,
    chin,
    forehead,
    leftEar,
    rightEar,
    cx,
    headW,
    shoulderY,
    shoulderW,
    hemY,
  };
}

function drawStudio(ctx: CanvasRenderingContext2D, layout: Layout) {
  const g = ctx.createLinearGradient(0, 0, 0, layout.height);
  g.addColorStop(0, '#f6ebe6');
  g.addColorStop(0.45, '#e7d5cf');
  g.addColorStop(1, '#cbb6b0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, layout.width, layout.height);
}

function drawBody(ctx: CanvasRenderingContext2D, layout: Layout, skin: string) {
  const { cx, chin, headW, shoulderY, shoulderW, hemY } = layout;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(cx - headW * 0.22, chin.y - headW * 0.18);
  ctx.quadraticCurveTo(cx - headW * 0.28, shoulderY, cx - shoulderW * 0.42, shoulderY);
  ctx.lineTo(cx + shoulderW * 0.42, shoulderY);
  ctx.quadraticCurveTo(cx + headW * 0.28, shoulderY, cx + headW * 0.22, chin.y - headW * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shade(skin, -18);
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW / 2, shoulderY);
  ctx.quadraticCurveTo(cx - shoulderW * 0.46, (shoulderY + hemY) / 2, cx - shoulderW * 0.32, hemY);
  ctx.lineTo(cx + shoulderW * 0.32, hemY);
  ctx.quadraticCurveTo(cx + shoulderW * 0.46, (shoulderY + hemY) / 2, cx + shoulderW / 2, shoulderY);
  ctx.closePath();
  ctx.fill();

  const armW = headW * 0.28;
  ctx.fillStyle = skin;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(
      cx + side * shoulderW * 0.52,
      shoulderY + headW * 1.15,
      armW * 0.55,
      headW * 1.15,
      side * 0.08,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawHead(ctx: CanvasRenderingContext2D, img: HTMLImageElement, layout: Layout) {
  const headH = layout.chin.y - layout.forehead.y;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    layout.cx,
    layout.forehead.y + headH * 0.46,
    layout.headW * 1.2,
    headH * 0.98,
    0,
    0,
    Math.PI * 2,
  );
  ctx.clip();
  ctx.drawImage(
    img,
    layout.ox,
    layout.oy,
    img.naturalWidth * layout.scale,
    img.naturalHeight * layout.scale,
  );
  ctx.restore();
}

function paintMakeup(
  ctx: CanvasRenderingContext2D,
  workImg: HTMLImageElement,
  workLm: Pt[],
  userLm: Pt[],
  layout: Layout,
  opacity: number,
) {
  const layer = document.createElement('canvas');
  layer.width = layout.width;
  layer.height = layout.height;
  const lctx = layer.getContext('2d');
  if (!lctx) return;
  const tris = ovalFan().concat(FEATURE_TRIS);
  for (const [a, b, c] of tris) {
    const s0 = workLm[a];
    const s1 = workLm[b];
    const s2 = workLm[c];
    const d0 = mapPt(userLm[a], layout);
    const d1 = mapPt(userLm[b], layout);
    const d2 = mapPt(userLm[c], layout);
    if (s0 && s1 && s2 && d0 && d1 && d2) {
      drawTriangle(lctx, workImg, s0, s1, s2, d0, d1, d2);
    }
  }
  ctx.save();
  ctx.globalAlpha = opacity * 0.85;
  ctx.globalCompositeOperation = 'soft-light';
  ctx.drawImage(layer, 0, 0);
  ctx.restore();

  const features = document.createElement('canvas');
  features.width = layout.width;
  features.height = layout.height;
  const fctx = features.getContext('2d');
  if (!fctx) return;
  for (const [a, b, c] of FEATURE_TRIS) {
    const s0 = workLm[a];
    const s1 = workLm[b];
    const s2 = workLm[c];
    const d0 = mapPt(userLm[a], layout);
    const d1 = mapPt(userLm[b], layout);
    const d2 = mapPt(userLm[c], layout);
    if (s0 && s1 && s2 && d0 && d1 && d2) {
      drawTriangle(fctx, workImg, s0, s1, s2, d0, d1, d2);
    }
  }
  ctx.save();
  ctx.globalAlpha = Math.min(1, opacity);
  ctx.drawImage(features, 0, 0);
  ctx.restore();
}

function paintGarment(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  lm: Pt[] | null,
  layout: Layout,
  opacity: number,
) {
  const { cx, shoulderY, shoulderW, hemY, chin } = layout;
  const destX = cx - shoulderW / 2;
  const destY = Math.max(chin.y + 2, shoulderY - shoulderW * 0.05);
  const destW = shoulderW;
  const destH = Math.max(20, hemY - destY);
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (lm?.[152] && lm[234] && lm[454]) {
    const chinY = lm[152].y;
    const left = Math.min(lm[234].x, lm[454].x);
    const right = Math.max(lm[234].x, lm[454].x);
    const faceW = Math.max(8, right - left);
    const mid = (left + right) / 2;
    sx = clamp(mid - faceW * 1.35, 0, img.naturalWidth - 8);
    sw = clamp(faceW * 2.7, 8, img.naturalWidth - sx);
    sy = clamp(chinY + faceW * 0.05, 0, img.naturalHeight - 8);
    sh = img.naturalHeight - sy;
  } else {
    sy = img.naturalHeight * 0.46;
    sh = img.naturalHeight - sy;
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(destX, destY + destH * 0.06);
  ctx.quadraticCurveTo(cx, destY + destH * 0.14, destX + destW, destY + destH * 0.06);
  ctx.lineTo(destX + destW * 0.94, destY + destH);
  ctx.lineTo(destX + destW * 0.06, destY + destH);
  ctx.closePath();
  ctx.clip();
  ctx.globalAlpha = opacity;
  ctx.drawImage(img, sx, sy, sw, sh, destX, destY, destW, destH);
  ctx.restore();
}

function paintAccessory(
  ctx: CanvasRenderingContext2D,
  item: InventoryItem,
  img: HTMLImageElement,
  layout: Layout,
) {
  const size = layout.headW * 0.42;
  if (/耳|钉|环/.test(item.name)) {
    stamp(ctx, img, layout.leftEar.x - size * 0.2, layout.leftEar.y, size * 0.55);
    stamp(ctx, img, layout.rightEar.x - size * 0.35, layout.rightEar.y, size * 0.55);
    return;
  }
  if (/发|夹|冠|假发/.test(item.name) || item.category === '假发') {
    stamp(ctx, img, layout.cx - size * 0.7, layout.forehead.y - size * 0.55, size * 1.4);
    return;
  }
  stamp(ctx, img, layout.cx + layout.shoulderW * 0.28, layout.shoulderY, size);
}

function stamp(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
  if (!img.naturalWidth) return;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

function ovalFan(): [number, number, number][] {
  const tris: [number, number, number][] = [];
  for (let i = 0; i < OVAL.length; i++) {
    tris.push([1, OVAL[i], OVAL[(i + 1) % OVAL.length]]);
  }
  return tris;
}

function mapPt(p: Pt | undefined, layout: Layout): Pt | null {
  if (!p) return null;
  return { x: p.x * layout.scale + layout.ox, y: p.y * layout.scale + layout.oy };
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  s0: Pt,
  s1: Pt,
  s2: Pt,
  d0: Pt,
  d1: Pt,
  d2: Pt,
) {
  const denom = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denom) < 0.01) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denom;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denom;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denom;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denom;
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function skinColor(img: HTMLImageElement, lm: Pt[]): string {
  const sample = document.createElement('canvas');
  sample.width = img.naturalWidth;
  sample.height = img.naturalHeight;
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '#e6c2b0';
  ctx.drawImage(img, 0, 0);
  const cheek = lm[50] ?? lm[1];
  const x = clamp(Math.round(cheek.x), 0, img.naturalWidth - 1);
  const y = clamp(Math.round(cheek.y), 0, img.naturalHeight - 1);
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
}

function shade(rgb: string, delta: number): string {
  const nums = rgb.match(/\d+/g)?.map(Number) ?? [210, 180, 165];
  const next = nums.map((n) => clamp(n + delta, 0, 255));
  return `rgb(${next[0]}, ${next[1]}, ${next[2]})`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
