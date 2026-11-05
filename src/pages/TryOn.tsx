import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check,
  Layers,
  RefreshCw,
  Shirt,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { FeatureNotes } from '../components/FeatureNotes';
import { ReasonBlock } from '../components/ReasonBlock';
import { TryOnPreview } from '../components/TryOnPreview';
import { Toast } from '../components/Toast';
import { compressImage, readFileAsDataUrl } from '../lib/file';
import { recommendInventory, recommendWorks } from '../lib/recommend';
import { loadData, seedDemoIfEmpty, upsertSession } from '../lib/storage';
import { trackEvent } from '../lib/analytics';
import type { ClientSession, InventoryItem, WorkItem } from '../types';

type SourceFilter = 'recommended' | 'all';

export function TryOn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState('');
  const [faceUrl, setFaceUrl] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [workId, setWorkId] = useState<string | null>(null);
  const [clothingId, setClothingId] = useState<string | null>(null);
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  const [makeupOpacity, setMakeupOpacity] = useState(0.72);
  const [clothingOpacity, setClothingOpacity] = useState(0.88);
  const [workSource, setWorkSource] = useState<SourceFilter>('recommended');
  const [invSource, setInvSource] = useState<SourceFilter>('recommended');
  const [dirty, setDirty] = useState(false);

  const data = useMemo(() => {
    void tick;
    seedDemoIfEmpty();
    return loadData();
  }, [tick]);

  const sessions = data.sessions;

  useEffect(() => {
    const fromQuery = params.get('session');
    const target =
      sessions.find((s) => s.id === fromQuery) ?? sessions[0] ?? null;
    if (!target) return;
    if (sessionId === target.id && faceUrl) return;
    applySession(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, sessions.length]);

  const applySession = (s: ClientSession) => {
    setSessionId(s.id);
    setFaceUrl(s.avatarDataUrl);
    const outfit = s.outfit;
    const nextWork =
      outfit?.workId ??
      s.selectedWorkIds[0] ??
      s.recommendedWorkIds[0] ??
      null;
    setWorkId(nextWork);
    const clothingFromOutfit = outfit?.clothingId ?? null;
    const clothingFromSelected =
      s.selectedInventoryIds?.find((id) => {
        const item = data.inventory.find((i) => i.id === id);
        return item?.category === '服装';
      }) ?? null;
    const clothingFromRec =
      s.recommendedInventoryIds.find((id) => {
        const item = data.inventory.find((i) => i.id === id);
        return item?.category === '服装';
      }) ?? null;
    setClothingId(clothingFromOutfit || clothingFromSelected || clothingFromRec);
    const acc =
      outfit?.accessoryIds ??
      (s.selectedInventoryIds?.length
        ? s.selectedInventoryIds.filter((id) => {
            const item = data.inventory.find((i) => i.id === id);
            return item && item.category !== '服装';
          })
        : s.recommendedInventoryIds
            .filter((id) => {
              const item = data.inventory.find((i) => i.id === id);
              return item && item.category !== '服装';
            })
            .slice(0, 2));
    setAccessoryIds(acc);
    setDirty(false);
  };

  const activeSession = sessions.find((s) => s.id === sessionId) ?? null;
  const isConfirmed = activeSession?.status === 'confirmed';

  const markDirty = () => setDirty(true);

  const workList = useMemo(() => {
    if (workSource === 'all' || !activeSession) return data.works;
    const ids = new Set([
      ...activeSession.recommendedWorkIds,
      ...activeSession.selectedWorkIds,
    ]);
    const preferred = data.works.filter((w) => ids.has(w.id));
    return preferred.length ? preferred : data.works;
  }, [workSource, activeSession, data.works]);

  const clothingList = useMemo(() => {
    const all = data.inventory.filter((i) => i.category === '服装');
    if (invSource === 'all' || !activeSession) return all;
    const ids = new Set([
      ...activeSession.recommendedInventoryIds,
      ...(activeSession.selectedInventoryIds ?? []),
    ]);
    const preferred = all.filter((i) => ids.has(i.id));
    return preferred.length ? preferred : all;
  }, [invSource, activeSession, data.inventory]);

  const accessoryList = useMemo(() => {
    const all = data.inventory.filter((i) => i.category !== '服装');
    if (invSource === 'all' || !activeSession) return all;
    const ids = new Set([
      ...activeSession.recommendedInventoryIds,
      ...(activeSession.selectedInventoryIds ?? []),
    ]);
    const preferred = all.filter((i) => ids.has(i.id));
    return preferred.length ? preferred : all;
  }, [invSource, activeSession, data.inventory]);

  const occasion = activeSession?.occasion ?? '';
  const workScores = useMemo(() => {
    if (!activeSession) return [];
    return recommendWorks(activeSession.analysis, data.works, occasion);
  }, [activeSession, data.works, occasion]);
  const invScores = useMemo(() => {
    if (!activeSession) return [];
    const top = workScores.slice(0, 3).map((item) => item.work);
    return recommendInventory(activeSession.analysis, data.inventory, top, occasion);
  }, [activeSession, data.inventory, workScores, occasion]);
  const workReason = useMemo(
    () => new Map(workScores.map((item) => [item.work.id, item.reasons])),
    [workScores],
  );
  const invReason = useMemo(
    () => new Map(invScores.map((item) => [item.item.id, item.reasons])),
    [invScores],
  );

  const selectedWork = data.works.find((w) => w.id === workId) ?? null;
  const selectedClothing =
    data.inventory.find((i) => i.id === clothingId) ?? null;
  const selectedAccessories = accessoryIds
    .map((id) => data.inventory.find((i) => i.id === id))
    .filter(Boolean) as InventoryItem[];

  const onFaceFile = async (file?: File | null) => {
    if (!file) return;
    const raw = await readFileAsDataUrl(file);
    setFaceUrl(await compressImage(raw, 900));
    markDirty();
    setToast('已更新试妆人脸');
  };

  const toggleAccessory = (id: string) => {
    setAccessoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    markDirty();
  };

  const clearOutfit = () => {
    setWorkId(null);
    setClothingId(null);
    setAccessoryIds([]);
    markDirty();
    setToast('已清空成套搭配');
  };

  const buildOutfitPayload = () => {
    const invIds = [...(clothingId ? [clothingId] : []), ...accessoryIds];
    return {
      selectedWorkIds: workId
        ? Array.from(
            new Set([workId, ...(activeSession?.selectedWorkIds ?? [])]),
          )
        : (activeSession?.selectedWorkIds ?? []),
      selectedInventoryIds: invIds,
      outfit: {
        workId,
        clothingId,
        accessoryIds,
      },
    };
  };

  const saveDraft = () => {
    if (!activeSession) {
      setToast('请先在「新客户」完成分析并保存会话');
      return;
    }
    upsertSession({
      ...activeSession,
      ...buildOutfitPayload(),
      status: 'draft',
    });
    trackEvent('outfit_draft_saved', { sessionId: activeSession.id });
    setTick((t) => t + 1);
    setDirty(false);
    setToast('草稿已保存（未确认）');
  };

  const confirmOutfit = () => {
    if (!activeSession) {
      setToast('请先在「新客户」完成分析');
      return;
    }
    if (!workId) {
      setToast('请至少选择一款造型后再确认成套');
      return;
    }
    if (
      !confirm(
        dirty || activeSession.status !== 'confirmed'
          ? '确认此成套？化妆师还原台将优先按这一套施工。'
          : '更新已确认成套？将覆盖上一版确认。',
      )
    ) {
      return;
    }
    const confirmedAt = new Date().toISOString();
    upsertSession({
      ...activeSession,
      ...buildOutfitPayload(),
      status: 'confirmed',
      confirmedAt,
    });
    trackEvent('outfit_confirmed', {
      sessionId: activeSession.id,
      meta: { workId, clothingId: clothingId ?? '' },
    });
    setTick((t) => t + 1);
    setDirty(false);
    setToast('成套已确认');
    navigate(`/sessions?id=${activeSession.id}`);
  };

  return (
    <>
      <div className="section-head">
        <div>
          <h2>试妆搭配 · 实时合成</h2>
          <p className="muted" style={{ margin: 0 }}>
            人脸为底，点选造型/服装即可切换
            {isConfirmed && !dirty ? ' · 当前会话已确认成套' : ''}
            {dirty ? ' · 有未保存更改' : ''}
          </p>
        </div>
        <div className="cta-row">
          <Link className="btn btn-ghost" to="/client">
            返回分析
          </Link>
          <button className="btn btn-secondary" type="button" onClick={clearOutfit}>
            <RefreshCw size={16} /> 清空
          </button>
          <button className="btn btn-ghost" type="button" onClick={saveDraft}>
            存草稿
          </button>
          <button className="btn btn-primary" type="button" onClick={confirmOutfit}>
            <Check size={16} /> 确认此成套
          </button>
        </div>
      </div>

      <div className="tryon-confirm-bar">
        <button
          type="button"
          className="btn btn-primary tryon-confirm-main"
          onClick={confirmOutfit}
        >
          <Check size={18} /> 确认此成套，去还原台
        </button>
        {dirty && <span className="tag gold">未保存</span>}
        {isConfirmed && !dirty && <span className="tag score">已确认</span>}
      </div>

      {activeSession && (
        <details className="panel feature-fold" open>
          <summary>
            本次五官特点（参考）· {activeSession.analysis.faceShape} ·{' '}
            {activeSession.analysis.skinTone}
            {activeSession.occasion ? ` · ${activeSession.occasion}` : ''}
          </summary>
          <FeatureNotes analysis={activeSession.analysis} works={data.works} />
        </details>
      )}

      <div className="tryon-layout">
        <aside className="panel tryon-side">
          <h3>
            <Upload size={16} style={{ verticalAlign: '-2px' }} /> 人脸来源
          </h3>
          {sessions.length > 0 && (
            <label className="field">
              <span>从已保存会话载入</span>
              <select
                value={sessionId ?? ''}
                onChange={(e) => {
                  const s = sessions.find((x) => x.id === e.target.value);
                  if (s) applySession(s);
                }}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.status === 'confirmed' ? '已确认' : '草稿'} ·{' '}
                    {s.analysis.faceShape}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="upload-box" style={{ padding: 14 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFaceFile(e.target.files?.[0])}
            />
            <strong>或直接上传人脸</strong>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              正脸、光线均匀效果更好
            </p>
          </label>

          <div className="tryon-sliders">
            <label className="field">
              <span>妆造叠加强度 {Math.round(makeupOpacity * 100)}%</span>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.02}
                value={makeupOpacity}
                onChange={(e) => setMakeupOpacity(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>服装可见度 {Math.round(clothingOpacity * 100)}%</span>
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.02}
                value={clothingOpacity}
                onChange={(e) => setClothingOpacity(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="tryon-checklist">
            <h3>
              <Layers size={16} style={{ verticalAlign: '-2px' }} /> 当前成套清单
            </h3>
            <ul>
              <li>
                <span className="tag gold">造型</span>{' '}
                {selectedWork ? selectedWork.title : '未选择'}
                {selectedWork && (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => {
                      setWorkId(null);
                      markDirty();
                    }}
                    aria-label="移除造型"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
              <li>
                <span className="tag gold">服装</span>{' '}
                {selectedClothing ? selectedClothing.name : '未选择'}
                {selectedClothing && (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => {
                      setClothingId(null);
                      markDirty();
                    }}
                    aria-label="移除服装"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
              <li>
                <span className="tag gold">饰品</span>{' '}
                {selectedAccessories.length
                  ? selectedAccessories.map((a) => a.name).join('、')
                  : '未选择'}
              </li>
            </ul>
            {!faceUrl && (
              <p className="muted" style={{ fontSize: 13 }}>
                还没有人脸：请上传，或先到{' '}
                <Link to="/client">新客户分析</Link> 完成分析。
              </p>
            )}
          </div>
        </aside>

        <section className="panel tryon-preview-wrap">
          <TryOnPreview
            faceUrl={faceUrl}
            work={selectedWork}
            clothing={selectedClothing}
            accessories={selectedAccessories}
            makeupOpacity={makeupOpacity}
            clothingOpacity={clothingOpacity}
          />
          <p className="muted tryon-hint">
            <Sparkles size={14} style={{ verticalAlign: '-2px' }} />{' '}
            切换下方造型/服装/饰品时，预览会实时更新
          </p>
          <ClipRow
            clips={[
              selectedWork?.videoUrl
                ? {
                    url: selectedWork.videoUrl,
                    poster: selectedWork.imageDataUrl,
                    label: selectedWork.title,
                  }
                : null,
              selectedClothing?.videoUrl
                ? {
                    url: selectedClothing.videoUrl,
                    poster: selectedClothing.imageDataUrl,
                    label: selectedClothing.name,
                  }
                : null,
            ]}
          />
        </section>
      </div>

      <div className="section-head" style={{ marginTop: 28 }}>
        <div>
          <h2>造型妆造</h2>
          <p className="muted" style={{ margin: 0 }}>
            单选 · 点击切换
          </p>
        </div>
        <div className="tabs">
          <button
            type="button"
            className={`tab ${workSource === 'recommended' ? 'active' : ''}`}
            onClick={() => setWorkSource('recommended')}
          >
            推荐优先
          </button>
          <button
            type="button"
            className={`tab ${workSource === 'all' ? 'active' : ''}`}
            onClick={() => setWorkSource('all')}
          >
            全部作品库
          </button>
        </div>
      </div>

      <div className="picker-row">
        {workList.length === 0 ? (
          <div className="empty">作品库为空，请到化妆师端录入</div>
        ) : (
          workList.map((w: WorkItem) => {
            const on = workId === w.id;
            return (
              <button
                key={w.id}
                type="button"
                className={`picker-card ${on ? 'on' : ''}`}
                onClick={() => {
                  setWorkId(w.id);
                  markDirty();
                }}
              >
                <img src={w.imageDataUrl} alt={w.title} />
                <div className="picker-meta">
                  <span>{w.title}</span>
                  {(workSource === 'recommended' ||
                    activeSession?.recommendedWorkIds.includes(w.id)) && (
                    <ReasonBlock reasons={workReason.get(w.id) ?? []} compact />
                  )}
                </div>
                {on && <em className="tag score">使用中</em>}
              </button>
            );
          })
        )}
      </div>

      <div className="section-head" style={{ marginTop: 28 }}>
        <div>
          <h2>
            <Shirt size={18} style={{ verticalAlign: '-3px' }} /> 服装
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            单选 · 可与造型自由搭配
          </p>
        </div>
        <div className="tabs">
          <button
            type="button"
            className={`tab ${invSource === 'recommended' ? 'active' : ''}`}
            onClick={() => setInvSource('recommended')}
          >
            推荐优先
          </button>
          <button
            type="button"
            className={`tab ${invSource === 'all' ? 'active' : ''}`}
            onClick={() => setInvSource('all')}
          >
            全部库存
          </button>
        </div>
      </div>

      <div className="picker-row">
        {clothingList.length === 0 ? (
          <div className="empty">暂无服装库存</div>
        ) : (
          clothingList.map((item) => {
            const on = clothingId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`picker-card ${on ? 'on' : ''}`}
                onClick={() => {
                  setClothingId((prev) => (prev === item.id ? null : item.id));
                  markDirty();
                }}
              >
                <img src={item.imageDataUrl} alt={item.name} />
                <div className="picker-meta">
                  <span>{item.name}</span>
                  {(invSource === 'recommended' ||
                    activeSession?.recommendedInventoryIds.includes(item.id)) && (
                    <ReasonBlock reasons={invReason.get(item.id) ?? []} compact />
                  )}
                </div>
                {on && <em className="tag score">使用中</em>}
              </button>
            );
          })
        )}
      </div>

      <div className="section-head" style={{ marginTop: 28 }}>
        <div>
          <h2>饰品 / 假发 / 道具</h2>
          <p className="muted" style={{ margin: 0 }}>
            可多选叠加；再次点击取消
          </p>
        </div>
      </div>

      <div className="picker-row" style={{ marginBottom: 12 }}>
        {accessoryList.length === 0 ? (
          <div className="empty">暂无饰品库存</div>
        ) : (
          accessoryList.map((item) => {
            const on = accessoryIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`picker-card ${on ? 'on' : ''}`}
                onClick={() => toggleAccessory(item.id)}
              >
                <img src={item.imageDataUrl} alt={item.name} />
                <div className="picker-meta">
                  <span>
                    {item.name}
                    <small className="muted"> · {item.category}</small>
                  </span>
                  {(invSource === 'recommended' ||
                    activeSession?.recommendedInventoryIds.includes(item.id)) && (
                    <ReasonBlock reasons={invReason.get(item.id) ?? []} compact />
                  )}
                </div>
                {on && <em className="tag score">叠加中</em>}
              </button>
            );
          })
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}

function ClipRow({
  clips,
}: {
  clips: Array<{ url: string; poster: string; label: string } | null>;
}) {
  const ready = clips.filter((clip): clip is { url: string; poster: string; label: string } =>
    Boolean(clip),
  );
  if (!ready.length) return null;
  return (
    <div className="clip-row">
      {ready.map((clip) => (
        <figure key={clip.url}>
          <video
            src={clip.url}
            poster={clip.poster}
            controls
            playsInline
            preload="metadata"
            aria-label={`${clip.label}的短片`}
          />
          <figcaption>{clip.label} · 短片预览</figcaption>
        </figure>
      ))}
    </div>
  );
}
