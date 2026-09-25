import { defineConfig } from 'vitepress';

// 제목 id(앵커) 규칙. VitePress 1.6 기본 slugify 와 같고, 마지막에 NFC 로 다시 합치는 것만 다르다.
// 기본 slugify 는 악센트를 떼려고 normalize('NFKD') 를 쓰는데, 이때 한글 음절도 자모로 쪼개진다.
// 그러면 제목 id 는 자모, 문서에 쓴 `#한글-링크` 는 완성형이라 서로 달라 페이지 안 링크가 이동하지 않는다.
// 영문 id 는 바뀌지 않는다 (NFKD 뒤 남은 글자는 NFC 로 합쳐도 같다).
// biome-ignore lint/suspicious/noControlCharactersInRegex: VitePress 기본 slugify 와 같은 제어 문자 제거
const rControl = /[\u0000-\u001f]/g;
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g;
// biome-ignore lint/suspicious/noMisleadingCharacterClass: 결합 문자(악센트)만 지우는 것이 목적 — VitePress 기본과 같다
const rCombining = /[\u0300-\u036F]/g;
function slugify(str: string): string {
  return str
    .normalize('NFKD')
    .replace(rCombining, '')
    .replace(rControl, '')
    .replace(rSpecial, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase()
    .normalize('NFC');
}

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
  markdown: {
    anchor: { slugify },
  },
  themeConfig: {
    socialLinks: [{ icon: 'github', link: 'https://github.com/Guksu/wvkit' }],
  },
});
