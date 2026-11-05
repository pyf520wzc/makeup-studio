import type { AppData, ClientSession, InventoryItem, WorkItem } from '../types';
import { clearEvents } from './analytics';
import { clearPrivacyConsent } from './privacy';

const STORAGE_KEY = 'makeup-studio-v1';
const DEMO_FLAG = 'makeup-studio-demo';

const defaultData = (): AppData => ({
  works: [],
  inventory: [],
  sessions: [],
});

function normalizeSession(s: ClientSession): ClientSession {
  return {
    ...s,
    selectedInventoryIds: s.selectedInventoryIds ?? [],
    status: s.status ?? (s.outfit?.workId ? 'draft' : 'draft'),
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as AppData;
    return {
      works: parsed.works ?? [],
      inventory: parsed.inventory ?? [],
      sessions: (parsed.sessions ?? []).map(normalizeSession),
    };
  } catch {
    return defaultData();
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function upsertWork(item: WorkItem): AppData {
  const data = loadData();
  const idx = data.works.findIndex((w) => w.id === item.id);
  if (idx >= 0) data.works[idx] = item;
  else data.works.unshift(item);
  saveData(data);
  return data;
}

export function deleteWork(id: string): AppData {
  const data = loadData();
  data.works = data.works.filter((w) => w.id !== id);
  saveData(data);
  return data;
}

export function upsertInventory(item: InventoryItem): AppData {
  const data = loadData();
  const idx = data.inventory.findIndex((w) => w.id === item.id);
  if (idx >= 0) data.inventory[idx] = item;
  else data.inventory.unshift(item);
  saveData(data);
  return data;
}

export function deleteInventory(id: string): AppData {
  const data = loadData();
  data.inventory = data.inventory.filter((w) => w.id !== id);
  saveData(data);
  return data;
}

export function upsertSession(session: ClientSession): AppData {
  const data = loadData();
  const normalized = normalizeSession(session);
  const idx = data.sessions.findIndex((s) => s.id === normalized.id);
  if (idx >= 0) data.sessions[idx] = normalized;
  else data.sessions.unshift(normalized);
  saveData(data);
  return data;
}

export function deleteSession(id: string): AppData {
  const data = loadData();
  data.sessions = data.sessions.filter((s) => s.id !== id);
  saveData(data);
  return data;
}

/** 清除作品/库存/会话；默认关闭自动演示种子，便于演示「空库拦截」 */
export function clearAllLocalData(opts?: {
  keepPrivacy?: boolean;
  keepEvents?: boolean;
}): AppData {
  saveData(defaultData());
  localStorage.setItem(DEMO_FLAG, 'off');
  if (!opts?.keepEvents) clearEvents();
  if (!opts?.keepPrivacy) clearPrivacyConsent();
  return defaultData();
}

export function isDemoAutoSeedOff(): boolean {
  return localStorage.getItem(DEMO_FLAG) === 'off';
}

/** 强制写入演示数据（化妆师工作台 / 首页「载入演示」） */
export function loadDemoData(): AppData {
  localStorage.removeItem(DEMO_FLAG);
  const data = defaultData();
  fillDemo(data);
  saveData(data);
  return data;
}

/**
 * 首次空库时自动灌演示数据；若用户曾「清除全部数据」则不再自动灌，直到 loadDemoData。
 */
export function seedDemoIfEmpty(): AppData {
  const data = loadData();
  if (data.works.length > 0 || data.inventory.length > 0) return data;
  if (isDemoAutoSeedOff()) return data;
  fillDemo(data);
  saveData(data);
  return data;
}

const DEMO_AT = '2026-04-12T10:00:00.000Z';

function fillDemo(data: AppData): void {
  const demoWorks: WorkItem[] = [
    {
      id: 'work_natural',
      title: '清透裸感日常妆',
      imageDataUrl: demoImage('/assets/works/natural-bare.jpg', '#f3d2c8', '#f7e7ea', '清透'),
      styles: ['清透自然', '日系可爱'],
      occasions: ['日常', '约会', '职场'],
      makeupType: '日常淡妆',
      suitableFaces: ['鹅蛋脸', '心形脸', '长脸'],
      suitableTones: ['自然中性', '暖白皮', '冷白皮'],
      tags: ['空气眉', '裸唇', '轻睫毛'],
      notes: '眉色淡、唇色裸，皮肤纹理还在。适合想要日系空气感、不想被浓妆盖住五官的客人。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_peach',
      title: '韩系蜜桃甜妆',
      imageDataUrl: demoImage('/assets/works/korean-peach.jpg', '#f8c8d8', '#fff5f8', '蜜桃'),
      styles: ['韩系甜美', '清透自然'],
      occasions: ['约会', '日常', '写真'],
      makeupType: '约会妆',
      suitableFaces: ['鹅蛋脸', '圆脸', '心形脸'],
      suitableTones: ['暖白皮', '自然中性', '暖黄皮'],
      tags: ['蜜桃唇', '卧蚕', '轻修容'],
      notes: '珊瑚色唇和柔和眼妆，甜而不腻。圆脸把腮红往上带，不要横着铺满。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_bridal_gold',
      title: '红金华丽新娘妆',
      imageDataUrl: demoImage('/assets/works/bridal-red-gold.jpg', '#8b1e3f', '#f5e6d3', '新娘'),
      styles: ['新娘妆', '国潮戏曲'],
      occasions: ['婚礼', '舞台', '写真'],
      makeupType: '新娘妆',
      suitableFaces: ['鹅蛋脸', '圆脸', '方脸'],
      suitableTones: ['暖黄皮', '暖白皮', '自然中性', '深肤色'],
      tags: ['金粉眼', '红唇', '额饰'],
      notes: '红金高饱和新娘妆。可作婚礼主妆，也可当国潮浓彩的配色参考；这不是戏曲脸谱仿妆。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_bridal_lip',
      title: '婚礼跟妆点唇',
      imageDataUrl: demoImage('/assets/works/bridal-lip.jpg', '#e8b4b8', '#faf0e6', '跟妆'),
      styles: ['新娘妆', '韩系甜美'],
      occasions: ['婚礼', '写真'],
      makeupType: '新娘妆',
      suitableFaces: ['鹅蛋脸', '圆脸', '心形脸', '长脸'],
      suitableTones: ['暖白皮', '自然中性', '暖黄皮'],
      tags: ['粉紫眼', '唇釉', '跟妆'],
      notes: '眼妆已经是粉紫色，最后用唇釉定调。适合给客人看婚礼当天补妆的那一步。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_cool',
      title: '冷调极简裸妆',
      imageDataUrl: demoImage('/assets/works/cool-minimal.jpg', '#2c2c34', '#9bb7d4', '冷调'),
      styles: ['冷淡高级', '清透自然'],
      occasions: ['职场', '写真', '日常'],
      makeupType: '职场妆',
      suitableFaces: ['长脸', '鹅蛋脸', '菱形脸'],
      suitableTones: ['冷白皮', '自然中性', '深肤色'],
      tags: ['冷调', '裸唇', '低饱和'],
      notes: '底妆干净，唇色不抢戏，靠冷调光影做出高级感。深肤色也可以走低饱和，不必提成白皮。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_editorial',
      title: '冷淡高级肖像',
      imageDataUrl: demoImage('/assets/works/editorial-cool.jpg', '#3a3340', '#c9b8b0', '肖像'),
      styles: ['冷淡高级'],
      occasions: ['写真', '派对', '职场'],
      makeupType: '写真妆',
      suitableFaces: ['长脸', '鹅蛋脸', '菱形脸', '心形脸'],
      suitableTones: ['冷白皮', '自然中性', '暖白皮'],
      tags: ['裸棕唇', '柔焦', '低对比'],
      notes: '眉眼不加重，唇色偏裸棕。适合想要杂志感、但不想画烟熏的客人。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_classic_red',
      title: '经典正红唇',
      imageDataUrl: demoImage('/assets/works/classic-redlip.jpg', '#8b1e3f', '#f5e6d3', '正红'),
      styles: ['复古红唇'],
      occasions: ['派对', '婚礼', '写真'],
      makeupType: '复古妆',
      suitableFaces: ['鹅蛋脸', '心形脸', '方脸'],
      suitableTones: ['暖白皮', '暖黄皮', '自然中性'],
      tags: ['正红唇', '眼线', '齐刘海'],
      notes: '唇妆是焦点，眼妆保持干净眼线和睫毛。暖调肤色上正红更不容易显脏。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_vintage',
      title: '复古红唇烟熏',
      imageDataUrl: demoImage('/assets/works/vintage-smoky.jpg', '#4a2030', '#c45c5c', '烟熏'),
      styles: ['复古红唇', '欧美立体'],
      occasions: ['派对', '舞台', '写真'],
      makeupType: '晚宴妆',
      suitableFaces: ['鹅蛋脸', '方脸', '菱形脸', '长脸'],
      suitableTones: ['冷白皮', '自然中性', '暖白皮', '深肤色'],
      tags: ['红唇', '烟熏', '卷发'],
      notes: '烟熏眼加正红唇，对比强。眼妆已经很深时，腮红要收，避免整张脸发脏。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_smoky',
      title: '冷调烟熏睫毛',
      imageDataUrl: demoImage('/assets/works/smoky-lash.jpg', '#2c2c34', '#c9a7a0', '睫毛'),
      styles: ['冷淡高级', '欧美立体'],
      occasions: ['派对', '舞台', '写真'],
      makeupType: '晚宴妆',
      suitableFaces: ['鹅蛋脸', '菱形脸', '长脸', '方脸'],
      suitableTones: ['冷白皮', '自然中性', '深肤色'],
      tags: ['烟熏', '浓密睫毛', '眼窝'],
      notes: '灰棕压眼窝，睫毛是重点。眼窝本身有阴影的客人更合适；眼周很平要先找到眼窝再铺色。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_drama',
      title: '红调戏剧眼妆',
      imageDataUrl: demoImage('/assets/works/drama-red.jpg', '#8b1e3f', '#e8b4b8', '戏剧'),
      styles: ['国潮戏曲', '欧美立体', '复古红唇'],
      occasions: ['舞台', '派对', '写真'],
      makeupType: '舞台妆',
      suitableFaces: ['鹅蛋脸', '方脸', '菱形脸', '心形脸'],
      suitableTones: ['暖白皮', '自然中性', '暖黄皮'],
      tags: ['红眼影', '亮红唇', '高饱和'],
      notes: '整眼红调加亮红唇，戏剧感强。可作国潮舞台或浓彩写真，不是戏曲脸谱。日常和职场不要直接照搬。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_pink',
      title: '粉调立体晚宴妆',
      imageDataUrl: demoImage('/assets/works/pink-glam.jpg', '#e7b7c8', '#7d4e6a', '晚宴'),
      styles: ['欧美立体', '韩系甜美'],
      occasions: ['派对', '写真', '舞台'],
      makeupType: '晚宴妆',
      suitableFaces: ['鹅蛋脸', '圆脸', '心形脸'],
      suitableTones: ['冷白皮', '暖白皮', '自然中性'],
      tags: ['粉色眼影', '高光', '盘发'],
      notes: '粉调眼妆和面中高光做出立体，唇色收成裸粉。圆脸的高光只点眉骨和鼻梁，不要铺满苹果肌。',
      createdAt: DEMO_AT,
    },
    {
      id: 'work_smile',
      title: '元气笑容红唇',
      imageDataUrl: demoImage('/assets/works/smile-red.jpg', '#c45c5c', '#f6d5d0', '元气'),
      styles: ['复古红唇', '清透自然'],
      occasions: ['日常', '约会', '职场'],
      makeupType: '日常淡妆',
      suitableFaces: ['圆脸', '鹅蛋脸', '方脸'],
      suitableTones: ['暖白皮', '暖黄皮', '自然中性'],
      tags: ['红唇', '笑容', '轻底妆'],
      notes: '底妆很轻，靠红唇提气色。适合想要日常有精神、但不想画完整眼妆的客人。',
      createdAt: DEMO_AT,
    },
  ];

  const demoInventory: InventoryItem[] = [
    {
      id: 'inv_lace_collar',
      name: '立领蕾丝婚纱',
      category: '服装',
      imageDataUrl: demoImage('/assets/inventory/gown-lace-highneck.jpg', '#f7f1ea', '#e7d3c4', '蕾丝'),
      colors: ['象牙白'],
      styles: ['优雅', '新娘', '蕾丝'],
      occasions: ['婚礼', '写真'],
      notes: '高领蕾丝和薄纱，线条含蓄。清透新娘妆就够，不必再叠很厚的项链。',
      createdAt: DEMO_AT,
    },
    {
      id: 'inv_lace_sleeve',
      name: '长袖蕾丝婚纱',
      category: '服装',
      imageDataUrl: demoImage('/assets/inventory/gown-lace-sleeve.jpg', '#f4efe8', '#d9c3b0', '长袖'),
      colors: ['象牙白'],
      styles: ['蕾丝', '优雅', '新娘'],
      occasions: ['婚礼', '写真'],
      notes: '长袖蕾丝盖住手臂。手部只留细手链，避免和袖口花纹抢。',
      createdAt: DEMO_AT,
    },
    {
      id: 'inv_beaded',
      name: '珠绣 V 领婚纱',
      category: '服装',
      imageDataUrl: demoImage('/assets/inventory/gown-beaded-v.jpg', '#f7f4ef', '#e4d2c4', '珠绣'),
      colors: ['白色'],
      styles: ['珠绣', '新娘', '精致'],
      occasions: ['婚礼', '写真'],
      notes: '深 V 和珠绣把视线放在锁骨。颈饰宜细，耳饰可以略亮。',
      createdAt: DEMO_AT,
    },
    {
      id: 'inv_tulle',
      name: '简约绣花纱裙',
      category: '服装',
      imageDataUrl: demoImage('/assets/inventory/gown-tulle.jpg', '#f6f1ea', '#e6d5c8', '纱裙'),
      videoUrl: '/assets/videos/bride-walk.mp4',
      colors: ['白色'],
      styles: ['简约', '新娘', '纱裙'],
      occasions: ['婚礼', '写真'],
      notes: '静帧是店内挂拍纱裙。短片是免版税户外白纱，用来看裙摆和头纱走势，不是同一件衣服。',
      createdAt: DEMO_AT,
    },
    {
      id: 'inv_satin',
      name: '缎面珍珠礼裙',
      category: '服装',
      imageDataUrl: demoImage('/assets/inventory/gown-satin-pearl.jpg', '#f3ead8', '#e4d2b0', '缎面'),
      colors: ['香槟', '象牙白'],
      styles: ['缎面', '优雅', '晚宴'],
      occasions: ['婚礼', '派对', '写真'],
      notes: '缎面偏暖，配暖调肤色和珍珠层叠项链。冷白皮也能穿，腮红不要再叠很暖的橘。',
      createdAt: DEMO_AT,
    },
    {
      id: 'inv_sparkle',
      name: '亮片花朵吊带纱',
      category: '服装',
      imageDataUrl: demoImage('/assets/inventory/gown-sparkle.jpg', '#f7f7f7', '#e7d5dc', '吊带'),
      videoUrl: '/assets/videos/bride-steps.mp4',
      colors: ['白色'],
      styles: ['亮片', '甜美', '新娘'],
      occasions: ['婚礼', '派对', '写真'],
      notes: '吊带和花朵亮片适合甜美新娘妆。短片是户外白纱转身，看头纱展开，礼服以照片为准。',
      createdAt: DEMO_AT,
    },
    {
      id: 'inv_mermaid',
      name: '鱼尾蕾丝蓬裙',
      category: '服装',
      imageDataUrl: demoImage('/assets/inventory/gown-mermaid.jpg', '#f4f7fb', '#e5d6cc', '鱼尾'),
      videoUrl: '/assets/videos/bride-pose.mp4',
      colors: ['白色'],
      styles: ['鱼尾', '蕾丝', '新娘'],
      occasions: ['婚礼', '写真'],
      notes: '鱼尾收腰再放开蓬裙。短片是花园里的抹胸白纱，看上身和头纱，不是这一件鱼尾的实拍。',
      createdAt: DEMO_AT,
    },
    {
      id: 'inv_blue',
      name: '雾霾蓝晚礼服',
      category: '服装',
      imageDataUrl: demoImage('/assets/inventory/gown-blue.jpg', '#8aa4c8', '#d5deea', '晚礼'),
      colors: ['雾霾蓝'],
      styles: ['晚宴', '飘逸', '高级'],
      occasions: ['派对', '舞台', '写真'],
      notes: '冷色长裙适合冷淡妆和烟熏，不建议再配正红唇抢色。婚礼主纱场景里它是晚宴备选。',
      createdAt: DEMO_AT,
    },
    {
      id: 'inv_rings_heart',
      name: '粉缎金对戒',
      category: '饰品',
      imageDataUrl: demoImage('/assets/inventory/rings-heart.jpg', '#f6e4ea', '#d4af37', '对戒'),
      colors: ['金色', '粉色'],
      styles: ['新娘', '甜美'],
      occasions: ['婚礼', '约会', '写真'],
      notes: '金色对戒配粉色丝带，适合暖调和甜美新娘。手部特写不要再戴很粗的手链。',
      createdAt: DEMO_AT,
    },
    {
      id: 'inv_rings_gold',
      name: '磨砂金对戒',
      category: '饰品',
      imageDataUrl: demoImage('/assets/inventory/rings-gold.jpg', '#f3ead2', '#c9a66b', '金戒'),
      colors: ['金色'],
      styles: ['简约', '新娘', '优雅'],
      occasions: ['婚礼', '日常'],
      notes: '素圈金戒，白纱都能压住。金属是暖金，和银色首饰不要叠太多。',
      createdAt: DEMO_AT,
    },
  ];

  data.works = demoWorks;
  data.inventory = demoInventory;
}

/** 演示图优先用 /assets 实拍；路径缺失时才退回渐变占位 */
function demoImage(path: string, c1: string, c2: string, label: string): string {
  if (path.startsWith('/assets/')) return path;
  return makeGradientThumb(c1, c2, label);
}

function makeGradientThumb(c1: string, c2: string, label: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 500;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 400, 500);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 400, 500);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(200, 220, 90, 110, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,20,30,0.55)';
  ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 200, 460);
  return canvas.toDataURL('image/jpeg', 0.85);
}
