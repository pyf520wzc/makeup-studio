import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Lock, Sparkles } from 'lucide-react';
import type { ClientSession, Occasion } from '../types';
import { analyzeFaceImage } from '../lib/faceAnalysis';
import { compressImage, readFileAsDataUrl } from '../lib/file';
import { recommendInventory, recommendWorks } from '../lib/recommend';
import { loadData, seedDemoIfEmpty, uid, upsertSession } from '../lib/storage';
import { trackEvent } from '../lib/analytics';
import {
  acceptPrivacy,
  hasPrivacyConsent,
} from '../lib/privacy';
import { FeatureNotes } from '../components/FeatureNotes';
import { ReasonBlock } from '../components/ReasonBlock';
import { Toast } from '../components/Toast';

const OCCASIONS: Array<Occasion | ''> = [
  '',
  '日常',
  '约会',
  '婚礼',
  '派对',
  '职场',
  '写真',
  '舞台',
];

export function Client() {
  const navigate = useNavigate();
  const data = useMemo(() => seedDemoIfEmpty(), []);
  const saved = data.sessions[0] ?? null;
  const [name, setName] = useState(saved?.name ?? '新客户');
  const [occasion, setOccasion] = useState<Occasion | ''>(saved?.occasion ?? '约会');
  const [avatar, setAvatar] = useState(saved?.avatarDataUrl ?? '');
  const [analyzing, setAnalyzing] = useState(false);
  const [session, setSession] = useState<ClientSession | null>(saved);
  const [toast, setToast] = useState('');
  const [privacyOk, setPrivacyOk] = useState(hasPrivacyConsent());
  const [privacyChecked, setPrivacyChecked] = useState(hasPrivacyConsent());
  const [showPrivacyGate, setShowPrivacyGate] = useState(!hasPrivacyConsent());

  const libraryEmpty = data.works.length === 0;

  const scoredWorks = useMemo(() => {
    if (!session) return [];
    return recommendWorks(session.analysis, data.works, occasion);
  }, [session, data.works, occasion]);

  const scoredInv = useMemo(() => {
    if (!session) return [];
    const top = scoredWorks.slice(0, 3).map((s) => s.work);
    return recommendInventory(session.analysis, data.inventory, top, occasion);
  }, [session, data.inventory, scoredWorks, occasion]);

  const recommendedWorks = useMemo(() => {
    const ids = new Set(session?.recommendedWorkIds ?? []);
    const picked = scoredWorks.filter((item) => ids.has(item.work.id));
    return picked.length ? picked : scoredWorks.slice(0, 4);
  }, [scoredWorks, session]);

  const recommendedInv = useMemo(() => {
    const ids = new Set(session?.recommendedInventoryIds ?? []);
    const picked = scoredInv.filter((item) => ids.has(item.item.id));
    return picked.length ? picked : scoredInv.slice(0, 4);
  }, [scoredInv, session]);

  const acceptAndContinue = () => {
    if (!privacyChecked) {
      setToast('请先勾选同意后再上传头像');
      return;
    }
    acceptPrivacy();
    trackEvent('privacy_accepted');
    setPrivacyOk(true);
    setShowPrivacyGate(false);
    setToast('已记录同意，可以上传头像');
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    if (!privacyOk && !hasPrivacyConsent()) {
      setShowPrivacyGate(true);
      setToast('上传前请先同意隐私说明');
      return;
    }
    const raw = await readFileAsDataUrl(file);
    setAvatar(await compressImage(raw, 800));
    setSession(null);
  };

  const goTryOn = (s: ClientSession) => {
    navigate(`/try-on?session=${s.id}`);
  };

  const runAnalyze = async () => {
    if (!privacyOk && !hasPrivacyConsent()) {
      setShowPrivacyGate(true);
      setToast('请先同意隐私说明');
      return;
    }
    if (!avatar) {
      setToast('请先上传客户头像');
      return;
    }
    const latest = loadData();
    if (latest.works.length === 0) {
      trackEvent('client_blocked_empty_library');
      setToast('作品库为空，请先录入作品');
      navigate('/artist?need=works');
      return;
    }
    setAnalyzing(true);
    trackEvent('analysis_started', { meta: { occasion: occasion || 'any' } });
    try {
      const analysis = await analyzeFaceImage(avatar);
      const scored = recommendWorks(analysis, latest.works, occasion);
      const topIds = scored.slice(0, 6).map((s) => s.work.id);
      const inv = recommendInventory(
        analysis,
        latest.inventory,
        scored.slice(0, 3).map((s) => s.work),
        occasion,
      );
      const invIds = inv.slice(0, 6).map((s) => s.item.id);
      const clothingId =
        inv.find((s) => s.item.category === '服装')?.item.id ?? null;
      const accessoryIds = inv
        .filter((s) => s.item.category !== '服装')
        .slice(0, 2)
        .map((s) => s.item.id);
      const next: ClientSession = {
        id: uid('session'),
        name: name.trim() || '未命名客户',
        avatarDataUrl: avatar,
        analysis,
        recommendedWorkIds: topIds,
        recommendedInventoryIds: invIds,
        selectedWorkIds: topIds.slice(0, 2),
        selectedInventoryIds: [
          ...(clothingId ? [clothingId] : []),
          ...accessoryIds,
        ],
        outfit: {
          workId: topIds[0] ?? null,
          clothingId,
          accessoryIds,
        },
        status: 'draft',
        notes: '',
        occasion: occasion || undefined,
        createdAt: new Date().toISOString(),
      };
      upsertSession(next);
      trackEvent('session_created', { sessionId: next.id });
      setSession(next);
      setToast('分析完成（参考），正在进入试妆…');
      // 直达试妆：写入 Top1 草稿成套后跳转
      window.setTimeout(() => goTryOn(next), 450);
    } catch (e) {
      console.error(e);
      setToast('分析失败，请换一张更清晰的正脸照片试试');
    } finally {
      setAnalyzing(false);
    }
  };

  if (libraryEmpty) {
    return (
      <>
        <div className="section-head">
          <div>
            <h2>新客户 · 试妆分析</h2>
            <p className="muted" style={{ margin: 0 }}>
              需先有作品库才能推荐与试妆
            </p>
          </div>
        </div>
        <div className="empty empty-block">
          <p>
            作品库为空。请先让化妆师录入造型作品（建议同时录入服装/饰品），再回来分析。
          </p>
          <div className="cta-row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <Link className="btn btn-primary" to="/artist?need=works">
              去录入作品
            </Link>
            <Link className="btn btn-ghost" to="/">
              返回首页
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h2>新客户 · 试妆分析</h2>
          <p className="muted" style={{ margin: 0 }}>
            上传头像 → 五官/肤色倾向（参考）→ 自动进入试妆搭配
          </p>
        </div>
      </div>

      {showPrivacyGate && (
        <div className="privacy-banner panel">
          <h3 style={{ marginTop: 0 }}>
            <Lock size={16} style={{ verticalAlign: '-2px' }} /> 人脸隐私说明
          </h3>
          <p className="muted">
            头像仅用于本机妆造推荐、试妆合成与还原对照，保存在当前浏览器本地，不会默认上传云端或用于营销。
            你可以随时在首页「设置与隐私」清除全部本地数据。分析结论为辅助建议，非医学/审美判决。
          </p>
          <label className="privacy-check">
            <input
              type="checkbox"
              checked={privacyChecked}
              onChange={(e) => setPrivacyChecked(e.target.checked)}
            />
            <span>我已阅读并同意上述用途与本地存储说明</span>
          </label>
          <div className="cta-row">
            <button type="button" className="btn btn-primary" onClick={acceptAndContinue}>
              同意并继续
            </button>
            <Link className="btn btn-ghost" to="/">
              返回
            </Link>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <section className="panel form-grid">
          <label className="field">
            <span>客户称呼</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>目标场合（优先筛选）</span>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value as Occasion | '')}
            >
              {OCCASIONS.map((o) => (
                <option key={o || 'any'} value={o}>
                  {o || '不限场合'}
                </option>
              ))}
            </select>
          </label>

          <label
            className={`upload-box${!privacyOk ? ' is-disabled' : ''}`}
            onClick={(e) => {
              if (!privacyOk) {
                e.preventDefault();
                setShowPrivacyGate(true);
                setToast('上传前请先同意隐私说明');
              }
            }}
          >
            <input
              type="file"
              accept="image/*"
              disabled={!privacyOk}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {avatar ? (
              <div className="preview">
                <img src={avatar} alt="客户头像" />
              </div>
            ) : (
              <>
                <strong>
                  {privacyOk ? '上传客户正面头像' : '请先同意隐私说明后再上传'}
                </strong>
                <p className="muted">光线均匀、素颜或淡妆均可，正脸效果更好</p>
              </>
            )}
          </label>

          <button
            className="btn btn-primary"
            onClick={runAnalyze}
            disabled={analyzing || !avatar || !privacyOk}
          >
            {analyzing ? (
              <>
                <Loader2 size={18} className="spin" /> 正在分析…
              </>
            ) : (
              <>
                <Sparkles size={18} /> 开始分析并去试妆
              </>
            )}
          </button>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            分析会读取这张照片的眼、眉、鼻、唇、轮廓和肤色分区，并写出具体特点和推荐理由。结果是浏览器端估算，只作沟通参考。
          </p>
        </section>

        <section className="panel">
          {!session ? (
            <div className="empty">
              上传头像并分析后，会自动跳转试妆；也可在此查看倾向摘要
            </div>
          ) : (
            <div className="analysis-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div>
                <div className="tag-row" style={{ marginBottom: 10 }}>
                  <span className="pill">{session.analysis.faceShape}（倾向）</span>
                  <span className="pill">{session.analysis.skinTone}（参考）</span>
                  <span className="tag">
                    置信度约 {Math.round(session.analysis.confidence * 100)}%
                  </span>
                </div>
                <FeatureNotes analysis={session.analysis} />
                <div className="cta-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => goTryOn(session)}
                  >
                    去试妆搭配
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {session && (
        <>
          <div className="section-head">
            <div>
              <h2>推荐造型（参考匹配度）</h2>
              <p className="muted" style={{ margin: 0 }}>
                Top1 已写入试妆草稿；可在试妆页随时切换
              </p>
            </div>
          </div>
          <div className="card-grid" style={{ marginBottom: 28 }}>
            {recommendedWorks.map(({ work, score, reasons }) => (
              <article key={work.id} className="panel work-card" style={{ padding: 0 }}>
                <div className="thumb">
                  <img src={work.imageDataUrl} alt={work.title} />
                </div>
                <div className="body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{work.title}</strong>
                    <span className="tag score">{score}%</span>
                  </div>
                  <ReasonBlock reasons={reasons} />
                </div>
              </article>
            ))}
          </div>
          {recommendedInv.length > 0 && (
            <>
              <div className="section-head">
                <div>
                  <h2>推荐服装 / 饰品</h2>
                  <p className="muted" style={{ margin: 0 }}>
                    每件都附推荐理由，试妆页可以改
                  </p>
                </div>
              </div>
              <div className="card-grid" style={{ marginBottom: 28 }}>
                {recommendedInv.map(({ item, score, reasons }) => (
                  <article key={item.id} className="panel work-card" style={{ padding: 0 }}>
                    <div className="thumb">
                      <img src={item.imageDataUrl} alt={item.name} />
                    </div>
                    <div className="body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{item.name}</strong>
                        <span className="tag score">{score}%</span>
                      </div>
                      <div className="tag-row">
                        <span className="tag gold">{item.category}</span>
                      </div>
                      <ReasonBlock reasons={reasons} />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Toast message={toast} onClose={() => setToast('')} />

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .upload-box.is-disabled { opacity: 0.72; cursor: not-allowed; }
      `}</style>
    </>
  );
}
