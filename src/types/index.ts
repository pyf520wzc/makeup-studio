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
  /** 可选短片，公网路径如 /assets/videos/xxx.mp4 */
  videoUrl?: string;
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
  /** 可选短片，公网路径如 /assets/videos/xxx.mp4 */
  videoUrl?: string;
  colors: string[];
  styles: string[];
  occasions: Occasion[];
  notes: string;
  createdAt: string;
}

/** 照片分区测量后的五官说明（参考，不是医学结论） */
export interface FacialFeatureNote {
  part: '眼' | '眉' | '鼻' | '唇' | '轮廓' | '肤色';
  text: string;
}

/** 供推荐理由引用的测量值。宽度、高度、三庭都是相对这张脸的比例（0–1） */
export interface AnalysisCues {
  eyeDelta: number;
  eyeContrast: number;
  eyeAsymmetry: number;
  /** 眼部暗区宽度 / 脸宽 */
  eyeWidth: number;
  browContrast: number;
  /** 眉部暗区宽度 / 脸宽 */
  browWidth: number;
  noseHighlight: number;
  noseWidth: number;
  lipRedness: number;
  /** 唇色区域宽度 / 脸宽 */
  lipWidth: number;
  /** 唇色区域高度 / 脸高 */
  lipHeight: number;
  faceRatio: number;
  foreheadWidth: number;
  cheekWidth: number;
  jawWidth: number;
  /** 三庭：眉以上 / 眉到唇 / 唇以下，相对脸高 */
  upperShare: number;
  midShare: number;
  lowerShare: number;
  usedSkinMask: boolean;
}

/** 一条可被图库作品对上的优点或缺点 */
export interface FeatureVerdict {
  aim: '优点' | '缺点';
  part: FacialFeatureNote['part'];
  text: string;
  /** 在作品标题、风格、标签里查找，不对上就不推荐这句 */
  match: string;
}

export interface FeatureAnalysis {
  faceShape: FaceShape;
  skinTone: SkinTone;
  strengths: string[];
  weaknesses: string[];
  directions: string[];
  /** 一段把测量结果连起来的说明 */
  summary?: string;
  /** 眼、眉、鼻、唇、轮廓、肤色的具体描述 */
  featureDetails?: FacialFeatureNote[];
  /** 分区测量，推荐文案会引用这些数字 */
  cues?: AnalysisCues;
  /** 优缺点，以及用来对照图库的匹配词 */
  verdicts?: FeatureVerdict[];
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
  /** 分析时选择的场合，试妆页据此写推荐理由 */
  occasion?: Occasion;
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
