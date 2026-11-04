/** 浏览器端启发式还原度对比：色调直方图 + 亮度 + 粗略结构相似度 */

export interface RestorationScoreResult {
  score: number;
  summary: string;
  details: string[];
  colorScore: number;
  brightnessScore: number;
  structureScore: number;
}

const SIZE = 64;
const BINS = 16;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

function samplePixels(dataUrl: string): Promise<{
  hist: Float32Array;
  brightness: number;
  warmth: number;
  gray: Float32Array;
}> {
  return loadImage(dataUrl).then((img) => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

    const hist = new Float32Array(BINS * 3);
    const gray = new Float32Array(SIZE * SIZE);
    let brightSum = 0;
    let warmSum = 0;
    let count = 0;

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 16) {
        gray[p] = 0;
        continue;
      }
      // 用 R/G/B 三段直方图
      hist[Math.min(BINS - 1, Math.floor((r / 256) * BINS))] += 1;
      hist[BINS + Math.min(BINS - 1, Math.floor((g / 256) * BINS))] += 1;
      hist[BINS * 2 + Math.min(BINS - 1, Math.floor((b / 256) * BINS))] += 1;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[p] = lum;
      brightSum += lum;
      warmSum += r - b;
      count++;
    }

    // 归一化直方图
    const total = Math.max(1, count);
    for (let i = 0; i < hist.length; i++) hist[i] /= total;

    return {
      hist,
      brightness: brightSum / total,
      warmth: warmSum / total,
      gray,
    };
  });
}

function histSimilarity(a: Float32Array, b: Float32Array): number {
  // Bhattacharyya 系数 → 0–1
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.sqrt(a[i] * b[i]);
  }
  return Math.max(0, Math.min(1, sum / 3)); // 三段各约 1，除以 3
}

function structureSimilarity(a: Float32Array, b: Float32Array): number {
  // 归一化互相关 + 平均绝对差混合
  let meanA = 0;
  let meanB = 0;
  const n = a.length;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  let mad = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
    mad += Math.abs(a[i] - b[i]);
  }
  const ncc =
    denA > 1e-6 && denB > 1e-6 ? num / Math.sqrt(denA * denB) : 0;
  const ncc01 = (ncc + 1) / 2; // -1..1 → 0..1
  const mad01 = 1 - Math.min(1, mad / n / 128); // 亮度差越大越低
  return Math.max(0, Math.min(1, ncc01 * 0.55 + mad01 * 0.45));
}

function clampScore(x: number): number {
  return Math.round(Math.max(0, Math.min(100, x)));
}

function buildComments(
  score: number,
  colorScore: number,
  brightnessScore: number,
  structureScore: number,
  warmDiff: number,
  brightDiff: number,
): { summary: string; details: string[] } {
  const details: string[] = [];

  if (colorScore >= 85) details.push('色调直方图高度接近，妆造主色与参考图一致感强。');
  else if (colorScore >= 70) details.push('整体色调较接近，局部妆色可再微调对齐参考。');
  else if (colorScore >= 55) details.push('色调有一定偏差，建议对照参考图核对唇色/眼影色系。');
  else details.push('色调差异较明显，还原时优先对齐主色与妆面冷暖。');

  if (brightnessScore >= 85 && Math.abs(brightDiff) < 12) {
    details.push('明度接近，底妆与光线氛围较统一。');
  } else if (brightDiff > 0) {
    details.push('实拍偏亮于参考，可检查是否过白或闪光过强。');
  } else if (brightDiff < -12) {
    details.push('实拍偏暗于参考，可适当提亮或调整拍摄光线。');
  } else {
    details.push(`明度/冷暖综合分 ${brightnessScore}，光线氛围基本可用。`);
  }

  if (Math.abs(warmDiff) < 18) details.push('冷暖倾向接近参考造型。');
  else if (warmDiff > 0) details.push('实拍偏暖，若参考偏冷可减弱暖调腮红/修容。');
  else details.push('实拍偏冷，若参考偏暖可略增暖色点缀。');

  if (structureScore >= 80) details.push('明暗结构与轮廓走势接近，整体风格还原度高。');
  else if (structureScore >= 60) details.push('结构大致相符，眼妆轮廓或发型层次可再贴近参考。');
  else details.push('结构相似度一般（姿态/构图差异也会拉低分数），请以妆面细节为准。');

  let summary: string;
  if (score >= 90) summary = '还原度极高，成片与试妆方案几乎一致，可直接存档。';
  else if (score >= 80) summary = '还原度优秀，整体风格与色调都很接近试妆/推荐造型。';
  else if (score >= 70) summary = '还原度良好，主色与氛围到位，少量细节可再精修。';
  else if (score >= 55) summary = '还原度中等，建议对照参考图微调色调或妆面重点。';
  else summary = '还原度偏低，可能构图差异大或妆造偏离方案，建议复核对齐。';

  return { summary, details };
}

/** 对比实拍与参考造型图，返回 0–100 还原度 */
export async function compareRestoration(
  photoDataUrl: string,
  referenceDataUrl: string,
): Promise<RestorationScoreResult> {
  const [photo, ref] = await Promise.all([
    samplePixels(photoDataUrl),
    samplePixels(referenceDataUrl),
  ]);

  const colorSim = histSimilarity(photo.hist, ref.hist);
  const structSim = structureSimilarity(photo.gray, ref.gray);

  const brightDiff = photo.brightness - ref.brightness;
  const warmDiff = photo.warmth - ref.warmth;
  // 亮度/冷暖差异映射到分数
  const brightSim = Math.max(0, 1 - Math.abs(brightDiff) / 90);
  const warmSim = Math.max(0, 1 - Math.abs(warmDiff) / 80);
  const brightnessSim = brightSim * 0.65 + warmSim * 0.35;

  const colorScore = clampScore(colorSim * 100);
  const brightnessScore = clampScore(brightnessSim * 100);
  const structureScore = clampScore(structSim * 100);

  // 加权总分：色调最重要，其次结构，再次明度
  const raw =
    colorSim * 0.42 + structSim * 0.33 + brightnessSim * 0.25;
  const score = clampScore(raw * 100);

  const { summary, details } = buildComments(
    score,
    colorScore,
    brightnessScore,
    structureScore,
    warmDiff,
    brightDiff,
  );

  return {
    score,
    summary,
    details,
    colorScore,
    brightnessScore,
    structureScore,
  };
}
