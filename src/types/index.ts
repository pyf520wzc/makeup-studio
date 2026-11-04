export type Occasion =
  | '日常'
  | '约会'
  | '婚礼'
  | '派对'
  | '职场'
  | '写真'
  | '舞台';

export type MakeupStyle =
  | '清透自然'
  | '韩系甜美'
  | '欧美立体'
  | '复古红唇'
  | '冷淡高级'
  | '日系可爱'
  | '国潮戏曲'
  | '新娘妆';

export type FaceShape =
  | '鹅蛋脸'
  | '圆脸'
  | '方脸'
  | '长脸'
  | '心形脸'
  | '菱形脸';

export type SkinTone = '冷白皮' | '暖白皮' | '自然中性' | '暖黄皮' | '深肤色';

export type SessionStatus = 'draft' | 'confirmed';

export interface WorkItem {
  id: string;
  title: string;
  imageDataUrl: string;
  styles: MakeupStyle[];
  occasions: Occasion[];
  makeupType: string;
  suitableFaces: FaceShape[];
  suitableTones: SkinTone[];
  tags: string[];
  notes: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: '服装' | '饰品' | '假发' | '道具';
  imageDataUrl: string;
  colors: string[];
  styles: string[];
  occasions: Occasion[];
  notes: string;
  createdAt: string;
}

export interface FeatureAnalysis {
  faceShape: FaceShape;
  skinTone: SkinTone;
  strengths: string[];
  weaknesses: string[];
  directions: string[];
  brightness: number;
  warmth: number;
  contrast: number;
  confidence: number;
}

export interface ClientSession {
  id: string;
  name: string;
  avatarDataUrl: string;
  analysis: FeatureAnalysis;
  recommendedWorkIds: string[];
  recommendedInventoryIds: string[];
  selectedWorkIds: string[];
  /** 客户/试妆页选中的服装与饰品 */
  selectedInventoryIds: string[];
  /** 最近一次试妆成套（造型+服装+饰品） */
  outfit?: OutfitSelection;
  /** 草稿 / 已确认成套 */
  status?: SessionStatus;
  /** 确认成套时间 */
  confirmedAt?: string;
  /** 化妆师还原完成后的实拍与还原度 */
  restoration?: RestorationRecord;
  notes: string;
  createdAt: string;
}

export interface AppData {
  works: WorkItem[];
  inventory: InventoryItem[];
  sessions: ClientSession[];
}

/** 试妆搭配当前成套选择（可挂在会话上） */
export interface OutfitSelection {
  workId: string | null;
  clothingId: string | null;
  accessoryIds: string[];
}

/** 化妆师还原实拍与还原度分析结果 */
export interface RestorationRecord {
  photoDataUrl: string;
  /** 对比所用的参考图（成套造型或已选作品） */
  referenceDataUrl: string;
  referenceLabel: string;
  score: number;
  summary: string;
  details: string[];
  colorScore: number;
  brightnessScore: number;
  structureScore: number;
  analyzedAt: string;
}
