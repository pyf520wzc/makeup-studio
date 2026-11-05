import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Camera, ClipboardList, Loader2, Trash2 } from 'lucide-react';
import {
  deleteSession,
  loadData,
  seedDemoIfEmpty,
  upsertSession,
} from '../lib/storage';
import { compressImage, readFileAsDataUrl } from '../lib/file';
import { compareRestoration } from '../lib/restorationScore';
import { trackEvent } from '../lib/analytics';
import { FeatureNotes } from '../components/FeatureNotes';
import { Toast } from '../components/Toast';
import type { ClientSession, RestorationRecord } from '../types';

function resolveReference(session: ClientSession, data: ReturnType<typeof loadData>) {
  const workMap = Object.fromEntries(data.works.map((w) => [w.id, w]));
  const outfitWorkId = session.outfit?.workId;
  if (outfitWorkId && workMap[outfitWorkId]) {
    const w = workMap[outfitWorkId];
    return {
      dataUrl: w.imageDataUrl,
      label: `成套造型「${w.title}」`,
    };
  }
  const selectedId = session.selectedWorkIds[0];
  if (selectedId && workMap[selectedId]) {
    const w = workMap[selectedId];
    return {
      dataUrl: w.imageDataUrl,
      label: `已选造型「${w.title}」`,
    };
  }
  const recId = session.recommendedWorkIds[0];
  if (recId && workMap[recId]) {
    const w = workMap[recId];
    return {
      dataUrl: w.imageDataUrl,
      label: `推荐造型「${w.title}」`,
    };
  }
  return {
    dataUrl: session.avatarDataUrl,
    label: '客户原图（无造型参考时回退）',
  };
}

export function Sessions() {
  const [params] = useSearchParams();
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const data = useMemo(() => {
    void tick;
    seedDemoIfEmpty();
    return loadData();
  }, [tick]);

  useEffect(() => {
    const fromQuery = params.get('id');
    if (fromQuery && data.sessions.some((s) => s.id === fromQuery)) {
      setActiveId(fromQuery);
    }
  }, [params, data.sessions]);

  const sortedSessions = useMemo(() => {
    return [...data.sessions].sort((a, b) => {
      const ac = a.status === 'confirmed' ? 1 : 0;
      const bc = b.status === 'confirmed' ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return (b.confirmedAt || b.createdAt).localeCompare(
        a.confirmedAt || a.createdAt,
      );
    });
  }, [data.sessions]);

  const active =
    sortedSessions.find((s) => s.id === activeId) ?? sortedSessions[0];

  const workMap = useMemo(
    () => Object.fromEntries(data.works.map((w) => [w.id, w])),
    [data.works],
  );
  const invMap = useMemo(
    () => Object.fromEntries(data.inventory.map((i) => [i.id, i])),
    [data.inventory],
  );

  const refresh = () => setTick((t) => t + 1);

  const updateNotes = (session: ClientSession, notes: string) => {
    upsertSession({ ...session, notes });
    refresh();
  };

  const onRestorationUpload = async (
    session: ClientSession,
    file: File | null,
  ) => {
    if (!file) return;
    setAnalyzing(true);
    try {
      const raw = await readFileAsDataUrl(file);
      const photoDataUrl = await compressImage(raw, 1000, 0.84);
      const ref = resolveReference(session, data);
      const result = await compareRestoration(photoDataUrl, ref.dataUrl);
      const restoration: RestorationRecord = {
        photoDataUrl,
        referenceDataUrl: ref.dataUrl,
        referenceLabel: ref.label,
        score: result.score,
        summary: result.summary,
        details: result.details,
        colorScore: result.colorScore,
        brightnessScore: result.brightnessScore,
        structureScore: result.structureScore,
        analyzedAt: new Date().toISOString(),
      };
      upsertSession({ ...session, restoration });
      trackEvent('restoration_scored', {
        sessionId: session.id,
        meta: { score: result.score },
      });
      refresh();
      setToast(`还原度参考分：${result.score}`);
    } catch (err) {
      console.error(err);
      setToast('实拍分析失败，请换一张清晰正面照再试');
    } finally {
      setAnalyzing(false);
    }
  };

  const clearRestoration = (session: ClientSession) => {
    if (!confirm('清除该会话的还原实拍与评分？')) return;
    const next = { ...session };
    delete next.restoration;
    upsertSession(next);
    refresh();
    setToast('已清除还原记录');
  };

  const confirmedOutfit = active?.status === 'confirmed' && active.outfit;
  const hasOutfit = Boolean(active?.outfit?.workId);

  return (
    <>
      <div className="section-head">
        <div>
          <h2>还原台</h2>
          <p className="muted" style={{ margin: 0 }}>
            优先展示已确认成套清单；按图施工，完成后可上传实拍看还原度参考
          </p>
        </div>
        <div className="cta-row">
          <Link className="btn btn-secondary" to="/client">
            新客户
          </Link>
          <Link
            className="btn btn-primary"
            to={active ? `/try-on?session=${active.id}` : '/try-on'}
          >
            打开试妆
          </Link>
        </div>
      </div>

      {sortedSessions.length === 0 ? (
        <div className="empty empty-block">
          还没有客户会话。请先到「新客户」上传头像并完成分析。
          <div style={{ marginTop: 14 }}>
            <Link className="btn btn-primary" to="/client">
              去分析
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          <section className="panel" style={{ display: 'grid', gap: 10 }}>
            <h3>
              <ClipboardList size={16} style={{ verticalAlign: '-2px' }} />{' '}
              今日会话
            </h3>
            {sortedSessions.map((s) => {
              const muted = !s.outfit?.workId;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`session-row${muted ? ' is-muted' : ''}`}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    outline:
                      active?.id === s.id ? '2px solid #c45c7a' : undefined,
                  }}
                  onClick={() => setActiveId(s.id)}
                >
                  <img src={s.avatarDataUrl} alt={s.name} />
                  <div className="grow">
                    <strong>
                      {s.name}{' '}
                      {s.status === 'confirmed' ? (
                        <span className="tag score">已确认</span>
                      ) : (
                        <span className="tag">草稿</span>
                      )}
                    </strong>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {s.analysis.faceShape} · {s.analysis.skinTone}
                      {typeof s.restoration?.score === 'number' && (
                        <> · 还原度参考 {s.restoration.score}</>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {new Date(s.createdAt).toLocaleString('zh-CN', {
                        timeZone: 'Asia/Hong_Kong',
                      })}{' '}
                      (香港时区)
                    </div>
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '8px 10px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`删除客户会话「${s.name}」？`)) {
                        deleteSession(s.id);
                        if (activeId === s.id) setActiveId(null);
                        refresh();
                        setToast('已删除会话');
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              );
            })}
          </section>

          {active && (
            <section className="panel">
              <div className="analysis-grid">
                <div className="avatar-panel" style={{ padding: 0 }}>
                  <img src={active.avatarDataUrl} alt={active.name} />
                  <strong>{active.name}</strong>
                  <div>
                    <span className="pill">{active.analysis.faceShape}（参考）</span>
                    <span className="pill">{active.analysis.skinTone}（参考）</span>
                  </div>
                </div>
                <div>
                  <h3>五官结论速览（参考）</h3>
                  <FeatureNotes analysis={active.analysis} works={data.works} />
                </div>
              </div>

              {!hasOutfit ? (
                <div className="empty empty-block" style={{ marginTop: 18 }}>
                  该会话尚未完成试妆成套。
                  <div style={{ marginTop: 12 }}>
                    <Link
                      className="btn btn-primary"
                      to={`/try-on?session=${active.id}`}
                    >
                      去完成试妆
                    </Link>
                  </div>
                </div>
              ) : (
                <div
                  className={`confirmed-outfit-panel${confirmedOutfit ? ' is-confirmed' : ''}`}
                >
                  <div className="confirmed-outfit-head">
                    <h3 style={{ margin: 0 }}>
                      {confirmedOutfit ? '已确认成套（施工清单）' : '试妆草稿成套'}
                    </h3>
                    {!confirmedOutfit && (
                      <Link
                        className="btn btn-secondary"
                        to={`/try-on?session=${active.id}`}
                      >
                        去确认成套
                      </Link>
                    )}
                  </div>

                  {active.outfit?.workId && workMap[active.outfit.workId] && (
                    <div className="confirmed-hero">
                      <img
                        src={workMap[active.outfit.workId].imageDataUrl}
                        alt={workMap[active.outfit.workId].title}
                      />
                      <div>
                        <strong>{workMap[active.outfit.workId].title}</strong>
                        <p className="muted" style={{ margin: '6px 0 0' }}>
                          {workMap[active.outfit.workId].notes ||
                            '按作品图还原即可'}
                        </p>
                        <div className="tag-row" style={{ marginTop: 8 }}>
                          <span className="tag gold">
                            {workMap[active.outfit.workId].makeupType}
                          </span>
                          {workMap[active.outfit.workId].styles.map((s) => (
                            <span className="tag" key={s}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <ul className="outfit-checklist">
                    <li>
                      <input type="checkbox" id="chk-work" />
                      <label htmlFor="chk-work">
                        造型：
                        {active.outfit?.workId
                          ? (workMap[active.outfit.workId]?.title ?? '（已删除）')
                          : '未选'}
                      </label>
                    </li>
                    <li>
                      <input type="checkbox" id="chk-cloth" />
                      <label htmlFor="chk-cloth">
                        服装：
                        {active.outfit?.clothingId
                          ? (invMap[active.outfit.clothingId]?.name ??
                            '（已删除）')
                          : '未选'}
                      </label>
                    </li>
                    <li>
                      <input type="checkbox" id="chk-acc" />
                      <label htmlFor="chk-acc">
                        饰品：
                        {active.outfit?.accessoryIds?.length
                          ? active.outfit.accessoryIds
                              .map((id) => invMap[id]?.name)
                              .filter(Boolean)
                              .join('、') || '未选'
                          : '未选'}
                      </label>
                    </li>
                  </ul>

                  {active.outfit?.clothingId &&
                    invMap[active.outfit.clothingId] && (
                      <div className="mini-inv-row">
                        <img
                          src={invMap[active.outfit.clothingId].imageDataUrl}
                          alt=""
                        />
                        <span>{invMap[active.outfit.clothingId].name}</span>
                      </div>
                    )}
                  <div className="mini-inv-row wrap">
                    {active.outfit?.accessoryIds?.map((id) => {
                      const item = invMap[id];
                      if (!item) return null;
                      return (
                        <span key={id} className="mini-inv-chip">
                          <img src={item.imageDataUrl} alt="" />
                          {item.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <label className="field" style={{ marginTop: 18 }}>
                <span>化妆师还原备注</span>
                <textarea
                  value={active.notes}
                  onChange={(e) => updateNotes(active, e.target.value)}
                  placeholder="例如：客户最终选清透约会妆 + 珍珠耳钉；眉形略挑…"
                />
              </label>

              <div className="restoration-panel">
                <div className="restoration-head">
                  <h3 style={{ margin: 0 }}>
                    <Camera size={16} style={{ verticalAlign: '-2px' }} />{' '}
                    还原实拍 · 还原度参考
                  </h3>
                  <p className="muted" style={{ margin: '6px 0 0' }}>
                    与已确认成套/造型参考图做色调·明度·结构启发式对比，分数仅作沟通参考，不作考核
                  </p>
                </div>

                <label
                  className={`upload-box restoration-upload${analyzing ? ' is-busy' : ''}`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    disabled={analyzing}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = '';
                      void onRestorationUpload(active, f);
                    }}
                  />
                  {analyzing ? (
                    <span className="cta-row" style={{ justifyContent: 'center' }}>
                      <Loader2 size={18} className="spin" />
                      正在分析还原度参考…
                    </span>
                  ) : (
                    <span>
                      {active.restoration
                        ? '重新上传还原实拍并分析'
                        : '上传还原完成后的实拍照'}
                    </span>
                  )}
                </label>

                {active.restoration && (
                  <div className="restoration-result">
                    <div className="restoration-compare">
                      <figure>
                        <img
                          src={active.restoration.referenceDataUrl}
                          alt="参考造型"
                        />
                        <figcaption>
                          参考：{active.restoration.referenceLabel}
                        </figcaption>
                      </figure>
                      <figure>
                        <img
                          src={active.restoration.photoDataUrl}
                          alt="还原实拍"
                        />
                        <figcaption>还原实拍</figcaption>
                      </figure>
                    </div>

                    <div className="restoration-score-card">
                      <div className="restoration-score-num">
                        <strong>{active.restoration.score}</strong>
                        <span>还原度参考</span>
                      </div>
                      <p className="restoration-summary">
                        {active.restoration.summary}
                      </p>
                      <div className="restoration-meters">
                        <div>
                          <div className="meter-label">
                            <span>色调接近度（参考）</span>
                            <span>{active.restoration.colorScore}</span>
                          </div>
                          <div className="score-bar">
                            <i
                              style={{
                                width: `${active.restoration.colorScore}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="meter-label">
                            <span>明度 / 冷暖（参考）</span>
                            <span>{active.restoration.brightnessScore}</span>
                          </div>
                          <div className="score-bar">
                            <i
                              style={{
                                width: `${active.restoration.brightnessScore}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="meter-label">
                            <span>结构相似度（参考）</span>
                            <span>{active.restoration.structureScore}</span>
                          </div>
                          <div className="score-bar">
                            <i
                              style={{
                                width: `${active.restoration.structureScore}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <ul className="restoration-details">
                        {active.restoration.details.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                      <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
                        分析于{' '}
                        {new Date(active.restoration.analyzedAt).toLocaleString(
                          'zh-CN',
                          { timeZone: 'Asia/Hong_Kong' },
                        )}{' '}
                        (香港时区)
                      </p>
                      <div className="cta-row" style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => clearRestoration(active)}
                        >
                          清除还原记录
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
