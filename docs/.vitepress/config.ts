import { defineConfig } from 'vitepress';

const components = [
  { text: 'ScrollContainer', slug: 'scroll-container' },
  { text: 'StableInput', slug: 'stable-input' },
  { text: 'PullToRefresh', slug: 'pull-to-refresh' },
  { text: 'useVirtualKeyboard', slug: 'virtual-keyboard' },
  { text: 'useSafeArea', slug: 'safe-area' },
  { text: 'useScrollLock', slug: 'scroll-lock' },
];

export default defineConfig({
  title: 'wvkit',
  description: 'Headless UI components optimized for WebView environments',
  base: '/wvkit/docs/',
  srcExclude: [
    'campaign/**',
    'worklog/**',
    'templates/**',
    'qa/**',
    'loops/**',
    'reports/**',
    'digests/**',
  ],
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [{ text: 'Demo', link: 'https://guksu.github.io/wvkit/' }],
        sidebar: [
          {
            text: 'Components',
            items: components.map((c) => ({
              text: c.text,
              link: `/components/${c.slug}/`,
            })),
          },
        ],
      },
    },
    ko: {
      label: '한국어',
      lang: 'ko',
      link: '/ko/',
      themeConfig: {
        nav: [{ text: '데모', link: 'https://guksu.github.io/wvkit/' }],
        sidebar: [
          {
            text: '컴포넌트',
            items: components.map((c) => ({
              text: c.text,
              link: `/ko/components/${c.slug}/`,
            })),
          },
        ],
      },
    },
  },
  themeConfig: {
    socialLinks: [{ icon: 'github', link: 'https://github.com/Guksu/wvkit' }],
  },
});
