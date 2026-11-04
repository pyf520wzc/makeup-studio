import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import type {
  FaceShape,
  InventoryItem,
  MakeupStyle,
  Occasion,
  SkinTone,
  WorkItem,
} from '../types';
import {
  deleteInventory,
  deleteWork,
  loadDemoData,
  seedDemoIfEmpty,
  uid,
  upsertInventory,
  upsertWork,
} from '../lib/storage';
import { compressImage, readFileAsDataUrl } from '../lib/file';
import { Toast } from '../components/Toast';

const STYLES: MakeupStyle[] = [
  '清透自然',
  '韩系甜美',
  '欧美立体',
  '复古红唇',
  '冷淡高级',
  '日系可爱',
  '国潮戏曲',
  '新娘妆',
];
const OCCASIONS: Occasion[] = [
  '日常',
  '约会',
  '婚礼',
  '派对',
  '职场',
  '写真',
  '舞台',
];
const FACES: FaceShape[] = [
  '鹅蛋脸',
  '圆脸',
  '方脸',
  '长脸',
  '心形脸',
  '菱形脸',
];
const TONES: SkinTone[] = [
  '冷白皮',
  '暖白皮',
  '自然中性',
  '暖黄皮',
  '深肤色',
];

type Tab = 'works' | 'inventory';

export function Artist() {
  const [params] = useSearchParams();
  const needWorks = params.get('need') === 'works';
  const [tab, setTab] = useState<Tab>('works');
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState('');
  const data = useMemo(() => {
    void tick;
    return seedDemoIfEmpty();
  }, [tick]);

  const refresh = () => setTick((t) => t + 1);
  const notify = (m: string) => setToast(m);

  return (
    <>
      <div className="section-head">
        <div>
          <h2>化妆师工作台</h2>
          <p className="muted" style={{ margin: 0 }}>
            录入造型作品与店内服装饰品，供客户分析后智能推荐
          </p>
        </div>
        <div className="cta-row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              loadDemoData();
              refresh();
              notify('已载入演示数据');
            }}
          >
            载入演示数据
          </button>
          <Link className="btn btn-secondary" to="/sessions">
            还原台
          </Link>
        </div>
      </div>
      {needWorks && data.works.length === 0 && (
        <div className="privacy-banner panel" style={{ marginBottom: 16 }}>
          <strong>客户流程已拦截：</strong>
          作品库为空，请先在下方录入至少 1 个造型作品（建议同时录入服装/饰品），再回「新客户」分析。
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${tab === 'works' ? 'active' : ''}`}
          onClick={() => setTab('works')}
        >
          造型妆容作品库
        </button>
        <button
          className={`tab ${tab === 'inventory' ? 'active' : ''}`}
          onClick={() => setTab('inventory')}
        >
          服装 / 饰品库
        </button>
      </div>

      {tab === 'works' ? (
        <WorksPanel
          works={data.works}
          onSaved={() => {
            refresh();
            notify('作品已保存');
          }}
          onDeleted={() => {
            refresh();
            notify('作品已删除');
          }}
        />
      ) : (
        <InventoryPanel
          items={data.inventory}
          onSaved={() => {
            refresh();
            notify('库存已保存');
          }}
          onDeleted={() => {
            refresh();
            notify('库存已删除');
          }}
        />
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}

function WorksPanel({
  works,
  onSaved,
  onDeleted,
}: {
  works: WorkItem[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState('');
  const [makeupType, setMakeupType] = useState('日常淡妆');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [image, setImage] = useState('');
  const [styles, setStyles] = useState<MakeupStyle[]>(['清透自然']);
  const [occasions, setOccasions] = useState<Occasion[]>(['日常']);
  const [faces, setFaces] = useState<FaceShape[]>(['鹅蛋脸']);
  const [tones, setTones] = useState<SkinTone[]>(['自然中性']);
  const [busy, setBusy] = useState(false);

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const raw = await readFileAsDataUrl(file);
      const compressed = await compressImage(raw);
      setImage(compressed);
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!title.trim() || !image) {
      alert('请填写作品标题并上传图片');
      return;
    }
    const item: WorkItem = {
      id: uid('work'),
      title: title.trim(),
      imageDataUrl: image,
      styles,
      occasions,
      makeupType: makeupType.trim() || '未分类',
      suitableFaces: faces,
      suitableTones: tones,
      tags: tags
        .split(/[,，、\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
      notes,
      createdAt: new Date().toISOString(),
    };
    upsertWork(item);
    setTitle('');
    setNotes('');
    setTags('');
    setImage('');
    onSaved();
  };

  return (
    <div className="grid-2">
      <section className="panel">
        <h3>
          <Plus size={16} style={{ verticalAlign: '-2px' }} /> 新增作品
        </h3>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="upload-box">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {image ? (
              <div className="preview">
                <img src={image} alt="作品预览" />
              </div>
            ) : (
              <>
                <strong>点击上传造型照片</strong>
                <p className="muted">支持常见图片格式，将自动压缩便于本地存储</p>
              </>
            )}
          </label>

          <label className="field">
            <span>作品标题</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：清透约会妆"
            />
          </label>

          <div className="form-row">
            <label className="field">
              <span>妆容类型</span>
              <input
                type="text"
                value={makeupType}
                onChange={(e) => setMakeupType(e.target.value)}
                placeholder="日常淡妆 / 新娘妆 / 晚宴妆"
              />
            </label>
            <label className="field">
              <span>标签（逗号分隔）</span>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="水光唇, 卧蚕"
              />
            </label>
          </div>

          <div className="field">
            <span>风格</span>
            <div className="chip-group" style={{ marginTop: 6 }}>
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${styles.includes(s) ? 'on' : ''}`}
                  onClick={() => toggle(styles, s, setStyles)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>场合</span>
            <div className="chip-group" style={{ marginTop: 6 }}>
              {OCCASIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${occasions.includes(s) ? 'on' : ''}`}
                  onClick={() => toggle(occasions, s, setOccasions)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>适合脸型</span>
            <div className="chip-group" style={{ marginTop: 6 }}>
              {FACES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${faces.includes(s) ? 'on' : ''}`}
                  onClick={() => toggle(faces, s, setFaces)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>适合肤色</span>
            <div className="chip-group" style={{ marginTop: 6 }}>
              {TONES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${tones.includes(s) ? 'on' : ''}`}
                  onClick={() => toggle(tones, s, setTones)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>备注</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="还原要点、产品建议等"
            />
          </label>

          <button className="btn btn-primary" onClick={save} disabled={busy}>
            保存到作品库
          </button>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h3 style={{ margin: 0 }}>已录入 {works.length} 个作品</h3>
        </div>
        {works.length === 0 ? (
          <div className="empty">还没有作品，先上传一张造型照吧</div>
        ) : (
          <div className="card-grid">
            {works.map((w) => (
              <article key={w.id} className="panel work-card" style={{ padding: 0 }}>
                <div className="thumb">
                  <img src={w.imageDataUrl} alt={w.title} />
                </div>
                <div className="body">
                  <strong>{w.title}</strong>
                  <div className="tag-row">
                    <span className="tag gold">{w.makeupType}</span>
                    {w.styles.slice(0, 2).map((s) => (
                      <span className="tag" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    {w.occasions.join(' · ')}
                  </p>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '8px 12px', justifyContent: 'center' }}
                    onClick={() => {
                      if (confirm(`删除作品「${w.title}」？`)) {
                        deleteWork(w.id);
                        onDeleted();
                      }
                    }}
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InventoryPanel({
  items,
  onSaved,
  onDeleted,
}: {
  items: InventoryItem[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] =
    useState<InventoryItem['category']>('饰品');
  const [colors, setColors] = useState('金色');
  const [styles, setStyles] = useState('优雅');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState('');
  const [occasions, setOccasions] = useState<Occasion[]>(['日常']);
  const [busy, setBusy] = useState(false);

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const raw = await readFileAsDataUrl(file);
      setImage(await compressImage(raw, 700));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!name.trim() || !image) {
      alert('请填写名称并上传图片');
      return;
    }
    const item: InventoryItem = {
      id: uid('inv'),
      name: name.trim(),
      category,
      imageDataUrl: image,
      colors: colors.split(/[,，、\s]+/).filter(Boolean),
      styles: styles.split(/[,，、\s]+/).filter(Boolean),
      occasions,
      notes,
      createdAt: new Date().toISOString(),
    };
    upsertInventory(item);
    setName('');
    setNotes('');
    setImage('');
    onSaved();
  };

  return (
    <div className="grid-2">
      <section className="panel">
        <h3>新增服装 / 饰品</h3>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="upload-box">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {image ? (
              <div className="preview">
                <img src={image} alt="库存预览" />
              </div>
            ) : (
              <>
                <strong>点击上传实物照片</strong>
                <p className="muted">饰品、服装、假发、道具均可</p>
              </>
            )}
          </label>

          <div className="form-row">
            <label className="field">
              <span>名称</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="珍珠耳钉"
              />
            </label>
            <label className="field">
              <span>分类</span>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as InventoryItem['category'])
                }
              >
                <option value="饰品">饰品</option>
                <option value="服装">服装</option>
                <option value="假发">假发</option>
                <option value="道具">道具</option>
              </select>
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              <span>颜色</span>
              <input
                value={colors}
                onChange={(e) => setColors(e.target.value)}
                placeholder="金色, 象牙白"
              />
            </label>
            <label className="field">
              <span>风格关键词</span>
              <input
                value={styles}
                onChange={(e) => setStyles(e.target.value)}
                placeholder="优雅, 新娘"
              />
            </label>
          </div>

          <div className="field">
            <span>适合场合</span>
            <div className="chip-group" style={{ marginTop: 6 }}>
              {OCCASIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${occasions.includes(s) ? 'on' : ''}`}
                  onClick={() => toggle(occasions, s, setOccasions)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>备注</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <button className="btn btn-primary" onClick={save} disabled={busy}>
            保存到库存
          </button>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h3 style={{ margin: 0 }}>库存 {items.length} 件</h3>
        </div>
        {items.length === 0 ? (
          <div className="empty">库存为空</div>
        ) : (
          <div className="card-grid">
            {items.map((item) => (
              <article
                key={item.id}
                className="panel work-card"
                style={{ padding: 0 }}
              >
                <div className="thumb">
                  <img src={item.imageDataUrl} alt={item.name} />
                </div>
                <div className="body">
                  <strong>{item.name}</strong>
                  <div className="tag-row">
                    <span className="tag gold">{item.category}</span>
                    {item.colors.slice(0, 2).map((c) => (
                      <span className="tag" key={c}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '8px 12px', justifyContent: 'center' }}
                    onClick={() => {
                      if (confirm(`删除「${item.name}」？`)) {
                        deleteInventory(item.id);
                        onDeleted();
                      }
                    }}
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function toggle<T>(list: T[], value: T, set: (v: T[]) => void) {
  set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
}

