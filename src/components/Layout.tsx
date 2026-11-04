import { NavLink, Outlet } from 'react-router-dom';
import {
  Home,
  Palette,
  ScanFace,
  Sparkles,
  WandSparkles,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';

type NavItem = {
  to: string;
  end?: boolean;
  label: string;
  desktopLabel: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { to: '/', end: true, label: '首页', desktopLabel: '首页', icon: Home },
  { to: '/artist', label: '工作台', desktopLabel: '化妆师工作台', icon: Palette },
  {
    to: '/client',
    label: '新客户',
    desktopLabel: '新客户',
    icon: ScanFace,
  },
  {
    to: '/try-on',
    label: '试妆',
    desktopLabel: '试妆搭配',
    icon: WandSparkles,
  },
  {
    to: '/sessions',
    label: '还原台',
    desktopLabel: '还原台',
    icon: ClipboardCheck,
  },
];

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" end>
            <span className="brand-mark" aria-hidden />
            <span className="brand-text">妆造预选 · Studio</span>
          </NavLink>
          <nav className="nav-links nav-links-desktop" aria-label="主导航">
            {navItems.map(({ to, end, desktopLabel }) => (
              <NavLink key={to} to={to} end={end}>
                {desktopLabel}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="手机导航">
        {navItems.map(({ to, end, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} className="bottom-nav-item">
            <Icon size={22} strokeWidth={2.1} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <footer className="footer">
        <Sparkles size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        妆前确认成套 · 还原台施工 · 可安装到手机主屏幕（PWA）
      </footer>
    </div>
  );
}
