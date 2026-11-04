import type {
  FeatureAnalysis,
  InventoryItem,
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

  return inventory
    .map((item) => {
      let score = 40;
      const reasons: string[] = [];

      const styleHit = item.styles.some(
        (s) =>
          [...stylePool].some((w) => w.includes(s) || s.includes(w)) ||
          analysis.directions.some((d) => d.includes(s)),
      );
      if (styleHit) {
        score += 25;
        reasons.push('风格与推荐妆造契合');
      }

      const occHit = item.occasions.some((o) => occasionPool.has(o));
      if (occHit) {
        score += 20;
        reasons.push('场合匹配');
      }

      if (
        analysis.skinTone.includes('冷') &&
        item.colors.some((c) => /银|白|粉|紫|蓝/.test(c))
      ) {
        score += 10;
        reasons.push('冷调配色友好');
      }
      if (
        (analysis.skinTone.includes('暖') || analysis.skinTone === '暖黄皮') &&
        item.colors.some((c) => /金|香槟|橘|红|咖/.test(c))
      ) {
        score += 10;
        reasons.push('暖调配色友好');
      }

      if (!reasons.length) reasons.push('可作为备选搭配');

      return { item, score: Math.min(99, score), reasons };
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

  if (work.suitableFaces.includes(analysis.faceShape)) {
    score += 28;
    reasons.push(`适合${analysis.faceShape}`);
  } else {
    score -= 5;
  }

  if (work.suitableTones.includes(analysis.skinTone)) {
    score += 22;
    reasons.push(`契合${analysis.skinTone}`);
  }

  if (preferredOccasion && work.occasions.includes(preferredOccasion)) {
    score += 18;
    reasons.push(`场合：${preferredOccasion}`);
  }

  const dirText = analysis.directions.join(' ') + analysis.strengths.join(' ');
  for (const style of work.styles) {
    if (
      (style.includes('清透') && /清透|水光|淡妆/.test(dirText)) ||
      (style.includes('冷淡') && /冷|高级|立体/.test(dirText)) ||
      (style.includes('甜美') && /甜美|亲和|韩系/.test(dirText)) ||
      (style.includes('红唇') && /红唇|气场|复古/.test(dirText)) ||
      (style.includes('新娘') && preferredOccasion === '婚礼')
    ) {
      score += 8;
      reasons.push(`风格贴合：${style}`);
    }
  }

  if (analysis.faceShape === '圆脸' && work.styles.includes('冷淡高级')) {
    score += 5;
    reasons.push('立体妆有助修饰圆脸');
  }
  if (analysis.faceShape === '方脸' && work.styles.includes('韩系甜美')) {
    score += 5;
    reasons.push('柔和风格可柔化方脸线条');
  }

  if (!reasons.length) reasons.push('综合匹配一般，可作灵感参考');

  return { work, score: Math.max(10, Math.min(99, score)), reasons: unique(reasons) };
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}
