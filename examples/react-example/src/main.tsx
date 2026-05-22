import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LangProvider } from './LangContext';
import { t, type Lang } from './i18n';
import { ScrollContainerDemo } from './ScrollContainerDemo';
import { PullToRefreshDemo } from './PullToRefreshDemo';
import { StableInputDemo } from './StableInputDemo';
import { VirtualKeyboardDemo } from './VirtualKeyboardDemo';
import { SafeAreaDemo } from './SafeAreaDemo';
import { ScrollLockDemo } from './ScrollLockDemo';

const TAB_IDS = [
  'scroll-container',
  'pull-to-refresh',
  'stable-input',
  'virtual-keyboard',
  'safe-area',
  'scroll-lock',
] as const;

type TabId = (typeof TAB_IDS)[number];

function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [activeTab, setActiveTab] = useState<TabId>('scroll-container');
  const tr = t[lang];

  return (
    <LangProvider lang={lang}>
      <div style={appStyle}>
        <header style={headerStyle}>
          <div style={headerInner}>
            <div style={logoArea}>
              <span style={logoBadge}>wvkit</span>
              <span style={logoSub}>{tr.header.sub}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={langToggle}>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  style={{ ...langBtn, ...(lang === 'en' ? langBtnActive : {}) }}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang('ko')}
                  style={{ ...langBtn, ...(lang === 'ko' ? langBtnActive : {}) }}
                >
                  KO
                </button>
              </div>
              <a
                href="https://github.com/Guksu/wvkit"
                target="_blank"
                rel="noreferrer"
                style={githubLink}
              >
                {tr.header.github}
              </a>
            </div>
          </div>

          <div style={tabBarWrapper}>
            <div style={tabBar}>
              {TAB_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  style={{ ...tabBtn, ...(activeTab === id ? tabBtnActive : {}) }}
                >
                  {tr.tabs[id]}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main style={mainStyle}>
          {activeTab === 'scroll-container' && <ScrollContainerDemo />}
          {activeTab === 'pull-to-refresh' && <PullToRefreshDemo />}
          {activeTab === 'stable-input' && <StableInputDemo />}
          {activeTab === 'virtual-keyboard' && <VirtualKeyboardDemo />}
          {activeTab === 'safe-area' && <SafeAreaDemo />}
          {activeTab === 'scroll-lock' && <ScrollLockDemo />}
        </main>

        <footer style={footerStyle}>
          <span>{tr.footer.license} · </span>
          <a href="https://www.npmjs.com/package/@guksu/wvkit-core" target="_blank" rel="noreferrer" style={footerLink}>
            npm
          </a>
          <span> · </span>
          <a href="https://github.com/Guksu/wvkit" target="_blank" rel="noreferrer" style={footerLink}>
            GitHub
          </a>
        </footer>
      </div>
    </LangProvider>
  );
}

/* ─── styles ─── */

const appStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f3f4f6',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  color: '#111827',
};

const headerStyle: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 100,
  background: '#fff', borderBottom: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const headerInner: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px 10px', maxWidth: 600, margin: '0 auto',
};

const logoArea: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };

const logoBadge: React.CSSProperties = {
  background: '#4f46e5', color: '#fff', fontSize: 14, fontWeight: 700,
  padding: '3px 10px', borderRadius: 6, letterSpacing: '-0.02em',
};

const logoSub: React.CSSProperties = { fontSize: 12, color: '#9ca3af', fontWeight: 500 };

const langToggle: React.CSSProperties = {
  display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 2, gap: 2,
};

const langBtn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 12, fontWeight: 600,
  border: 'none', borderRadius: 6, background: 'transparent',
  color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit',
  transition: 'all 0.15s',
};

const langBtnActive: React.CSSProperties = {
  background: '#fff', color: '#4f46e5',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const githubLink: React.CSSProperties = {
  fontSize: 13, color: '#4f46e5', textDecoration: 'none',
  fontWeight: 600, padding: '6px 12px', background: '#eef2ff', borderRadius: 8,
};

const tabBarWrapper: React.CSSProperties = {
  overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
};

const tabBar: React.CSSProperties = {
  display: 'flex', padding: '0 16px', maxWidth: 600, margin: '0 auto', gap: 2,
};

const tabBtn: React.CSSProperties = {
  flexShrink: 0, padding: '8px 14px', fontSize: 13, fontWeight: 500,
  border: 'none', borderBottom: '2px solid transparent', background: 'transparent',
  color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap', transition: 'color 0.15s, border-color 0.15s',
};

const tabBtnActive: React.CSSProperties = {
  color: '#4f46e5', borderBottomColor: '#4f46e5', fontWeight: 600,
};

const mainStyle: React.CSSProperties = {
  maxWidth: 600, margin: '0 auto', padding: '20px 16px 40px',
};

const footerStyle: React.CSSProperties = {
  textAlign: 'center', padding: '24px 16px', fontSize: 12,
  color: '#9ca3af', borderTop: '1px solid #e5e7eb', background: '#fff',
};

const footerLink: React.CSSProperties = { color: '#4f46e5', textDecoration: 'none' };

/* ─── mount ─── */

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
