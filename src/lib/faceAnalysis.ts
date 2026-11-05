import type {
  AnalysisCues,
  FaceShape,
  FacialFeatureNote,
  FeatureAnalysis,
  FeatureVerdict,
  SkinTone,
} from '../types';

type Stat = {
  n: number;
  r: number;
  g: number;
  b: number;
  lum: number;
  contrast: number;
  redness: number;
};

const EMPTY: Stat = { n: 0, r: 0, g: 0, b: 0, lum: 0, contrast: 0, redness: 0 };

/**
 * 浏览器端启发式五官分析：按正脸照片分区取样（眼、眉、鼻、唇、轮廓、肤色）。
 * 不是人脸关键点模型，结论只作妆造沟通参考。
 */
export async function analyzeFaceImage(
  dataUrl: string,
): Promise<FeatureAnalysis> {
  const img = await loadImage(dataUrl);
  const width = img.width;
  const height = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  const skinBox = findSkinBox(data, width, height);
  const usedSkinMask = skinBox.count >= 120 && skinBox.w > width * 0.12 && skinBox.h > height * 0.18;
  const box = usedSkinMask
    ? skinBox
    : {
        x: Math.floor(width * 0.22),
        y: Math.floor(height * 0.12),
        w: Math.floor(width * 0.56),
        h: Math.floor(height * 0.7),
        count: 0,
      };

  const forehead = sampleRect(data, width, height, box, 0.22, 0.04, 0.78, 0.2, usedSkinMask);
  const brow = sampleRect(data, width, height, box, 0.16, 0.18, 0.84, 0.34, false);
  const eye = sampleRect(data, width, height, box, 0.1, 0.28, 0.9, 0.48, false);
  const eyeL = sampleRect(data, width, height, box, 0.08, 0.28, 0.46, 0.48, false);
  const eyeR = sampleRect(data, width, height, box, 0.54, 0.28, 0.92, 0.48, false);
  const nose = sampleRect(data, width, height, box, 0.38, 0.4, 0.62, 0.7, false);
  const cheekL = sampleRect(data, width, height, box, 0.08, 0.42, 0.34, 0.68, usedSkinMask);
  const cheekR = sampleRect(data, width, height, box, 0.66, 0.42, 0.92, 0.68, usedSkinMask);
  const cheek = mergeStat(cheekL, cheekR);
  const lips = sampleRect(data, width, height, box, 0.32, 0.68, 0.68, 0.84, false);
  const skin = cheek.n > 40 ? cheek : sampleRect(data, width, height, box, 0.2, 0.2, 0.8, 0.75, false);

  const foreheadW = spanAt(data, width, box, 0.18, usedSkinMask);
  const cheekW = spanAt(data, width, box, 0.5, usedSkinMask);
  const jawW = spanAt(data, width, box, 0.74, usedSkinMask);
  const faceRatio = box.h / Math.max(1, box.w);
  const faceShape = guessFaceShape(foreheadW, cheekW, jawW, faceRatio, jawContrast(data, width, box));

  const brightness = skin.lum || 128;
  const warmth = skin.n ? skin.r - skin.b : 0;
  const skinTone = guessSkinTone(skin.r, skin.g, skin.b, brightness, warmth);
  const eyeDelta = (cheek.lum || skin.lum) - eye.lum;
  const eyeAsymmetry = Math.abs(eyeL.lum - eyeR.lum);
  const noseHighlight = nose.lum - (cheek.lum || skin.lum);
  const lipRedness = lips.redness - (cheek.redness || skin.redness);
  const noseWidth = brightColumnWidth(data, width, box, nose.lum, cheek.lum || skin.lum);
  const proportions = measureProportions(
    data,
    width,
    box,
    cheek.lum || skin.lum,
    forehead.lum || cheek.lum || skin.lum,
    cheek.redness || skin.redness,
  );

  const cues: AnalysisCues = {
    eyeDelta: round(eyeDelta),
    eyeContrast: round(eye.contrast),
    eyeAsymmetry: round(eyeAsymmetry),
    eyeWidth: proportions.eyeWidth,
    browContrast: round(brow.contrast),
    browWidth: proportions.browWidth,
    noseHighlight: round(noseHighlight),
    noseWidth: Math.round(noseWidth * 100) / 100,
    lipRedness: round(lipRedness),
    lipWidth: proportions.lipWidth,
    lipHeight: proportions.lipHeight,
    faceRatio: Math.round(faceRatio * 100) / 100,
    foreheadWidth: Math.round(foreheadW * 100) / 100,
    cheekWidth: Math.round(cheekW * 100) / 100,
    jawWidth: Math.round(jawW * 100) / 100,
    upperShare: proportions.upperShare,
    midShare: proportions.midShare,
    lowerShare: proportions.lowerShare,
    usedSkinMask,
  };

  const featureDetails = buildDetails({
    cues,
    faceShape,
    skinTone,
    eye,
    brow,
    forehead,
    nose,
    lips,
    skin,
    cheek,
  });
  const { strengths, weaknesses, directions, verdicts } = buildAdvice(
    cues,
    faceShape,
    skinTone,
    round(brightness),
  );
  const summary = buildSummary(cues, faceShape, skinTone, brightness, warmth, featureDetails);

  const confidence = Math.min(
    0.9,
    (usedSkinMask ? 0.72 : 0.56) +
      Math.min(skin.n / 8000, 0.1) +
      (eye.n > 30 ? 0.05 : 0),
  );

  return {
    faceShape,
    skinTone,
    strengths,
    weaknesses,
    directions,
    summary,
    featureDetails,
    cues,
    verdicts,
    brightness: round(brightness),
    warmth: round(warmth),
    contrast: round(skin.contrast || eye.contrast),
    confidence,
  };
}

function buildSummary(
  cues: AnalysisCues,
  faceShape: FaceShape,
  skinTone: SkinTone,
  brightness: number,
  warmth: number,
  details: FacialFeatureNote[],
): string {
  const source = cues.usedSkinMask
    ? '已从照片里分离出一块肤色区域，再按这块区域的上下左右分区读取'
    : '照片里稳定的肤色像素偏少，下面按画面中心估计，建议换一张正脸、光线均匀的照片再看一次';
  const lead = details.find((d) => d.part === '眼')?.text.split('。')[0] ?? '眼部对比已记录';
  return `${source}。轮廓倾向${faceShape}（${contourMeasurePhrase(cues)}）。肤色参考${skinTone}，面颊明度 ${round(brightness)}，红蓝差 ${round(warmth)}（正数偏暖）。${lead}。`;
}

function buildDetails(input: {
  cues: AnalysisCues;
  faceShape: FaceShape;
  skinTone: SkinTone;
  eye: Stat;
  brow: Stat;
  forehead: Stat;
  nose: Stat;
  lips: Stat;
  skin: Stat;
  cheek: Stat;
}): FacialFeatureNote[] {
  const { cues, faceShape, skinTone, eye, brow, forehead, nose, lips, skin, cheek } = input;
  const cheekLum = cheek.lum || skin.lum;
  return [
    { part: '眼', text: eyeText(cues, eye, cheekLum) },
    { part: '眉', text: browText(cues, brow, forehead) },
    { part: '鼻', text: noseText(cues, nose, cheekLum) },
    { part: '唇', text: lipText(cues, lips, cheek) },
    { part: '轮廓', text: contourText(cues, faceShape) },
    { part: '肤色', text: skinText(skinTone, skin, cheek) },
  ];
}

function eyeText(cues: AnalysisCues, eye: Stat, cheekLum: number): string {
  if (eye.n < 8) return '眼区像素太少，分不出眼睛。请换一张五官更清楚的正脸。';
  const asym =
    cues.eyeAsymmetry > 18
      ? `左右眼区明度差约 ${cues.eyeAsymmetry}，一侧更深，眼妆要注意对称。`
      : `左右眼区明度接近，差约 ${cues.eyeAsymmetry}。`;
  const delta = cues.eyeDelta;
  if (delta > 35) {
    return `眼区比面颊暗约 ${delta}（眼区明度 ${round(eye.lum)}，面颊 ${round(cheekLum)}），眼神对比偏强，深色眼影和睫毛会更显眼。眼区内部对比约 ${cues.eyeContrast}。${asym}`;
  }
  if (delta > 14) {
    return `眼区比面颊略暗，相差约 ${delta}（眼区 ${round(eye.lum)}，面颊 ${round(cheekLum)}），有一点自然眼窝。细眼线和适中睫毛就够，不必铺满烟熏。眼区对比约 ${cues.eyeContrast}。${asym}`;
  }
  return `眼区和面颊明度接近，只差约 ${delta}（眼区 ${round(eye.lum)}，面颊 ${round(cheekLum)}），眼神偏柔，淡妆容易看不出眼睛。可以用眉睫把眼睛提出来。眼区对比约 ${cues.eyeContrast}。${asym}`;
}

function browText(cues: AnalysisCues, brow: Stat, forehead: Stat): string {
  if (brow.n < 8) return '眉区取样不足，眉形先不判断。';
  const gap = round((forehead.lum || brow.lum) - brow.lum);
  if (gap > 45) {
    return `眉区比额头暗约 ${gap}，对比 ${cues.browContrast}。差值很大，多半是深色眉毛或刘海落在这条带里。画眉顺着现有深色修齐，不要再加粗一层。`;
  }
  if (cues.browContrast > 32 || gap > 18) {
    return `眉区对比约 ${cues.browContrast}，比额头暗约 ${Math.max(0, gap)}。眉色已经比较清楚，画眉宜顺着原眉峰修整齐，不要再加粗一截。`;
  }
  if (cues.browContrast < 16 && gap < 8) {
    return `眉区对比只有约 ${cues.browContrast}，和额头几乎连在一起（明度差 ${gap}）。眉色偏淡，淡妆会显得没精神，建议先把眉头到眉峰补出一条浅色。`;
  }
  return `眉区对比约 ${cues.browContrast}，和额头相差约 ${gap}。眉形中等，日常用眉粉补稀疏处即可，眉峰不必画得很高。`;
}

function noseText(cues: AnalysisCues, nose: Stat, cheekLum: number): string {
  if (nose.n < 8) return '鼻梁区域取样不足。';
  const widthNote =
    cues.noseWidth > 0.3
      ? `鼻中亮部大约占脸宽的 ${pct(cues.noseWidth)}，看起来偏宽，鼻影可以收在两侧。`
      : cues.noseWidth > 0 && cues.noseWidth < 0.1
        ? `鼻中亮部大约只占脸宽的 ${pct(cues.noseWidth)}，看起来偏窄，高光点到鼻尖即可。`
        : `鼻中亮部约占脸宽 ${pct(cues.noseWidth)}，宽窄中等。`;
  if (cues.noseHighlight > 12) {
    return `鼻梁比面颊亮约 ${cues.noseHighlight}（鼻区明度 ${round(nose.lum)}，面颊 ${round(cheekLum)}），山根到鼻尖已经有高光。${widthNote}`;
  }
  if (cues.noseHighlight < -6) {
    return `鼻梁并不比面颊亮（差值 ${cues.noseHighlight}），立体感主要不在鼻子上。若要做修容，高光只点鼻梁中线，不要涂宽。${widthNote}`;
  }
  return `鼻梁和面颊明度接近（差值 ${cues.noseHighlight}）。${widthNote}`;
}

function lipText(cues: AnalysisCues, lips: Stat, cheek: Stat): string {
  if (lips.n < 8) return '唇部取样不足，唇色先不判断。';
  const cheekRed = cheek.redness || 0;
  if (cues.lipRedness > 12) {
    return `唇区比面颊更红，红差约 ${cues.lipRedness}（唇区红度 ${round(lips.redness)}，面颊 ${round(cheekRed)}）。唇色本身明显，正红、豆沙都容易显色，注意唇线和嘴角干净。`;
  }
  if (cues.lipRedness < 2) {
    return `唇色相对含蓄，和面颊的红差约 ${cues.lipRedness}（唇区 ${round(lips.redness)}，面颊 ${round(cheekRed)}）。裸唇会偏淡，想有气色需要把唇色补上一档。`;
  }
  return `唇色自然，比面颊略红约 ${cues.lipRedness}。日常用接近本唇色的豆沙或珊瑚即可，浓红唇要先遮住原唇色再叠。`;
}

function contourText(cues: AnalysisCues, faceShape: FaceShape): string {
  const measure = `${contourMeasurePhrase(cues)}。`;
  switch (faceShape) {
    case '圆脸':
      return `${measure}额头、颧骨、下颌宽度接近，而且脸偏短，轮廓读作圆脸。腮红不要横着铺满，修容收在两侧，眉峰可以略挑。`;
    case '方脸':
      return `${measure}下颌和颧骨宽度接近，边角对比清楚，轮廓读作方脸。腮红晕圆一点，眉峰不要画成直角，唇峰可以柔一点。`;
    case '长脸':
      return `${measure}纵向明显长于宽度，轮廓读作长脸。腮红横向展开，眉峰不要再拔高，发饰也别堆在头顶。`;
    case '心形脸':
      return `${measure}额头宽于下颌，下巴收得比较快，轮廓读作心形脸。额头两侧可以轻扫阴影，下巴用一点高光，不要把下唇线画得很尖。`;
    case '菱形脸':
      return `${measure}颧骨宽于额头和下颌，轮廓读作菱形脸。高光别打满颧骨，眼妆可以往外带一点，让视线横向拉开。`;
    default:
      return `${measure}额、颧、下颌过渡比较匀，纵向也不夸张，轮廓接近鹅蛋脸。多数妆容都能接，按场合选风格即可。`;
  }
}

function skinText(skinTone: SkinTone, skin: Stat, cheek: Stat): string {
  const warmth = round(skin.r - skin.b);
  const cheekNote =
    cheek.n > 20
      ? `左右面颊取样 ${cheek.n} 个点，面颊对比约 ${round(cheek.contrast)}。`
      : '面颊肤色点偏少，肤色判断主要来自画面中心。';
  const toneLine =
    skinTone === '冷白皮'
      ? '底色偏冷，玫瑰粉、梅子色比橘色更干净。'
      : skinTone === '暖白皮'
        ? '底色亮且偏暖，珊瑚色、豆沙、浅橘都容易有气色。'
        : skinTone === '暖黄皮'
          ? '底色暖、明度没那么高，橘调腮红和豆沙唇比冷粉更贴。'
          : skinTone === '深肤色'
            ? '肤色有深度，金调和清晰修容会比把脸提成白皮更自然。'
            : '冷暖居中，场合需要时冷粉或暖橘都可以。';
  return `面颊平均明度 ${round(skin.lum)}，红 ${round(skin.r)} / 绿 ${round(skin.g)} / 蓝 ${round(skin.b)}，红蓝差 ${warmth}，肤色区内对比约 ${round(skin.contrast)}。${cheekNote}参考判断为${skinTone}。${toneLine}`;
}

function buildAdvice(
  cues: AnalysisCues,
  faceShape: FaceShape,
  skinTone: SkinTone,
  brightness: number,
): {
  strengths: string[];
  weaknesses: string[];
  directions: string[];
  verdicts: FeatureVerdict[];
} {
  const verdicts: FeatureVerdict[] = [];

  if (cues.eyeDelta >= 22) {
    verdicts.push({
      aim: '优点',
      part: '眼',
      text: `眼神对比强：眼区比面颊暗 ${cues.eyeDelta}，眼宽约占脸宽 ${pct(cues.eyeWidth)}`,
      match: '烟熏|浓密睫毛|眼窝|眼影|眼线',
    });
  } else {
    verdicts.push({
      aim: '缺点',
      part: '眼',
      text: `眼神偏淡：眼区只比面颊暗 ${cues.eyeDelta}，眼宽约占脸宽 ${pct(cues.eyeWidth)}`,
      match: '卧蚕|眼线|浓密睫毛|烟熏|眼影',
    });
  }

  if (cues.browContrast >= 28) {
    verdicts.push({
      aim: '优点',
      part: '眉',
      text: `眉色清楚：眉区对比 ${cues.browContrast}，眉长约占脸宽 ${pct(cues.browWidth)}`,
      match: '空气眉|眉',
    });
  } else {
    verdicts.push({
      aim: '缺点',
      part: '眉',
      text: `眉色偏淡：眉区对比只有 ${cues.browContrast}，眉长约占脸宽 ${pct(cues.browWidth)}`,
      match: '空气眉|眉',
    });
  }

  if (cues.noseWidth >= 0.28) {
    verdicts.push({
      aim: '缺点',
      part: '鼻',
      text: `鼻中偏宽：亮部约占脸宽 ${pct(cues.noseWidth)}，比面颊${cues.noseHighlight >= 0 ? '亮' : '暗'} ${Math.abs(cues.noseHighlight)}`,
      match: '高光|修容|立体',
    });
  } else if (cues.noseHighlight >= 10) {
    verdicts.push({
      aim: '优点',
      part: '鼻',
      text: `鼻梁已有高光：比面颊亮 ${cues.noseHighlight}，亮部约占脸宽 ${pct(cues.noseWidth)}`,
      match: '高光|立体',
    });
  } else {
    verdicts.push({
      aim: '缺点',
      part: '鼻',
      text: `鼻梁不够亮：比面颊只差 ${cues.noseHighlight}，亮部约占脸宽 ${pct(cues.noseWidth)}`,
      match: '高光|立体',
    });
  }

  if (cues.lipRedness >= 8) {
    verdicts.push({
      aim: '优点',
      part: '唇',
      text: `唇色本身明显：比面颊红 ${cues.lipRedness}，唇宽约占脸宽 ${pct(cues.lipWidth)}，唇厚约占脸高 ${pct(cues.lipHeight)}`,
      match: '正红唇|红唇|唇釉|蜜桃唇',
    });
  } else {
    verdicts.push({
      aim: '缺点',
      part: '唇',
      text: `唇色偏淡：比面颊只红 ${cues.lipRedness}，唇宽约占脸宽 ${pct(cues.lipWidth)}，唇厚约占脸高 ${pct(cues.lipHeight)}`,
      match: '正红唇|红唇|唇釉|蜜桃唇',
    });
  }

  if (faceShape === '鹅蛋脸') {
    verdicts.push({
      aim: '优点',
      part: '轮廓',
      text: `轮廓比较匀：${contourMeasurePhrase(cues)}`,
      match: '清透|裸|低对比|日系',
    });
  } else {
    verdicts.push({
      aim: '缺点',
      part: '轮廓',
      text: `${faceShape}需要收一收：${contourMeasurePhrase(cues)}`,
      match: '冷淡|立体|修容|高光',
    });
  }

  if (brightness >= 170 && (skinTone === '暖白皮' || skinTone === '冷白皮')) {
    verdicts.push({
      aim: '优点',
      part: '肤色',
      text: `底色亮：面颊明度 ${brightness}，参考${skinTone}`,
      match: skinTone.includes('冷') ? '冷调|低饱和' : '蜜桃|裸|清透',
    });
  } else if (brightness < 120 || skinTone === '暖黄皮' || skinTone === '深肤色') {
    verdicts.push({
      aim: '缺点',
      part: '肤色',
      text: `气色要靠唇色托：面颊明度 ${brightness}，参考${skinTone}`,
      match: skinTone === '深肤色' || skinTone.includes('暖') ? '蜜桃|红唇|金' : '冷调|低饱和',
    });
  }

  if (!cues.usedSkinMask) {
    verdicts.push({
      aim: '缺点',
      part: '轮廓',
      text: '肤色区域不稳定，比例要再换一张正脸确认',
      match: '清透|裸',
    });
  }

  const strengths = verdicts.filter((item) => item.aim === '优点').map((item) => item.text);
  const weaknesses = verdicts.filter((item) => item.aim === '缺点').map((item) => item.text);
  return {
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    directions: [],
    verdicts,
  };
}

function measureProportions(
  data: Uint8ClampedArray,
  imgW: number,
  box: Box,
  cheekLum: number,
  foreheadLum: number,
  cheekRed: number,
): {
  eyeWidth: number;
  browWidth: number;
  lipWidth: number;
  lipHeight: number;
  upperShare: number;
  midShare: number;
  lowerShare: number;
} {
  const eye = spanWhere(data, imgW, box, 0.28, 0.48, (r, g, b) => lumOf(r, g, b) < cheekLum - 18);
  const brow = spanWhere(
    data,
    imgW,
    box,
    0.16,
    0.36,
    (r, g, b) => lumOf(r, g, b) < (foreheadLum || cheekLum) - 22,
  );
  const lip = spanWhere(
    data,
    imgW,
    box,
    0.64,
    0.88,
    (r, g, b) => r - (g + b) / 2 > cheekRed + 6,
  );
  const browRow = extremeRow(data, imgW, box, 0.12, 0.42, (r, g, b) => -lumOf(r, g, b));
  const lipRow = extremeRow(data, imgW, box, 0.55, 0.9, (r, g, b) => r - (g + b) / 2);
  let upperShare = 0;
  let midShare = 0;
  let lowerShare = 0;
  if (browRow > 0.05 && lipRow > browRow + 0.08 && lipRow < 0.95) {
    upperShare = round2(browRow);
    midShare = round2(lipRow - browRow);
    lowerShare = round2(Math.max(0, 1 - lipRow));
  }
  return {
    eyeWidth: eye.width,
    browWidth: brow.width,
    lipWidth: lip.width,
    lipHeight: lip.height,
    upperShare,
    midShare,
    lowerShare,
  };
}

function spanWhere(
  data: Uint8ClampedArray,
  imgW: number,
  box: Box,
  fy0: number,
  fy1: number,
  pred: (r: number, g: number, b: number) => boolean,
): { width: number; height: number } {
  if (box.w < 4 || box.h < 4) return { width: 0, height: 0 };
  const y0 = clamp(Math.floor(box.y + box.h * fy0), 0, 100000);
  const y1 = clamp(Math.floor(box.y + box.h * fy1), y0 + 1, 100000);
  let minX = Infinity;
  let maxX = -1;
  let minY = Infinity;
  let maxY = -1;
  let n = 0;
  for (let y = y0; y < y1; y += 2) {
    if (y * imgW >= data.length / 4) break;
    for (let x = box.x; x < box.x + box.w; x += 2) {
      const i = (y * imgW + x) * 4;
      if (i < 0 || i + 3 >= data.length || data[i + 3] < 128) continue;
      if (!pred(data[i], data[i + 1], data[i + 2])) continue;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (n < 8) return { width: 0, height: 0 };
  return {
    width: round2((maxX - minX) / box.w),
    height: round2((maxY - minY) / box.h),
  };
}

function extremeRow(
  data: Uint8ClampedArray,
  imgW: number,
  box: Box,
  fy0: number,
  fy1: number,
  score: (r: number, g: number, b: number) => number,
): number {
  if (box.h < 4) return -1;
  const y0 = clamp(Math.floor(box.y + box.h * fy0), 0, 100000);
  const y1 = clamp(Math.floor(box.y + box.h * fy1), y0 + 1, 100000);
  let best = -Infinity;
  let bestY = -1;
  for (let y = y0; y < y1; y += 2) {
    if (y * imgW >= data.length / 4) break;
    let sum = 0;
    let n = 0;
    const x0 = Math.floor(box.x + box.w * 0.2);
    const x1 = Math.floor(box.x + box.w * 0.8);
    for (let x = x0; x < x1; x += 3) {
      const i = (y * imgW + x) * 4;
      if (i < 0 || i + 3 >= data.length || data[i + 3] < 128) continue;
      sum += score(data[i], data[i + 1], data[i + 2]);
      n++;
    }
    if (n < 4) continue;
    const avg = sum / n;
    if (avg > best) {
      best = avg;
      bestY = y;
    }
  }
  if (bestY < 0) return -1;
  return (bestY - box.y) / box.h;
}

function lumOf(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function guessFaceShape(
  foreheadW: number,
  cheekW: number,
  jawW: number,
  ratio: number,
  jawEdge: number,
): FaceShape {
  const widths = [foreheadW, cheekW, jawW].filter((n) => n > 0.2);
  if (widths.length < 2) {
    if (ratio > 1.42) return '长脸';
    if (ratio < 1.12) return '圆脸';
    return '鹅蛋脸';
  }
  if (ratio > 1.4 && jawW < cheekW * 0.94) return '长脸';
  if (foreheadW > cheekW * 1.06 && jawW > 0 && jawW < cheekW * 0.86) return '心形脸';
  if (cheekW > foreheadW * 1.08 && cheekW > jawW * 1.08 && jawW > 0) return '菱形脸';
  const spread = Math.max(foreheadW, cheekW, jawW) - Math.min(...widths);
  if (spread < 0.09 && ratio < 1.25) return jawEdge > 26 ? '方脸' : '圆脸';
  if (ratio < 1.16 && cheekW > 0.7) return '圆脸';
  return '鹅蛋脸';
}

function guessSkinTone(
  r: number,
  g: number,
  b: number,
  brightness: number,
  warmth: number,
): SkinTone {
  if (!r && !g && !b) return '自然中性';
  if (brightness < 105 && r < 160) return '深肤色';
  if (warmth > 38 && r > g + 8) return brightness > 165 ? '暖白皮' : '暖黄皮';
  if (warmth < 14 && b >= g - 8) return '冷白皮';
  if (brightness > 175 && warmth >= 14) return '暖白皮';
  return '自然中性';
}

type Box = { x: number; y: number; w: number; h: number; count: number };

function findSkinBox(data: Uint8ClampedArray, width: number, height: number): Box {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  const xStart = Math.floor(width * 0.08);
  const xEnd = Math.floor(width * 0.92);
  const yStart = Math.floor(height * 0.05);
  const yEnd = Math.floor(height * 0.92);
  for (let y = yStart; y < yEnd; y += 3) {
    for (let x = xStart; x < xEnd; x += 3) {
      const i = (y * width + x) * 4;
      if (!isSkin(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      count++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (count < 40) return { x: 0, y: 0, w: 0, h: 0, count };
  const padX = Math.round((maxX - minX) * 0.04);
  const padY = Math.round((maxY - minY) * 0.04);
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  return {
    x,
    y,
    w: Math.min(width - x, maxX - minX + padX * 2),
    h: Math.min(height - y, maxY - minY + padY * 2),
    count,
  };
}

function sampleRect(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  box: Box,
  fx0: number,
  fy0: number,
  fx1: number,
  fy1: number,
  skinOnly: boolean,
): Stat {
  let x0 = Math.floor(box.x + box.w * fx0);
  let y0 = Math.floor(box.y + box.h * fy0);
  let x1 = Math.floor(box.x + box.w * fx1);
  let y1 = Math.floor(box.y + box.h * fy1);
  x0 = clamp(x0, 0, imgW - 1);
  x1 = clamp(x1, x0 + 1, imgW);
  y0 = clamp(y0, 0, imgH - 1);
  y1 = clamp(y1, y0 + 1, imgH);
  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let lum = 0;
  let red = 0;
  const lums: number[] = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * imgW + x) * 4;
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      const pa = data[i + 3];
      if (pa < 128) continue;
      if (skinOnly && !isSkin(pr, pg, pb, pa)) continue;
      const l = 0.299 * pr + 0.587 * pg + 0.114 * pb;
      n++;
      r += pr;
      g += pg;
      b += pb;
      lum += l;
      red += pr - (pg + pb) / 2;
      lums.push(l);
    }
  }
  if (!n) return EMPTY;
  return {
    n,
    r: r / n,
    g: g / n,
    b: b / n,
    lum: lum / n,
    contrast: stdDev(lums),
    redness: red / n,
  };
}

function spanAt(
  data: Uint8ClampedArray,
  imgW: number,
  box: Box,
  fy: number,
  skinOnly: boolean,
): number {
  const y = clamp(Math.floor(box.y + box.h * fy), 0, 10_000);
  const x0 = box.x;
  const x1 = box.x + box.w;
  let min = -1;
  let max = -1;
  let n = 0;
  for (let x = x0; x < x1; x += 2) {
    if (y * imgW + x >= data.length / 4) break;
    const i = (y * imgW + x) * 4;
    const pr = data[i];
    const pg = data[i + 1];
    const pb = data[i + 2];
    const ok = skinOnly ? isSkin(pr, pg, pb, data[i + 3]) : data[i + 3] > 128 && pr + pg + pb > 40;
    if (!ok) continue;
    if (min < 0) min = x;
    max = x;
    n++;
  }
  if (n < 4 || min < 0 || box.w <= 0) return 0;
  return (max - min) / box.w;
}

function jawContrast(data: Uint8ClampedArray, imgW: number, box: Box): number {
  const y = clamp(Math.floor(box.y + box.h * 0.74), 0, 10_000);
  const lums: number[] = [];
  for (let x = box.x; x < box.x + box.w; x += 2) {
    if (y * imgW + x >= data.length / 4) break;
    const i = (y * imgW + x) * 4;
    lums.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return stdDev(lums);
}

function brightColumnWidth(
  data: Uint8ClampedArray,
  imgW: number,
  box: Box,
  noseLum: number,
  cheekLum: number,
): number {
  if (!box.w || !noseLum) return 0;
  const threshold = Math.max(noseLum, cheekLum) - 6;
  const y0 = Math.floor(box.y + box.h * 0.42);
  const y1 = Math.floor(box.y + box.h * 0.66);
  const x0 = Math.floor(box.x + box.w * 0.3);
  const x1 = Math.floor(box.x + box.w * 0.7);
  let min = -1;
  let max = -1;
  for (let x = x0; x < x1; x += 2) {
    let lum = 0;
    let n = 0;
    for (let y = y0; y < y1; y += 3) {
      if (y < 0 || x < 0 || y * imgW + x >= data.length / 4) continue;
      const i = (y * imgW + x) * 4;
      lum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n++;
    }
    if (!n || lum / n < threshold) continue;
    if (min < 0) min = x;
    max = x;
  }
  if (min < 0) return 0;
  return (max - min) / box.w;
}

function isSkin(r: number, g: number, b: number, a: number): boolean {
  if (a < 128) return false;
  if (r < 70 || g < 35 || b < 20) return false;
  if (g > r + 12 || b > r + 8) return false;
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  if (y < 45 || y > 242) return false;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb > 80 && cb < 135 && cr > 133 && cr < 180;
}

function mergeStat(a: Stat, b: Stat): Stat {
  const n = a.n + b.n;
  if (!n) return EMPTY;
  return {
    n,
    r: (a.r * a.n + b.r * b.n) / n,
    g: (a.g * a.n + b.g * b.n) / n,
    b: (a.b * a.n + b.b * b.n) / n,
    lum: (a.lum * a.n + b.lum * b.n) / n,
    contrast: (a.contrast * a.n + b.contrast * b.n) / n,
    redness: (a.redness * a.n + b.redness * b.n) / n,
  };
}

function stdDev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((acc, x) => acc + (x - mean) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number): number {
  return Math.round(n);
}

/** 把三档轮廓宽度说成相对关系，避免边框本身被写成 100%/100%/100% */
export function contourMeasurePhrase(cues: AnalysisCues): string {
  const vals = [cues.foreheadWidth, cues.cheekWidth, cues.jawWidth];
  const max = Math.max(...vals, 0.001);
  const rel = vals.map((v) => v / max);
  const spread = Math.max(...rel) - Math.min(...rel);
  if (spread < 0.08) return `额、颧、下颌几乎同宽，长宽比 ${cues.faceRatio}`;
  const [forehead, cheek, jaw] = rel.map((n) => `${Math.round(n * 100)}%`);
  return `以最宽一档为 100%，额 ${forehead}、颧 ${cheek}、下颌 ${jaw}，长宽比 ${cues.faceRatio}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
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
  console.info('[占位] 外部 AI 分析未配置，回退本地启发式');
  return null;
}
