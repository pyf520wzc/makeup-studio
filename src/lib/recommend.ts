import { contourMeasurePhrase } from './faceAnalysis';
import type {
  FeatureAnalysis,
  InventoryItem,
  MakeupStyle,
  Occasion,
  WorkItem,
} from '../types';

export interface ScoredWork {
  work: WorkItem;
  score: number;
  reasons: string[];
}

export interface ScoredInventory {
  item: InventoryItem;
  score: number;
  reasons: string[];
}

export function recommendWorks(
  analysis: FeatureAnalysis,
  works: WorkItem[],
  preferredOccasion?: Occasion | '',
): ScoredWork[] {
  return works
    .map((work) => scoreWork(analysis, work, preferredOccasion))
    .sort((a, b) => b.score - a.score);
}

export function recommendInventory(
  analysis: FeatureAnalysis,
  inventory: InventoryItem[],
  topWorks: WorkItem[],
  preferredOccasion?: Occasion | '',
): ScoredInventory[] {
  const stylePool = new Set(topWorks.flatMap((w) => w.styles));
  const occasionPool = new Set(
    preferredOccasion
      ? [preferredOccasion]
      : topWorks.flatMap((w) => w.occasions),
  );
  const topTitles = topWorks.slice(0, 2).map((w) => w.title);

  return inventory
    .map((item) => {
      let score = 40;
      const reasons: string[] = [];

      const styleHit = item.styles.some(
        (s) =>
          [...stylePool].some((w) => w.includes(s) || s.includes(w)) ||
          analysis.directions.some((d) => d.includes(s)),
      );
      if (styleHit) score += 25;

      const occHit = item.occasions.some((o) => occasionPool.has(o));
      if (occHit) score += 20;

      const coolFriendly =
        analysis.skinTone.includes('冷') &&
        item.colors.some((c) => /银|白|粉|紫|蓝|雾/.test(c));
      const warmFriendly =
        (analysis.skinTone.includes('暖') || analysis.skinTone === '暖黄皮') &&
        item.colors.some((c) => /金|香槟|橘|红|咖|象牙/.test(c));
      if (coolFriendly || warmFriendly) score += 10;

      if (
        item.category === '服装' &&
        /婚|纱|礼/.test(item.name + item.styles.join('')) &&
        (preferredOccasion === '婚礼' || occasionPool.has('婚礼'))
      ) {
        score += 8;
      }

      reasons.push(faceClause(analysis, item));
      reasons.push(colorClause(analysis, item));
      reasons.push(styleClause(item, stylePool, topTitles, styleHit));
      reasons.push(occasionClause(item, preferredOccasion, occHit));

      return { item, score: Math.min(99, score), reasons: unique(reasons) };
    })
    .sort((a, b) => b.score - a.score);
}

function scoreWork(
  analysis: FeatureAnalysis,
  work: WorkItem,
  preferredOccasion?: Occasion | '',
): ScoredWork {
  let score = 35;
  const reasons: string[] = [];

  const faceOk = work.suitableFaces.includes(analysis.faceShape);
  if (faceOk) score += 28;
  else score -= 4;

  const toneOk = work.suitableTones.includes(analysis.skinTone);
  if (toneOk) score += 22;

  const occasionOk = Boolean(
    preferredOccasion && work.occasions.includes(preferredOccasion),
  );
  if (occasionOk) score += 18;

  const cues = analysis.cues;
  for (const style of work.styles) {
    if (styleBoost(style, analysis, preferredOccasion)) {
      score += 8;
    }
  }
  if (analysis.faceShape === '圆脸' && work.styles.includes('冷淡高级')) score += 4;
  if (analysis.faceShape === '方脸' && work.styles.includes('韩系甜美')) score += 4;
  if ((cues?.eyeDelta ?? 0) > 24 && work.styles.includes('欧美立体')) score += 4;
  if ((cues?.lipRedness ?? 0) > 8 && work.styles.includes('复古红唇')) score += 4;
  if ((cues?.eyeDelta ?? 99) < 16 && work.styles.includes('清透自然')) score += 4;

  reasons.push(workFaceReason(analysis, work, faceOk));
  reasons.push(workToneReason(analysis, work, toneOk));
  reasons.push(workOccasionReason(work, preferredOccasion, occasionOk));
  const styleReason = work.styles
    .map((style) => styleSentence(style, analysis, preferredOccasion))
    .find(Boolean);
  if (styleReason) reasons.push(styleReason);

  return {
    work,
    score: Math.max(10, Math.min(99, score)),
    reasons: unique(reasons),
  };
}

function workFaceReason(analysis: FeatureAnalysis, work: WorkItem, faceOk: boolean): string {
  const measured = analysis.cues ? `${contourMeasurePhrase(analysis.cues)}，` : '';
  if (faceOk) {
    return `脸型倾向${analysis.faceShape}（${measured}照片分区结果）。「${work.title}」标明适合这个脸型，妆面修饰方向和轮廓一致。`;
  }
  return `脸型倾向${analysis.faceShape}（${measured}照片分区结果）。「${work.title}」没有把这个脸型列为适合项，可以当风格参考，不要当成首选修饰。`;
}

function workToneReason(analysis: FeatureAnalysis, work: WorkItem, toneOk: boolean): string {
  const base = `肤色参考${analysis.skinTone}，面颊明度 ${analysis.brightness}，冷暖差 ${analysis.warmth}。`;
  if (toneOk) return `${base}这套标注了该肤色，底妆冷暖不用大改。`;
  const listed = work.suitableTones.join('、') || '未标注';
  return `${base}作品适合的是${listed}，和当前判断不完全重合，试色时先对一下底妆冷暖。`;
}

function workOccasionReason(
  work: WorkItem,
  occasion: Occasion | '' | undefined,
  occasionOk: boolean,
): string {
  if (occasion && occasionOk) {
    return `客人场合是${occasion}，这套覆盖${occasion}（同时也标了${work.occasions.join('、')}）。`;
  }
  if (occasion) {
    return `客人场合是${occasion}，这套场合是${work.occasions.join('、')}，场合不是首要匹配。`;
  }
  return `这次没有指定场合，按作品自己的场合（${work.occasions.join('、')}）来用。`;
}

function styleSentence(
  style: MakeupStyle,
  analysis: FeatureAnalysis,
  occasion?: Occasion | '',
): string | null {
  const eye = analysis.cues?.eyeDelta;
  const lip = analysis.cues?.lipRedness;
  switch (style) {
    case '清透自然':
      return eye !== undefined && eye < 22
        ? `眼周和面颊只差约 ${eye}，清透妆不会把眼神压暗，适合这张照片的低对比。`
        : '清透路线保留原有肤质，眼妆点到为止。';
    case '韩系甜美':
      return `${analysis.faceShape}用韩系甜妆时，腮红和卧蚕增加亲和，面中修容不用很重。`;
    case '冷淡高级':
      return `冷淡妆用低饱和和清楚的轮廓，贴合现在的${analysis.skinTone}底色。`;
    case '欧美立体':
      return eye !== undefined && eye > 18
        ? `眼区比面颊暗约 ${eye}，立体眼妆能接住这份对比。`
        : '眼区对比不强，立体妆要靠眉骨高光和睫毛把眼睛提起来。';
    case '复古红唇':
      return lip !== undefined && lip > 6
        ? `唇色比面颊更红（差值约 ${lip}），正红唇容易显色。`
        : `唇色相对含蓄（与面颊红差约 ${lip ?? 0}），复古红唇要先把唇色补匀。`;
    case '新娘妆':
      return occasion === '婚礼'
        ? '客人场合是婚礼，新娘妆的柔光和持久度对得上这个场合。'
        : '新娘妆强调干净底妆和耐看的眼唇，正式场合可以借用。';
    case '日系可爱':
      return '日系淡颜走轻眉、低对比，适合想要空气感、少盖住皮肤的客人。';
    case '国潮戏曲':
      return '国潮浓彩用高饱和眼唇，适合舞台和写真；日常和职场不要直接照搬。';
    default:
      return null;
  }
}

function styleBoost(
  style: MakeupStyle,
  analysis: FeatureAnalysis,
  occasion?: Occasion | '',
): boolean {
  const text = `${analysis.directions.join(' ')} ${analysis.strengths.join(' ')} ${analysis.summary ?? ''}`;
  if (style === '清透自然' && /清透|低对比|空气|裸/.test(text)) return true;
  if (style === '冷淡高级' && /冷|高级|低饱和/.test(text)) return true;
  if (style === '韩系甜美' && /甜|亲和|腮红/.test(text)) return true;
  if (style === '复古红唇' && /红唇|唇色/.test(text)) return true;
  if (style === '欧美立体' && /立体|眼妆|眼周/.test(text)) return true;
  if (style === '新娘妆' && occasion === '婚礼') return true;
  if (style === '日系可爱' && /空气|淡/.test(text)) return true;
  return false;
}

function faceClause(analysis: FeatureAnalysis, item: InventoryItem): string {
  const who = `客人是${analysis.faceShape}、${analysis.skinTone}`;
  if (item.category !== '服装') {
    return `${who}。${item.category}「${item.name}」靠近脸，体量要让给妆，不要再叠一圈很宽的装饰。`;
  }
  let cut = '裙形完整，妆面保持清楚就够。';
  if (/立领|高领/.test(item.name)) cut = '立领把锁骨收住，重点放在眼和唇，不用再加长项链。';
  else if (/V/.test(item.name)) cut = 'V 领露出锁骨，颈饰选细的，耳饰可以略亮。';
  else if (/吊带|抹胸/.test(item.name)) cut = '肩颈露得多，耳环和妆面会更显眼。';
  else if (/鱼尾/.test(item.name)) cut = '鱼尾先收腰再散开，妆不用往两边铺得很宽。';
  else if (/长袖/.test(item.name)) cut = '长袖盖住手臂，手部只留细饰品，避免和袖口花纹抢。';
  else if (/缎/.test(item.name)) cut = '缎面有光，底妆宜薄，避免脸和衣服两处反光。';
  else if (/蓝|晚礼/.test(item.name)) cut = '这是晚宴长裙，不是白纱，妆可以比婚礼主妆更浓一点。';
  else if (/纱裙|蓬裙/.test(item.name)) cut = '纱裙体积大，妆保持干净，免得和裙摆一起抢。';
  else if (/蕾丝/.test(item.name)) cut = '蕾丝本身有花纹，妆和首饰都收一点。';
  return `${who}。「${item.name}」${cut}`;
}

function colorClause(analysis: FeatureAnalysis, item: InventoryItem): string {
  const colors = item.colors.join('、') || '未标色';
  const tone = analysis.skinTone;
  const hasWhite = item.colors.some((c) => /象牙|白/.test(c));
  const coolColor = item.colors.some((c) => /银|粉|紫|蓝|雾/.test(c));
  const warmColor = item.colors.some((c) => /金|香槟|橘|红|咖/.test(c));
  if (hasWhite && !item.colors.some((c) => /蓝|黑/.test(c))) {
    return `主色「${colors}」接近白或象牙，${tone}都能穿，冷暖交给妆面，不用为了衣服改肤色。`;
  }
  if (tone.includes('冷') && coolColor) {
    return `配色「${colors}」偏冷，和${tone}是同一边，不容易和底妆打架。`;
  }
  if ((tone.includes('暖') || tone === '暖黄皮') && warmColor) {
    return `配色「${colors}」偏暖，能托住${tone}。`;
  }
  if (tone === '深肤色' && (warmColor || hasWhite)) {
    return `「${colors}」在深肤色上对比清楚，金银和白都站得住。`;
  }
  return `配色是${colors}，和参考肤色${tone}不是最贴的一组，适合当对比色试穿，不要当成唯一选择。`;
}

function styleClause(
  item: InventoryItem,
  stylePool: Set<string>,
  topTitles: string[],
  styleHit: boolean,
): string {
  const styles = item.styles.join('、') || '未标风格';
  const looks = topTitles.length ? topTitles.join('、') : '当前推荐妆造';
  if (styleHit) {
    return `风格关键词「${styles}」和推荐妆造（${looks}，风格 ${[...stylePool].slice(0, 3).join('、') || '未定'}）说得上话，可以配成一套。`;
  }
  return `风格关键词是「${styles}」，和推荐妆造（${looks}）没有直接撞上，留作换风格时的备选。`;
}

function occasionClause(
  item: InventoryItem,
  occasion: Occasion | '' | undefined,
  occHit: boolean,
): string {
  if (occasion && occHit) {
    return `客人场合是${occasion}，这件覆盖该场合。`;
  }
  if (occasion) {
    return `客人场合是${occasion}，这件标的是${item.occasions.join('、')}，场合不是最贴。`;
  }
  return `没有单独指定场合，按单品场合（${item.occasions.join('、')}）搭配。`;
}

function unique(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}
