import type { FaceShape, FeatureAnalysis, SkinTone } from '../types';

/** 浏览器端启发式五官/肤色分析（演示用，非医学级/专业级 AI） */
export async function analyzeFaceImage(
  dataUrl: string,
): Promise<FeatureAnalysis> {
  const img = await loadImage(dataUrl);
  const { width, height } = img;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  // 取画面中部偏上区域作为“脸部兴趣区”
  const x0 = Math.floor(width * 0.25);
  const x1 = Math.floor(width * 0.75);
  const y0 = Math.floor(height * 0.15);
  const y1 = Math.floor(height * 0.7);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let brightSum = 0;
  let count = 0;
  const luminances: number[] = [];

  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 128) continue;
      // 粗略肤色过滤
      if (r > 60 && g > 40 && b > 30 && r > b && r > g - 20) {
        rSum += r;
        gSum += g;
        bSum += b;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        brightSum += lum;
        luminances.push(lum);
        count++;
      }
    }
  }

  if (count < 50) {
    // 回退：用整图中心区
    for (let y = y0; y < y1; y += 3) {
      for (let x = x0; x < x1; x += 3) {
        const i = (y * width + x) * 4;
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        brightSum += lum;
        luminances.push(lum);
        count++;
      }
    }
  }

  const rAvg = rSum / count;
  const gAvg = gSum / count;
  const bAvg = bSum / count;
  const brightness = brightSum / count;
  const warmth = rAvg - bAvg;
  const contrast = stdDev(luminances);

  const aspect = width / height;
  const faceShape = guessFaceShape(aspect, contrast);
  const skinTone = guessSkinTone(rAvg, gAvg, bAvg, brightness, warmth);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const directions: string[] = [];

  if (brightness > 170) {
    strengths.push('肤色整体偏亮，底妆可走清透水光路线');
  } else if (brightness < 110) {
    strengths.push('肤色有深度，适合立体修容与高级感妆容');
  } else {
    strengths.push('明度适中，淡妆与晚宴妆都有较大发挥空间');
  }

  if (warmth > 35) {
    strengths.push('暖调肤色，豆沙、橘调、正红唇都较易显气色');
    directions.push('优先暖调腮红与珊瑚/豆沙唇');
  } else if (warmth < 10) {
    strengths.push('冷调倾向，适合玫瑰粉、梅子色与冷雾唇');
    directions.push('优先冷粉腮红与玫瑰/梅子唇');
  } else {
    strengths.push('中性肤色，色彩适配面广');
    directions.push('可按场合在冷暖色之间灵活切换');
  }

  if (contrast > 45) {
    strengths.push('五官明暗对比清晰，眼妆可适度加深');
  } else {
    directions.push('可用鼻影/眉形/睫毛增强立体感');
  }

  switch (faceShape) {
    case '圆脸':
      weaknesses.push('脸部轮廓偏圆，大面积腮红易显更圆');
      directions.push('修容收窄两侧，腮红上提，眉形略挑');
      strengths.push('亲和感强，甜美系妆容很加分');
      break;
    case '方脸':
      weaknesses.push('下颌线条偏方，过重下眼影可能更显硬朗');
      directions.push('柔和腮红晕染，眉峰圆润，唇形略圆');
      strengths.push('气场足，适合冷淡高级与欧美立体妆');
      break;
    case '长脸':
      weaknesses.push('纵向比例偏长，过高眉峰或过长眼线会拉长脸型');
      directions.push('腮红横向铺开，避免过高发际装饰');
      strengths.push('适合新娘妆与复古红唇的纵向焦点');
      break;
    case '心形脸':
      weaknesses.push('下巴偏尖时，过重下唇线可能更显尖');
      directions.push('额头两侧轻柔阴影，下巴轻扫高光');
      strengths.push('上庭饱满，适合韩系甜美与精致眼妆');
      break;
    case '菱形脸':
      weaknesses.push('颧骨偏高时，过强高光需控制范围');
      directions.push('颧骨下方轻修容，眼妆向外延展');
      strengths.push('立体感好，适合烟熏与派对妆');
      break;
    default:
      strengths.push('接近鹅蛋脸比例，大多数妆容兼容性高');
      directions.push('按场合选风格即可，无需过度修正脸型');
      break;
  }

  if (brightness > 190) {
    weaknesses.push('过亮区域可能反光，拍照时注意控油与柔焦底妆');
  }
  if (contrast < 25) {
    weaknesses.push('对比偏弱时，淡妆容易“没妆感”，建议加强眉睫');
  }

  const confidence = Math.min(
    0.92,
    0.55 + Math.min(count / 5000, 0.25) + (contrast > 20 ? 0.08 : 0),
  );

  return {
    faceShape,
    skinTone,
    strengths: unique(strengths).slice(0, 4),
    weaknesses: unique(weaknesses).slice(0, 3),
    directions: unique(directions).slice(0, 4),
    brightness: Math.round(brightness),
    warmth: Math.round(warmth),
    contrast: Math.round(contrast),
    confidence,
  };
}

function guessFaceShape(aspect: number, contrast: number): FaceShape {
  if (aspect > 0.95) return contrast > 40 ? '方脸' : '圆脸';
  if (aspect < 0.72) return '长脸';
  if (aspect < 0.82 && contrast > 48) return '菱形脸';
  if (aspect < 0.85) return '心形脸';
  return '鹅蛋脸';
}

function guessSkinTone(
  r: number,
  g: number,
  b: number,
  brightness: number,
  warmth: number,
): SkinTone {
  if (brightness < 100) return '深肤色';
  if (warmth > 40 && r > g + 10) return brightness > 160 ? '暖白皮' : '暖黄皮';
  if (warmth < 15 && b >= g - 5) return '冷白皮';
  if (brightness > 165) return '暖白皮';
  return '自然中性';
}

function stdDev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v =
    values.reduce((acc, x) => acc + (x - mean) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

/** 可选：未来接入真实人脸 AI 的占位接口 */
export async function analyzeFaceWithExternalAI(
  _dataUrl: string,
  apiKey?: string,
): Promise<FeatureAnalysis | null> {
  if (!apiKey) return null;
  // 占位：接入付费/第三方视觉 API 时在此实现
  console.info('[占位] 外部 AI 分析未配置，回退本地启发式');
  return null;
}
