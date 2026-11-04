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

function fillDemo(data: AppData): void {
  const demoWorks: WorkItem[] = [
    {
      id: uid('work'),
      title: '清透约会妆',
      imageDataUrl: makeGradientThumb('#f8c8d8', '#fff5f8', '清透'),
      styles: ['清透自然', '韩系甜美'],
      occasions: ['约会', '日常'],
      makeupType: '日常淡妆',
      suitableFaces: ['鹅蛋脸', '圆脸', '心形脸'],
      suitableTones: ['冷白皮', '暖白皮', '自然中性'],
      tags: ['水光唇', '卧蚕', '桃花眼'],
      notes: '强调自然水光感，适合第一次试妆的客户。',
      createdAt: new Date().toISOString(),
    },
    {
      id: uid('work'),
      title: '新娘温柔妆',
      imageDataUrl: makeGradientThumb('#e8b4b8', '#faf0e6', '新娘'),
      styles: ['新娘妆', '韩系甜美'],
      occasions: ['婚礼', '写真'],
      makeupType: '新娘妆',
      suitableFaces: ['鹅蛋脸', '心形脸', '长脸'],
      suitableTones: ['冷白皮', '暖白皮', '自然中性'],
      tags: ['柔光底妆', '豆沙唇', '精致眼线'],
      notes: '持久柔光，适合婚礼跟妆全程。',
      createdAt: new Date().toISOString(),
    },
    {
      id: uid('work'),
      title: '冷淡高级烟熏',
      imageDataUrl: makeGradientThumb('#2c2c34', '#c9a7a0', '冷淡'),
      styles: ['冷淡高级', '欧美立体'],
      occasions: ['派对', '写真', '舞台'],
      makeupType: '晚宴妆',
      suitableFaces: ['方脸', '菱形脸', '长脸'],
      suitableTones: ['冷白皮', '自然中性', '深肤色'],
      tags: ['修容', '雾面唇', '深邃眼妆'],
      notes: '立体修容与雾面唇，适合派对与舞台。',
      createdAt: new Date().toISOString(),
    },
    {
      id: uid('work'),
      title: '复古红唇经典',
      imageDataUrl: makeGradientThumb('#8b1e3f', '#f5e6d3', '红唇'),
      styles: ['复古红唇', '欧美立体'],
      occasions: ['派对', '写真', '婚礼'],
      makeupType: '复古妆',
      suitableFaces: ['鹅蛋脸', '心形脸', '方脸'],
      suitableTones: ['暖白皮', '暖黄皮', '自然中性'],
      tags: ['正红唇', '猫眼线', '高光'],
      notes: '经典红唇与猫眼线，气场强。',
      createdAt: new Date().toISOString(),
    },
  ];

  const demoInventory: InventoryItem[] = [
    {
      id: uid('inv'),
      name: '珍珠耳钉套装',
      category: '饰品',
      imageDataUrl: makeGradientThumb('#f5f0e8', '#d4af37', '珍珠'),
      colors: ['象牙白', '金色'],
      styles: ['优雅', '新娘'],
      occasions: ['婚礼', '约会', '写真'],
      notes: '小巧精致，适合清透与新娘妆。',
      createdAt: new Date().toISOString(),
    },
    {
      id: uid('inv'),
      name: '香槟色晚礼服披肩',
      category: '服装',
      imageDataUrl: makeGradientThumb('#e8d5b7', '#c9a66b', '礼服'),
      colors: ['香槟金'],
      styles: ['晚宴', '高级'],
      occasions: ['派对', '婚礼'],
      notes: '与冷淡高级妆搭配效果好。',
      createdAt: new Date().toISOString(),
    },
    {
      id: uid('inv'),
      name: '花朵发夹组合',
      category: '饰品',
      imageDataUrl: makeGradientThumb('#ffd6e0', '#ff9eb5', '花朵'),
      colors: ['粉色', '白色'],
      styles: ['甜美', '日系'],
      occasions: ['日常', '约会', '写真'],
      notes: '适合韩系甜美与日系可爱造型。',
      createdAt: new Date().toISOString(),
    },
  ];

  data.works = demoWorks;
  data.inventory = demoInventory;
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
