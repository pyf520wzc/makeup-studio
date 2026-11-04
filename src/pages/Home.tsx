import { Link, useNavigate } from 'react-router-dom';
import {
  Camera,
  Eraser,
  Palette,
  Settings2,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  clearAllLocalData,
  loadData,
  loadDemoData,
  seedDemoIfEmpty,
} from '../lib/storage';
import { trackEvent, exportEventsJson, loadEvents } from '../lib/analytics';
import { Toast } from '../components/Toast';

export function Home() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const stats = useMemo(() => {
    void tick;
    const data = seedDemoIfEmpty();
    return {
      works: data.works.length,
      inventory: data.inventory.length,
      sessions: data.sessions.length,
      events: loadEvents().length,
    };
  }, [tick]);

  const startClient = () => {
    const data = loadData();
    if (data.works.length === 0) {
      trackEvent('client_blocked_empty_library');
      setToast('作品库为空，请先让化妆师录入作品');
      navigate('/artist?need=works');
      return;
    }
    navigate('/client');
  };

  const clearAll = () => {
    if (
      !confirm(
        '清除本机全部作品、库存、客户会话与头像？此操作不可恢复。清除后不会自动灌演示数据。',
      )
    ) {
      return;
    }
    clearAllLocalData();
    trackEvent('data_cleared', { meta: { scope: 'all' } });
    setTick((t) => t + 1);
    setToast('已清除本地数据');
  };

  const restoreDemo = () => {
    loadDemoData();
    setTick((t) => t + 1);
    setToast('已载入演示作品与库存');
  };

  const downloadEvents = () => {
    const blob = new Blob([exportEventsJson()], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `makeup-studio-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('已导出埋点事件 JSON');
  };

  return (
    <>
      <section className="hero">
        <div className="hero-card">
          <div className="eyebrow">
            <Sparkles size={14} /> 上妆前的共识工具
          </div>
          <h1>先看见成套妆造，再让化妆师按清单还原</h1>
          <p className="lead">
            大改发生在图层上，不是脸上。客户选好造型与服装饰品，化妆师照清单施工，做完还能对照还原度参考。
          </p>

          <div className="role-entry-grid">
            <button type="button" className="role-card role-card-client" onClick={startClient}>
              <div className="role-icon">
                <UserRound size={28} />
              </div>
              <div>
                <strong>我是客户</strong>
                <p>上传头像 → 分析参考 → 试妆确认成套</p>
              </div>
              <span className="role-cta">
                <Camera size={16} /> 开始试妆
              </span>
            </button>
            <Link to="/artist" className="role-card role-card-artist">
              <div className="role-icon">
                <Palette size={28} />
              </div>
              <div>
                <strong>我是化妆师</strong>
                <p>录入作品库存 · 还原台 · 实拍还原度</p>
              </div>
              <span className="role-cta">进入工作台</span>
            </Link>
          </div>

          <div className="cta-row" style={{ marginTop: 16 }}>
            <Link className="btn btn-ghost" to="/sessions">
              还原台
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowSettings((v) => !v)}
            >
              <Settings2 size={16} /> 设置与隐私
            </button>
          </div>
        </div>
        <div className="hero-side">
          <div className="stat-card">
            <strong>{stats.works}</strong>
            <span>造型妆容作品</span>
          </div>
          <div className="stat-card">
            <strong>{stats.inventory}</strong>
            <span>服装 / 饰品库存</span>
          </div>
          <div className="stat-card">
            <strong>{stats.sessions}</strong>
            <span>客户分析会话</span>
          </div>
        </div>
      </section>

      {showSettings && (
        <section className="panel settings-panel">
          <h2 style={{ marginTop: 0 }}>设置 · 隐私与数据</h2>
          <p className="muted">
            头像与会话仅保存在本机浏览器（localStorage），用于妆造推荐与还原对照，不作营销。清除后不可恢复。
          </p>
          <div className="cta-row">
            <button type="button" className="btn btn-danger" onClick={clearAll}>
              <Eraser size={16} /> 清除全部本地数据
            </button>
            <button type="button" className="btn btn-secondary" onClick={restoreDemo}>
              载入演示数据
            </button>
            <button type="button" className="btn btn-ghost" onClick={downloadEvents}>
              导出埋点（{stats.events}）
            </button>
          </div>
        </section>
      )}

      <div className="section-head">
        <div>
          <h2>主路径（4 步）</h2>
          <p className="muted" style={{ margin: 0 }}>
            上传分析 → 试妆确认成套 → 还原台按清单施工 → 实拍还原度参考
          </p>
        </div>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <article className="panel feature-tile">
          <div className="icon">
            <Palette size={20} />
          </div>
          <h3>1. 化妆师先录入</h3>
          <p className="muted">作品库为空时，客户流程会被拦截并引导到录入页。</p>
        </article>
        <article className="panel feature-tile">
          <div className="icon">
            <Camera size={20} />
          </div>
          <h3>2. 分析（参考）</h3>
          <p className="muted">上传前需同意隐私说明；分析完成后直达试妆搭配。</p>
        </article>
        <article className="panel feature-tile">
          <div className="icon">
            <Sparkles size={20} />
          </div>
          <h3>3. 确认成套</h3>
          <p className="muted">试妆页「确认此成套」写入已确认状态，还原台优先展示。</p>
        </article>
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
