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

export interface CatalogMove {
  aim: '需要放大的优点' | '需要减弱的缺点';
  feature: string;
  work: WorkItem | null;
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

      reasons.push(inventoryReason(analysis, item, topWorks, preferredOccasion, occHit));

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

  for (const style of work.styles) {
    if (styleBoost(style, analysis, preferredOccasion)) {
      score += 8;
    }
  }
  if (analysis.faceShape === '圆脸' && work.styles.includes('冷淡高级')) score += 4;
  if (analysis.faceShape === '方脸' && work.styles.includes('韩系甜美')) score += 4;
  const matched = matchingVerdicts(analysis, work);
  if (matched.some((item) => item.aim === '缺点')) score += 14;
  else if (matched.some((item) => item.aim === '优点')) score += 8;

  reasons.push(workCatalogReason(work, matched));
  if (preferredOccasion) reasons.push(workOccasionReason(work, preferredOccasion, occasionOk));
  if (!faceOk || !toneOk) reasons.push(workFitNote(analysis, work, faceOk, toneOk));

  return {
    work,
    score: Math.max(10, Math.min(99, score)),
    reasons: unique(reasons),
  };
}

/** 每条优缺点只指向图库里真实存在的作品；对不上就明确说没有。 */
export function catalogMoves(analysis: FeatureAnalysis, works: WorkItem[]): CatalogMove[] {
  return (analysis.verdicts ?? []).map((verdict) => ({
    aim: verdict.aim === '优点' ? '需要放大的优点' : '需要减弱的缺点',
    feature: verdict.label || verdict.text,
    work: bestCatalogWork(works, analysis, verdict.match),
  }));
}

function workCatalogReason(
  work: WorkItem,
  matched: FeatureAnalysis['verdicts'],
): string {
  const cite = citeWork(work);
  const hit = matched?.find((item) => item.aim === '缺点') ?? matched?.[0];
  if (!hit) {
    return `图库作品${cite}没有对上这次测到的优缺点，只作备选，不另造妆容。`;
  }
  const aim = hit.aim === '优点' ? '需要放大的优点' : '需要减弱的缺点';
  const labels = (matched ?? [])
    .filter((item) => item.aim === hit.aim && item.label)
    .map((item) => item.label);
  const name = labels.length ? [...new Set(labels)].slice(0, 3).join('、') : hit.label || hit.text;
  return `推荐理由：对上总结里的${aim}「${name}」。用图库里的${cite}。`;
}

function workFitNote(
  analysis: FeatureAnalysis,
  work: WorkItem,
  faceOk: boolean,
  toneOk: boolean,
): string {
  const bits: string[] = [];
  if (!faceOk) bits.push(`脸型${analysis.faceShape}不在这套适合脸型里`);
  if (!toneOk) bits.push(`肤色${analysis.skinTone}不在这套适合肤色里`);
  return `「${work.title}」${bits.join('，')}，修饰效果要减一档。`;
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

function inventoryReason(
  analysis: FeatureAnalysis,
  item: InventoryItem,
  topWorks: WorkItem[],
  occasion: Occasion | '' | undefined,
  occHit: boolean,
): string {
  const itemCite = `库存「${item.name}」（${item.category}，风格 ${item.styles.join('、') || '未标'}，颜色 ${item.colors.join('、') || '未标'}，场合 ${item.occasions.join('、') || '未标'}）`;
  const move =
    catalogMoves(analysis, topWorks).find((entry) => entry.work && itemSupports(item, entry.work)) ??
    catalogMoves(analysis, topWorks).find((entry) => entry.work) ??
    null;
  if (!move?.work) {
    return `${itemCite}对不上这次测到的优缺点，也没有能配上的图库妆造。`;
  }
  const occasionNote =
    occasion && !occHit ? `场合「${occasion}」和这件不完全重合。` : '';
  return `${move.aim}「${move.feature}」：${itemCite}，配图库作品${citeWork(move.work)}。${occasionNote}`;
}

function itemSupports(item: InventoryItem, work: WorkItem): boolean {
  const blob = `${item.name} ${item.styles.join(' ')} ${item.colors.join(' ')} ${item.occasions.join(' ')}`;
  return work.styles.some((style) => blob.includes(style.slice(0, 2))) ||
    work.occasions.some((occasion) => item.occasions.includes(occasion));
}

function matchingVerdicts(analysis: FeatureAnalysis, work: WorkItem) {
  return (analysis.verdicts ?? []).filter(
    (verdict) => keywordScore(workBlob(work), verdict.match) > 0,
  );
}

function bestCatalogWork(works: WorkItem[], analysis: FeatureAnalysis, match: string): WorkItem | null {
  let best: WorkItem | null = null;
  let bestScore = 0;
  for (const work of works) {
    const hit = keywordScore(workBlob(work), match);
    if (!hit) continue;
    let score = hit * 5;
    if (work.suitableFaces.includes(analysis.faceShape)) score += 1;
    if (work.suitableTones.includes(analysis.skinTone)) score += 1;
    if (score > bestScore) {
      best = work;
      bestScore = score;
    }
  }
  return best;
}

function keywordScore(blob: string, source: string): number {
  const parts = source.split('|').filter(Boolean);
  let best = 0;
  parts.forEach((part, index) => {
    if (!blob.includes(part)) return;
    if (part === '睫毛' && blob.includes('轻睫毛') && !blob.includes('浓密睫毛')) return;
    best = Math.max(best, parts.length - index);
  });
  return best;
}

function workBlob(work: WorkItem): string {
  return [work.title, work.makeupType, ...work.styles, ...work.tags].join(' ');
}

function citeWork(work: WorkItem): string {
  const styles = work.styles.join('、') || '未标风格';
  const tags = work.tags.join('、') || '无标签';
  return `「${work.title}」（风格 ${styles}，标签 ${tags}）`;
}

function styleBoost(
  style: MakeupStyle,
  analysis: FeatureAnalysis,
  occasion?: Occasion | '',
): boolean {
  const text = `${analysis.strengths.join(' ')} ${analysis.weaknesses.join(' ')} ${(analysis.verdicts ?? []).map((item) => item.match).join(' ')}`;
  if (style === '清透自然' && /清透|裸|低对比/.test(text)) return true;
  if (style === '冷淡高级' && /冷淡|冷调|低饱和/.test(text)) return true;
  if (style === '韩系甜美' && /蜜桃|甜美|卧蚕/.test(text)) return true;
  if (style === '复古红唇' && /红唇|唇/.test(text)) return true;
  if (style === '欧美立体' && /立体|烟熏|高光/.test(text)) return true;
  if (style === '新娘妆' && occasion === '婚礼') return true;
  if (style === '日系可爱' && /空气|眉/.test(text)) return true;
  if (style === '国潮戏曲' && /高饱和|红唇|金/.test(text)) return true;
  return false;
}

function unique(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}
