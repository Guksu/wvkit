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
              <span style={logoBadge}>wvkit<span style={logoAccent}>.</span></span>
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
                  data-testid={`tab-${id}`}
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
  background: '#f5f4f1',
  fontFamily: "'Space Grotesk', system-ui, sans-serif",
  color: '#111111',
};

const headerStyle: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 100,
  background: '#111111',
};

const headerInner: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 20px 12px', maxWidth: 640, margin: '0 auto',
};

const logoArea: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 10 };

const logoBadge: React.CSSProperties = {
  color: '#fff', fontSize: 18, fontWeight: 800,
  letterSpacing: '-0.04em', lineHeight: 1,
  fontFamily: "'Space Grotesk', system-ui, sans-serif",
};

const logoAccent: React.CSSProperties = { color: '#e86035' };

const logoSub: React.CSSProperties = {
  fontSize: 11, color: '#888', fontWeight: 500,
  letterSpacing: '0.02em',
};

const langToggle: React.CSSProperties = {
  display: 'flex', background: '#222', borderRadius: 6, padding: 2, gap: 2,
};

const langBtn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 11, fontWeight: 700,
  border: 'none', borderRadius: 4, background: 'transparent',
  color: '#666', cursor: 'pointer', fontFamily: 'inherit',
  letterSpacing: '0.04em', transition: 'all 0.12s',
};

const langBtnActive: React.CSSProperties = {
  background: '#e86035', color: '#fff',
};

const githubLink: React.CSSProperties = {
  fontSize: 12, color: '#ccc', textDecoration: 'none',
  fontWeight: 600, padding: '6px 12px',
  border: '1px solid #333', borderRadius: 6,
  letterSpacing: '0.02em', transition: 'border-color 0.12s',
};

const tabBarWrapper: React.CSSProperties = {
  overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
  background: '#1a1a1a', borderBottom: '1px solid #2a2a2a',
};

const tabBar: React.CSSProperties = {
  display: 'flex', padding: '8px 20px', maxWidth: 640, margin: '0 auto', gap: 4,
};

const tabBtn: React.CSSProperties = {
  flexShrink: 0, padding: '6px 14px', fontSize: 12, fontWeight: 600,
  border: 'none', borderRadius: 5, background: 'transparent',
  color: '#666', cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap', letterSpacing: '0.01em',
  transition: 'background 0.12s, color 0.12s',
};

const tabBtnActive: React.CSSProperties = {
  background: '#e86035', color: '#fff',
};

const mainStyle: React.CSSProperties = {
  maxWidth: 640, margin: '0 auto', padding: '24px 20px 48px',
  display: 'flex', flexDirection: 'column', gap: 16,
};

const footerStyle: React.CSSProperties = {
  textAlign: 'center', padding: '24px 16px', fontSize: 12,
  color: '#9c9890', borderTop: '1px solid #e8e5e0', background: '#f5f4f1',
};

const footerLink: React.CSSProperties = { color: '#e86035', textDecoration: 'none' };

/* ─── mount ─── */

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
