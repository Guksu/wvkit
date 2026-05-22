import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ScrollContainerDemo } from './ScrollContainerDemo';
import { PullToRefreshDemo } from './PullToRefreshDemo';
import { StableInputDemo } from './StableInputDemo';
import { VirtualKeyboardDemo } from './VirtualKeyboardDemo';
import { SafeAreaDemo } from './SafeAreaDemo';
import { ScrollLockDemo } from './ScrollLockDemo';

const TABS = [
  { id: 'scroll-container', label: 'ScrollContainer' },
  { id: 'pull-to-refresh', label: 'PullToRefresh' },
  { id: 'stable-input', label: 'StableInput' },
  { id: 'virtual-keyboard', label: 'VirtualKeyboard' },
  { id: 'safe-area', label: 'SafeArea' },
  { id: 'scroll-lock', label: 'ScrollLock' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('scroll-container');

  return (
    <div style={appStyle}>
      <header style={headerStyle}>
        <div style={headerInner}>
          <div style={logoArea}>
            <span style={logoBadge}>wvkit</span>
            <span style={logoSub}>WebView UI Primitives</span>
          </div>
          <a
            href="https://github.com/Guksu/wvkit"
            target="_blank"
            rel="noreferrer"
            style={githubLink}
          >
            GitHub
          </a>
        </div>

        <div style={tabBarWrapper}>
          <div style={tabBar}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...tabBtn,
                  ...(activeTab === tab.id ? tabBtnActive : {}),
                }}
              >
                {tab.label}
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
        <span>MIT License · </span>
        <a href="https://www.npmjs.com/package/@guksu/wvkit-core" target="_blank" rel="noreferrer" style={footerLink}>
          npm
        </a>
        <span> · </span>
        <a href="https://github.com/Guksu/wvkit" target="_blank" rel="noreferrer" style={footerLink}>
          GitHub
        </a>
      </footer>
    </div>
  );
}

const appStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f3f4f6',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  color: '#111827',
};

const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  background: '#fff',
  borderBottom: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const headerInner: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px 10px',
  maxWidth: 600,
  margin: '0 auto',
};

const logoArea: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const logoBadge: React.CSSProperties = {
  background: '#4f46e5',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  padding: '3px 10px',
  borderRadius: 6,
  letterSpacing: '-0.02em',
};

const logoSub: React.CSSProperties = {
  fontSize: 12,
  color: '#9ca3af',
  fontWeight: 500,
};

const githubLink: React.CSSProperties = {
  fontSize: 13,
  color: '#4f46e5',
  textDecoration: 'none',
  fontWeight: 600,
  padding: '6px 12px',
  background: '#eef2ff',
  borderRadius: 8,
};

const tabBarWrapper: React.CSSProperties = {
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
};

const tabBar: React.CSSProperties = {
  display: 'flex',
  padding: '0 16px',
  maxWidth: 600,
  margin: '0 auto',
  gap: 2,
};

const tabBtn: React.CSSProperties = {
  flexShrink: 0,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 500,
  border: 'none',
  borderBottom: '2px solid transparent',
  background: 'transparent',
  color: '#6b7280',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  transition: 'color 0.15s, border-color 0.15s',
};

const tabBtnActive: React.CSSProperties = {
  color: '#4f46e5',
  borderBottomColor: '#4f46e5',
  fontWeight: 600,
};

const mainStyle: React.CSSProperties = {
  maxWidth: 600,
  margin: '0 auto',
  padding: '20px 16px 40px',
};

const footerStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '24px 16px',
  fontSize: 12,
  color: '#9ca3af',
  borderTop: '1px solid #e5e7eb',
  background: '#fff',
};

const footerLink: React.CSSProperties = {
  color: '#4f46e5',
  textDecoration: 'none',
};

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
