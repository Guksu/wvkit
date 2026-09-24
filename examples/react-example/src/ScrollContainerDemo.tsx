import { useEffect, useMemo, useState } from 'react';
import Swiper from 'swiper';
import 'swiper/css';
import { useScrollContainer } from '@guksu/wvkit-react/scroll-container';
import type { ScrollContainerDirection } from '@guksu/wvkit-react';
import {
  DemoCard,
  ControlGrid,
  ControlItem,
  DataRow,
  inputStyle,
  selectStyle,
  checkboxRowStyle,
} from './ui';
import { useLang } from './LangContext';
import { formatPrice, makeBannerImages, makeProductImages, makeProducts } from './demo-assets';

/**
 * ScrollContainer 데모 — 실제 이커머스 홈처럼 구성한 탭 피드.
 *
 * 패널(탭)마다: sticky 헤더 → 히어로 배너(Swiper 캐러셀) → 카테고리 칩(가로 네이티브 스크롤) → 상품 그리드(사진·가격·좋아요) → 끝.
 * 탭별 길이가 달라서 세로 스크롤이 없는 탭(짧음)과 긴 피드 탭이 섞여 있다.
 *
 * touch-action 규칙 (docs/components/scroll-container "Scrollable panels" 절):
 *  - 캔버스(root):            touch-action: none
 *  - 세로 스크롤 패널:         touch-action: pan-y      → 세로는 네이티브, 가로는 페이저
 *  - 패널 안 가로 스크롤(칩):  touch-action: pan-x pan-y → 칩 위에서는 가로·세로 모두 네이티브 (페이저 미개입)
 *  - 패널 안 JS 캐러셀(배너):  noDragSelector: '.swiper' → 배너에서 시작한 제스처는 Swiper 몫 (페이저 미개입)
 *  - direction=vertical:      스크롤되지 않는 카드 패널 (세로 페이저는 스크롤 패널과 공존 불가)
 */

const PANEL_COUNT = 6;
/** 탭마다 히어로 배너(Swiper) 슬라이드 수 */
const BANNER_SLIDES = 5;
/** 탭별 상품 수. 0이면 배너·그리드 없이 짧은 탭(세로 스크롤 없음). */
const PANEL_PRODUCTS = [12, 4, 24, 0, 48, 9];

type PanelKind = 'feed' | 'card';

interface PanelStrings {
  tabs: readonly string[];
  chips: readonly string[];
  sectionTitle: string;
  bannerTitle: string;
  bannerSub: string;
  shopNow: string;
  noScroll: string;
  verticalScroll: (n: number) => string;
  end: string;
}

interface Assets {
  products: string[];
  banners: string[];
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildFeedPanel(i: number, s: PanelStrings, assets: Assets): HTMLElement {
  const productCount = PANEL_PRODUCTS[i] ?? 0;
  const panel = el('div', {
    width: '100%',
    height: '100%',
    background: '#fff',
    color: '#111',
    fontFamily: 'system-ui, sans-serif',
    overflowY: 'auto',
    overflowX: 'hidden',
    touchAction: 'pan-y',
    overscrollBehaviorY: 'contain',
  });
  panel.dataset.panelIndex = String(i);

  // sticky 헤더: 인덱스 배지 + 탭 이름 + 힌트
  const header = el('div', {
    position: 'sticky',
    top: '0',
    zIndex: '2',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.94)',
    backdropFilter: 'blur(6px)',
    borderBottom: '1px solid #eee',
  });
  const badge = el(
    'span',
    {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '22px',
      height: '22px',
      borderRadius: '11px',
      background: '#111',
      color: '#fff',
      fontSize: '12px',
      fontWeight: '700',
    },
    String(i),
  );
  const title = el('span', { fontSize: '16px', fontWeight: '700' }, s.tabs[i] ?? `Tab ${i}`);
  const hint = el(
    'span',
    { marginLeft: 'auto', fontSize: '11px', color: '#888' },
    productCount === 0 ? s.noScroll : s.verticalScroll(Math.ceil(productCount / 6)),
  );
  header.append(badge, title, hint);
  panel.appendChild(header);

  if (productCount > 0) {
    // 히어로 배너 — Swiper 캐러셀 (전폭 16:9, 슬라이드 BANNER_SLIDES 장) + 캡션 + "n | N" 카운터.
    // Swiper 인스턴스는 페이저가 패널을 붙인 뒤 ScrollContainerInstance 의 effect 에서 만든다.
    const banner = el('div', {
      position: 'relative',
      margin: '12px 14px 0',
      borderRadius: '12px',
      overflow: 'hidden',
      background: '#eee',
    });
    banner.className = 'swiper';
    banner.dataset.banner = String(i);
    const wrapper = el('div', {});
    wrapper.className = 'swiper-wrapper';
    for (let k = 0; k < BANNER_SLIDES; k++) {
      const slide = el('div', { position: 'relative' });
      slide.className = 'swiper-slide';
      const img = el('img', { width: '100%', height: 'auto', display: 'block' });
      img.src = assets.banners[(i + k) % assets.banners.length] ?? '';
      img.width = 800;
      img.height = 450;
      img.alt = `${s.bannerTitle} ${k + 1}`;
      img.draggable = false;
      const caption = el('div', {
        position: 'absolute',
        left: '16px',
        bottom: '16px',
        color: '#fff',
        textShadow: '0 1px 8px rgba(0,0,0,0.45)',
      });
      caption.append(
        el('div', { fontSize: '22px', fontWeight: '800', lineHeight: '1.15' }, s.bannerTitle),
        el('div', { fontSize: '13px', opacity: '0.9', marginTop: '4px' }, s.bannerSub),
      );
      slide.append(img, caption);
      wrapper.appendChild(slide);
    }
    const counter = el(
      'div',
      {
        position: 'absolute',
        right: '12px',
        top: '12px',
        padding: '2px 8px',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.45)',
        color: '#fff',
        fontSize: '11px',
        zIndex: '2',
      },
      `1 | ${BANNER_SLIDES}`,
    );
    counter.dataset.bannerCounter = '';
    banner.append(wrapper, counter);
    panel.appendChild(banner);
  }

  // 카테고리 칩 — 패널 안 가로 네이티브 스크롤 (pan-x pan-y)
  const chips = el('div', {
    display: 'flex',
    gap: '8px',
    padding: '12px 14px',
    overflowX: 'auto',
    overflowY: 'hidden',
    touchAction: 'pan-x pan-y',
    overscrollBehaviorX: 'contain',
    scrollbarWidth: 'none',
  });
  chips.dataset.chips = String(i);
  s.chips.forEach((label, k) => {
    chips.appendChild(
      el(
        'span',
        {
          flex: '0 0 auto',
          padding: '6px 12px',
          borderRadius: '16px',
          border: '1px solid #ddd',
          background: k === i % s.chips.length ? '#111' : '#fff',
          color: k === i % s.chips.length ? '#fff' : '#333',
          fontSize: '13px',
          whiteSpace: 'nowrap',
        },
        label,
      ),
    );
  });
  panel.appendChild(chips);

  // 상품 그리드 (2열)
  const products = makeProducts(i, productCount > 0 ? productCount : 2, assets.products);
  panel.appendChild(
    el('h3', { margin: '6px 14px 8px', fontSize: '17px', fontWeight: '800' }, s.sectionTitle),
  );
  const grid = el('div', {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px 10px',
    padding: '0 14px 16px',
  });
  products.forEach((p, k) => {
    const card = el('div', { display: 'flex', flexDirection: 'column', gap: '6px' });
    const imgWrap = el('div', {
      position: 'relative',
      aspectRatio: '1 / 1',
      borderRadius: '10px',
      overflow: 'hidden',
      background: '#f1f1f1',
    });
    const img = el('img', { width: '100%', height: '100%', objectFit: 'cover', display: 'block' });
    img.src = p.image;
    img.width = 480;
    img.height = 480;
    img.loading = 'lazy';
    img.alt = p.name;
    img.draggable = false;
    imgWrap.appendChild(img);
    if (p.badge) {
      imgWrap.appendChild(
        el(
          'span',
          {
            position: 'absolute',
            top: '8px',
            left: '8px',
            padding: '2px 6px',
            borderRadius: '4px',
            background: p.badge === 'NEW' ? '#2563eb' : '#dc2626',
            color: '#fff',
            fontSize: '10px',
            fontWeight: '700',
          },
          p.badge,
        ),
      );
    }
    const like = el(
      'button',
      {
        position: 'absolute',
        right: '6px',
        bottom: '6px',
        width: '30px',
        height: '30px',
        borderRadius: '15px',
        border: 'none',
        background: 'rgba(255,255,255,0.9)',
        fontSize: '15px',
        cursor: 'pointer',
      },
      '♡',
    );
    like.type = 'button';
    like.dataset.like = `${i}-${k}`;
    like.setAttribute('aria-label', 'like');
    imgWrap.appendChild(like);
    const brand = el('div', { fontSize: '11px', color: '#888' }, p.brand);
    const name = el(
      'div',
      {
        fontSize: '13px',
        lineHeight: '1.3',
        color: '#222',
        display: '-webkit-box',
        webkitLineClamp: '2',
        webkitBoxOrient: 'vertical',
        overflow: 'hidden',
      } as Partial<CSSStyleDeclaration>,
      p.name,
    );
    const priceRow = el('div', { display: 'flex', alignItems: 'baseline', gap: '6px' });
    if (p.discount > 0)
      priceRow.appendChild(
        el('span', { color: '#e11d74', fontWeight: '800', fontSize: '14px' }, `${p.discount}%`),
      );
    priceRow.appendChild(
      el(
        'span',
        { fontWeight: '800', fontSize: '14px' },
        formatPrice(Math.round((p.price * (100 - p.discount)) / 100 / 100) * 100),
      ),
    );
    card.append(imgWrap, brand, name, priceRow);
    grid.appendChild(card);
  });
  panel.appendChild(grid);
  panel.appendChild(
    el('div', { padding: '12px', textAlign: 'center', fontSize: '11px', color: '#aaa' }, s.end),
  );
  return panel;
}

/** direction=vertical 용 — 스크롤되지 않는 풀사이즈 카드 (세로 페이저는 스크롤 패널과 공존 불가). */
function buildCardPanel(i: number, s: PanelStrings, assets: Assets): HTMLElement {
  const panel = el('div', {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    touchAction: 'none',
    background: '#111',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
  });
  panel.dataset.panelIndex = String(i);
  const img = el('img', {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  });
  img.src = assets.banners[i % assets.banners.length] ?? '';
  img.alt = s.tabs[i] ?? '';
  img.draggable = false;
  const overlay = el('div', {
    position: 'absolute',
    left: '0',
    right: '0',
    bottom: '0',
    padding: '20px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
  });
  const badge = el(
    'span',
    {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '10px',
      background: '#fff',
      color: '#111',
      fontSize: '12px',
      fontWeight: '700',
    },
    String(i),
  );
  overlay.append(
    badge,
    el('div', { fontSize: '24px', fontWeight: '800', marginTop: '8px' }, s.tabs[i] ?? `Card ${i}`),
    el('div', { fontSize: '13px', opacity: '0.85', marginTop: '4px' }, s.bannerSub),
    el(
      'div',
      {
        display: 'inline-block',
        marginTop: '12px',
        padding: '10px 16px',
        borderRadius: '8px',
        background: '#fff',
        color: '#111',
        fontSize: '13px',
        fontWeight: '700',
      },
      s.shopNow,
    ),
  );
  panel.append(img, overlay);
  return panel;
}

function buildPanels(kind: PanelKind, s: PanelStrings): HTMLElement[] {
  const assets: Assets = {
    products: makeProductImages(),
    banners: makeBannerImages(BANNER_SLIDES),
  };
  return Array.from({ length: PANEL_COUNT }, (_, i) =>
    kind === 'card' ? buildCardPanel(i, s, assets) : buildFeedPanel(i, s, assets),
  );
}

interface DemoOptions {
  direction: ScrollContainerDirection;
  overscan: number;
  snapThreshold: number;
  resistance: number;
  minZoom: number;
  maxZoom: number;
  enablePinchZoom: boolean;
  doubleTapZoom: number | false;
  dragThreshold: number;
  panelWidth: number;
  gap: number;
  align: 'center' | 'start';
  /** 배너(Swiper)를 페이저 무시 영역으로 둘지 — 끄면 배너를 밀 때 배너와 패널이 함께 움직인다 */
  noDrag: boolean;
}

function ScrollContainerInstance(props: DemoOptions) {
  const { tr } = useLang();
  const sc = tr.scrollContainer;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 패널은 최초 마운트 시점의 언어·direction으로 1회만 빌드한다 (옵션 변경은 key 재마운트).
  const panels = useMemo(
    () => buildPanels(props.direction === 'vertical' ? 'card' : 'feed', sc),
    [],
  );
  const [likes, setLikes] = useState(0);

  const { containerRef, activeIndex, activeZoom, scrollTo, zoomTo } = useScrollContainer({
    direction: props.direction,
    panels,
    initialIndex: 0,
    overscan: props.overscan,
    snapThreshold: props.snapThreshold,
    resistance: props.resistance,
    minZoom: props.minZoom,
    maxZoom: props.maxZoom,
    enablePinchZoom: props.enablePinchZoom,
    doubleTapZoom: props.doubleTapZoom,
    dragThreshold: props.dragThreshold,
    // 1 이면 옵션을 넘기지 않는다 — 패널 폭은 CSS(width: 100%)가 정한다
    ...(props.panelWidth === 1 ? {} : { panelWidth: props.panelWidth }),
    gap: props.gap,
    align: props.align,
    ...(props.noDrag ? { noDragSelector: '.swiper' } : {}),
  });

  // 배너 캐러셀 — 페이저가 패널을 root 에 붙인 뒤 만든다 (이 effect 는 useScrollContainer 의 effect 다음에 돈다).
  // 가려진 패널의 배너는 폭 0 으로 시작하지만 Swiper 의 resizeObserver(기본 켜짐)가 보일 때 다시 잰다.
  useEffect(() => {
    const swipers = panels.flatMap((panel) =>
      Array.from(panel.querySelectorAll<HTMLElement>('.swiper')).map((bannerEl) => {
        const counter = bannerEl.querySelector<HTMLElement>('[data-banner-counter]');
        return new Swiper(bannerEl, {
          on: {
            slideChange: (sw) => {
              if (counter) counter.textContent = `${sw.activeIndex + 1} | ${BANNER_SLIDES}`;
            },
          },
        });
      }),
    );
    return () => {
      for (const sw of swipers) sw.destroy(true, true);
    };
  }, [panels]);

  // 패널 안 버튼 클릭이 페이저를 거쳐도 정상 도달하는지 보여주는 카운터 (좋아요 토글)
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onClick = (e: Event) => {
      const btn = (e.target as HTMLElement | null)?.closest(
        '[data-like]',
      ) as HTMLButtonElement | null;
      if (!btn) return;
      const on = btn.textContent === '♥';
      btn.textContent = on ? '♡' : '♥';
      btn.style.color = on ? '' : '#e11d74';
      setLikes((n) => n + (on ? -1 : 1));
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [containerRef]);

  return (
    <>
      <div style={phoneFrame}>
        <div ref={containerRef} style={canvasStyle} data-testid="sc-canvas" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <DataRow label="activeIndex" value={String(activeIndex)} />
        <DataRow label="activeZoom" value={activeZoom.toFixed(3)} />
        <DataRow label="direction" value={props.direction} />
        <DataRow label="likes" value={String(likes)} />
      </div>

      <p style={sectionLabel}>{tr.scrollTo}</p>
      <div style={btnGrid}>
        {[0, 2, PANEL_COUNT - 1].map((idx) => (
          <button
            key={`a-${idx}`}
            type="button"
            onClick={() => scrollTo(idx, { animated: true })}
            style={actionBtn}
          >
            scrollTo({idx}) ✦
          </button>
        ))}
        {[0, 2, PANEL_COUNT - 1].map((idx) => (
          <button
            key={`i-${idx}`}
            type="button"
            onClick={() => scrollTo(idx, { animated: false })}
            style={{ ...actionBtn, ...actionBtnOutline }}
          >
            scrollTo({idx})
          </button>
        ))}
      </div>

      <p style={sectionLabel}>{tr.zoomTo}</p>
      <div style={btnGrid}>
        {[1, 2, 3].map((z) => (
          <button
            key={`za-${z}`}
            type="button"
            onClick={() => zoomTo(z, { animated: true })}
            style={actionBtn}
          >
            zoomTo({z}) ✦
          </button>
        ))}
        {[1, 2, 3].map((z) => (
          <button
            key={`zi-${z}`}
            type="button"
            onClick={() => zoomTo(z, { animated: false })}
            style={{ ...actionBtn, ...actionBtnOutline }}
          >
            zoomTo({z})
          </button>
        ))}
      </div>
    </>
  );
}

export function ScrollContainerDemo() {
  const [direction, setDirection] = useState<ScrollContainerDirection>('horizontal');
  const [overscan, setOverscan] = useState(1);
  const [snapThreshold, setSnapThreshold] = useState(0.3);
  const [resistance, setResistance] = useState(0.2);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(3);
  const [enablePinchZoom, setEnablePinchZoom] = useState(true);
  // 데모 기본값은 2 — 실제 앱에서는 기본 꺼짐(false). 패널 안 버튼을 두 번 탭해도 줌이 토글되는 것을 그대로 보여준다.
  const [doubleTapZoom, setDoubleTapZoom] = useState<number | false>(2);
  const [dragThreshold, setDragThreshold] = useState(10);
  const [panelWidth, setPanelWidth] = useState(1);
  const [gap, setGap] = useState(0);
  const [align, setAlign] = useState<'center' | 'start'>('center');
  const [noDrag, setNoDrag] = useState(true);

  const { tr } = useLang();
  const s = tr.scrollContainer;
  const c = tr.controls;

  const remountKey = [
    direction,
    overscan,
    snapThreshold,
    resistance,
    minZoom,
    maxZoom,
    enablePinchZoom,
    doubleTapZoom,
    dragThreshold,
    panelWidth,
    gap,
    align,
    noDrag,
  ].join('|');

  return (
    <DemoCard title={s.title} description={s.description} note={s.note}>
      <ControlGrid>
        <ControlItem label={c.direction}>
          <select
            data-testid="ctl-direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as ScrollContainerDirection)}
            style={selectStyle}
          >
            <option value="horizontal">horizontal</option>
            <option value="vertical">vertical</option>
            <option value="both">both</option>
          </select>
        </ControlItem>
        <ControlItem label={c.overscan(overscan)}>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={overscan}
            onChange={(e) => setOverscan(Number(e.target.value))}
          />
        </ControlItem>
        <ControlItem label={c.snapThreshold}>
          <input
            type="number"
            min={0.05}
            max={1}
            step={0.05}
            value={snapThreshold}
            onChange={(e) => setSnapThreshold(Number(e.target.value))}
            style={inputStyle}
          />
        </ControlItem>
        <ControlItem label={c.resistance}>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={resistance}
            onChange={(e) => setResistance(Number(e.target.value))}
            style={inputStyle}
          />
        </ControlItem>
        <ControlItem label={c.minZoom}>
          <input
            type="number"
            min={0.1}
            max={5}
            step={0.1}
            value={minZoom}
            onChange={(e) => setMinZoom(Number(e.target.value))}
            style={inputStyle}
          />
        </ControlItem>
        <ControlItem label={c.maxZoom}>
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.5}
            value={maxZoom}
            onChange={(e) => setMaxZoom(Number(e.target.value))}
            style={inputStyle}
          />
        </ControlItem>
        <ControlItem label={c.enablePinchZoom}>
          <label style={checkboxRowStyle}>
            <input
              data-testid="ctl-enable-pinch-zoom"
              type="checkbox"
              checked={enablePinchZoom}
              onChange={(e) => setEnablePinchZoom(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>{String(enablePinchZoom)}</span>
          </label>
        </ControlItem>
        <ControlItem label={c.doubleTapZoom}>
          <select
            data-testid="ctl-double-tap-zoom"
            value={doubleTapZoom === false ? 'off' : String(doubleTapZoom)}
            onChange={(e) =>
              setDoubleTapZoom(e.target.value === 'off' ? false : Number(e.target.value))
            }
            style={selectStyle}
          >
            <option value="off">false</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </ControlItem>
        <ControlItem label={c.dragThreshold}>
          <input
            data-testid="ctl-drag-threshold"
            type="number"
            min={0}
            max={40}
            step={1}
            value={dragThreshold}
            onChange={(e) => setDragThreshold(Math.max(0, Number(e.target.value)))}
            style={inputStyle}
          />
        </ControlItem>
        <ControlItem label={c.panelWidth}>
          <select
            data-testid="ctl-panel-width"
            value={String(panelWidth)}
            onChange={(e) => setPanelWidth(Number(e.target.value))}
            style={selectStyle}
          >
            <option value="1">1 (100%)</option>
            <option value="0.85">0.85</option>
            <option value="0.7">0.7</option>
            <option value="280">280px</option>
          </select>
        </ControlItem>
        <ControlItem label={c.gap}>
          <input
            data-testid="ctl-gap"
            type="number"
            min={0}
            max={48}
            step={4}
            value={gap}
            onChange={(e) => setGap(Math.max(0, Number(e.target.value)))}
            style={inputStyle}
          />
        </ControlItem>
        <ControlItem label={c.align}>
          <select
            data-testid="ctl-align"
            value={align}
            onChange={(e) => setAlign(e.target.value === 'start' ? 'start' : 'center')}
            style={selectStyle}
          >
            <option value="center">center</option>
            <option value="start">start</option>
          </select>
        </ControlItem>
        <ControlItem label={c.noDragSelector}>
          <label style={checkboxRowStyle}>
            <input
              data-testid="ctl-no-drag"
              type="checkbox"
              checked={noDrag}
              onChange={(e) => setNoDrag(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>{noDrag ? "'.swiper'" : 'off'}</span>
          </label>
        </ControlItem>
      </ControlGrid>

      <ScrollContainerInstance
        key={remountKey}
        direction={direction}
        overscan={overscan}
        snapThreshold={snapThreshold}
        resistance={resistance}
        minZoom={minZoom}
        maxZoom={maxZoom}
        enablePinchZoom={enablePinchZoom}
        doubleTapZoom={doubleTapZoom}
        dragThreshold={dragThreshold}
        panelWidth={panelWidth}
        gap={gap}
        align={align}
        noDrag={noDrag}
      />
    </DemoCard>
  );
}

// 폰 프레임: 실제 WebView 뷰포트 비율에 가깝게 (최대 폭 420, 높이 560)
const phoneFrame: React.CSSProperties = {
  maxWidth: 420,
  margin: '0 auto',
  borderRadius: 14,
  padding: 6,
  background: '#1f2937',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
};
const canvasStyle: React.CSSProperties = {
  width: '100%',
  height: 560,
  position: 'relative',
  background: '#111',
  overflow: 'hidden',
  touchAction: 'none',
  borderRadius: 10,
};
const sectionLabel: React.CSSProperties = {
  margin: '16px 0 6px',
  fontSize: 11,
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
const btnGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
};
const actionBtn: React.CSSProperties = {
  padding: '8px 4px',
  fontSize: 11,
  fontWeight: 600,
  border: 'none',
  borderRadius: 8,
  background: '#4f46e5',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const actionBtnOutline: React.CSSProperties = {
  background: '#fff',
  color: '#4f46e5',
  border: '1.5px solid #4f46e5',
};
