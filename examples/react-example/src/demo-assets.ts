/**
 * 데모 전용 에셋 생성기 — 저장소에 이미지 바이너리를 두지 않고, 시드 고정 PRNG + 캔버스로
 * "사진처럼 디코드 비용이 있는" JPEG 데이터 URL을 런타임에 만든다.
 * 같은 시드면 항상 같은 그림이 나오므로 스크린샷 비교·e2e에 쓸 수 있다.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCT_HUES = [12, 32, 48, 96, 150, 190, 210, 260, 290, 330, 5, 170];

/** `CanvasPath.roundRect`는 구형 WebView에 없으므로 직접 그린다. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 상품 사진 풀 — 480×480 JPEG 12장. 그라디언트 배경 + 흐트러진 색 조각 + 라벨. */
export function makeProductImages(count = 12, seed = 20260923): string[] {
  if (typeof document === 'undefined') return [];
  const rand = mulberry32(seed);
  const size = 480;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = PRODUCT_HUES[i % PRODUCT_HUES.length] ?? 0;
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, `hsl(${hue}, 45%, 88%)`);
    g.addColorStop(1, `hsl(${hue + 30}, 40%, 72%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // 사진 느낌의 디테일 (JPEG 디코드·래스터 비용을 실제 사진 수준으로)
    for (let k = 0; k < 1800; k++) {
      ctx.fillStyle = `hsla(${hue + rand() * 60 - 30}, 60%, ${35 + rand() * 50}%, 0.55)`;
      const w = 4 + rand() * 40;
      ctx.fillRect(rand() * size, rand() * size, w, w * (0.4 + rand()));
    }
    // 상품 실루엣
    ctx.fillStyle = `hsla(${hue + 180}, 30%, 25%, 0.85)`;
    roundedRect(ctx, size * 0.28, size * 0.22, size * 0.44, size * 0.56, 28);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(`ITEM ${String(i + 1).padStart(2, '0')}`, size * 0.3, size * 0.52);
    out.push(canvas.toDataURL('image/jpeg', 0.82));
  }
  return out;
}

/** 배너 풀 — 800×450 JPEG 3장. */
export function makeBannerImages(count = 3, seed = 777): string[] {
  if (typeof document === 'undefined') return [];
  const rand = mulberry32(seed);
  const w = 800;
  const h = 450;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 110 + 20) % 360;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `hsl(${hue}, 60%, 55%)`);
    g.addColorStop(1, `hsl(${hue + 50}, 60%, 35%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 14; k++) {
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, 40 + rand() * 160, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    out.push(canvas.toDataURL('image/jpeg', 0.8));
  }
  return out;
}

export interface DemoProduct {
  brand: string;
  name: string;
  price: number;
  discount: number; // %
  image: string;
  badge?: string;
}

const BRANDS = [
  'Lazy Daisy',
  'Youth Spirit',
  'Studio Moss',
  'Objet Lab',
  'Paper & Co',
  'Nomad Home',
];
const NOUNS = [
  'Diary case',
  'Mini cup candle',
  'Linen cushion',
  'Ceramic mug',
  'Wall poster',
  'Desk lamp',
  'Tote bag',
  'Incense holder',
  'Glass vase',
  'Bookmark set',
];
const ADJ = [
  'Stripe green',
  'Vintage brown',
  'Matcha',
  'Soft pink',
  'Charcoal',
  'Ivory',
  'Cobalt',
  'Sand',
];

/** 패널마다 다른, 그러나 재현 가능한 상품 목록. */
export function makeProducts(panelIndex: number, count: number, images: string[]): DemoProduct[] {
  const rand = mulberry32(1000 + panelIndex);
  const out: DemoProduct[] = [];
  for (let k = 0; k < count; k++) {
    const price = 9000 + Math.floor(rand() * 60) * 500;
    const discount = rand() < 0.4 ? 5 + Math.floor(rand() * 8) * 5 : 0;
    const badgeRoll = rand();
    const product: DemoProduct = {
      brand: BRANDS[Math.floor(rand() * BRANDS.length)] ?? 'Brand',
      name: `${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUNS[Math.floor(rand() * NOUNS.length)]}`,
      price,
      discount,
      image: images[(panelIndex * 7 + k) % Math.max(1, images.length)] ?? '',
    };
    if (badgeRoll < 0.2) product.badge = 'NEW';
    else if (badgeRoll < 0.35) product.badge = 'BEST';
    out.push(product);
  }
  return out;
}

export function formatPrice(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}
