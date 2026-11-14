/**
 * generate-seo.mjs — Réplicas estáticas por ruta con meta/OG/Twitter/canonical (Etapa 1)
 *
 * Se ejecuta en POSTBUILD, después de `ng build`. Los bundles finales tienen
 * nombres hasheados que solo existen tras el build, por lo que estas réplicas
 * se generan sobre el `index.html` ya compilado de
 * dist/AakArtesanias/browser/es.
 *
 * Alcance (meta tags por ruta + sitemap.xml + robots.txt):
 *   - /                  home (index.html base, normalizado)
 *   - /shop              → shop/index.html
 *   - /shipping          → shipping/index.html
 *   - /category/:slug    → category/<slug>/index.html  (categorías con ≥1 producto activo)
 *   - /product/:slug     → product/<slug>/index.html   (productos con status === 'activo')
 *
 * Los textos (title/description/imagen) replican exactamente lo que
 * `SeoService.setPageSeo()` publica en runtime, para que crawlers sin JS y
 * navegadores coincidan (single source of truth: products.json/categories.json).
 *
 * Uso:  node utilities/generate-seo.mjs
 * Env:  AAK_SITE_URL   (default https://aakbejuco.com)
 *       AAK_SEO_SKIP=1 desactiva la generación
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const SITE_URL = (process.env.AAK_SITE_URL ?? 'https://aakbejuco.com').replace(/\/+$/, '');
const BROWSER_DIR = join(root, 'dist', 'AakArtesanias', 'browser');
const DIST_DIR = join(BROWSER_DIR, 'es');
const INDEX_PATH = join(DIST_DIR, 'index.html');
const PRODUCTS_PATH = join(root, 'src', 'app', 'core', 'data', 'products.json');
const CATEGORIES_PATH = join(root, 'src', 'app', 'core', 'data', 'categories.json');

const SITE_NAME = 'AakBejuco';
const LOGO = 'assets/img/Logo_Aak_para-App-01.png';
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;

// ---------- helpers ----------

function readJson(path, fallback = []) {
  try {
    if (!existsSync(path)) throw new Error('archivo no encontrado');
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return Array.isArray(data) ? data : fallback;
  } catch (err) {
    console.warn(`[generate-seo] ⚠️  No se pudo leer ${path} (${err.message}); se usa vacío.`);
    return fallback;
  }
}

function escAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&' + 'amp;')
    .replace(/"/g, '&' + 'quot;')
    .replace(/</g, '&' + 'lt;')
    .replace(/>/g, '&' + 'gt;');
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/[#*`>]/g, '') // marca markdown simple
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, max) {
  const s = cleanText(value);
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

function absolutize(url) {
  if (/^https?:\/\//i.test(url ?? '')) return url;
  return `${SITE_URL}/${String(url ?? '').replace(/^\//, '')}`;
}

/** Escapa texto para nodos y atributos XML. */
function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&' + 'amp;')
    .replace(/</g, '&' + 'lt;')
    .replace(/>/g, '&' + 'gt;')
    .replace(/"/g, '&' + 'quot;')
    .replace(/'/g, '&' + 'apos;');
}

/** Devuelve YYYY-MM-DD (UTC) desde updatedAt/createdAt, o null si no existe. */
function toLastmod(record) {
  const raw = record?.updatedAt ?? record?.createdAt;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** Escribe un archivo en DIST_DIR y, si es distinto, también en la raíz browser/. */
function writeBuildFile(filename, content) {
  const targets = new Set([DIST_DIR]);
  if (existsSync(BROWSER_DIR) && BROWSER_DIR !== DIST_DIR) targets.add(BROWSER_DIR);
  for (const dir of targets) {
    writeFileSync(join(dir, filename), content);
  }
}

/** Genera sitemap.xml: home, shop, shipping, categorías y productos activos. */
function writeSitemap(activeProducts, activeCategories) {
  const entries = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    { loc: `${SITE_URL}/shop`, priority: '0.8' },
    { loc: `${SITE_URL}/shipping`, priority: '0.5' },
  ];

  for (const cat of activeCategories) {
    entries.push({ loc: `${SITE_URL}/category/${cat.slug}`, priority: '0.8', lastmod: toLastmod(cat) });
  }

  for (const prod of activeProducts) {
    entries.push({ loc: `${SITE_URL}/product/${prod.slug}`, priority: '0.7', lastmod: toLastmod(prod) });
  }

  const body = entries
    .map(({ loc, priority, lastmod }) => {
      const lines = [`    <loc>${xmlEscape(loc)}</loc>`];
      if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
      lines.push(`    <priority>${priority}</priority>`);
      return `  <url>\n${lines.join('\n')}\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  writeBuildFile('sitemap.xml', xml);
  return entries.length;
}

/** Genera robots.txt bloqueando /admin y apuntando al sitemap. */
function writeRobots() {
  const txt = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
  writeBuildFile('robots.txt', txt);
}

/** Reemplaza la primera ocurrencia del patrón; si no existe, inserta antes de </head>. */
function upsertTag(html, matcher, tagHtml) {
  if (matcher.test(html)) {
    return html.replace(matcher, () => tagHtml);
  }
  return html.replace('</head>', `${tagHtml}\n</head>`);
}

/**
 * Aplica las etiquetas SEO de una ruta sobre el HTML base (clon del index.html).
 * Fuerza <base href="/"> para que assets/scripts relativos resuelvan desde la
 * raíz del sitio aunque la réplica viva en un subdirectorio.
 */
function applySeo(html, seo) {
  const { title, description, url, image, type = 'website', imageDims = null } = seo;

  html = html.replace(/<base[^>]*>/i, '<base href="/">');

  html = upsertTag(html, /<title[^>]*>[\s\S]*?<\/title>/i, `    <title>${escAttr(title)}</title>`);
  html = upsertTag(html, /<meta name="title"[^>]*>/i, `    <meta name="title" content="${escAttr(title)}" />`);
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `    <meta name="description" content="${escAttr(description)}" />`
  );
  html = upsertTag(html, /<meta property="og:type"[^>]*>/i, `    <meta property="og:type" content="${escAttr(type)}" />`);
  html = upsertTag(html, /<meta property="og:url"[^>]*>/i, `    <meta property="og:url" content="${escAttr(url)}" />`);
  html = upsertTag(html, /<meta property="og:title"[^>]*>/i, `    <meta property="og:title" content="${escAttr(title)}" />`);
  html = upsertTag(
    html,
    /<meta property="og:description"[^>]*>/i,
    `    <meta property="og:description" content="${escAttr(description)}" />`
  );
  html = upsertTag(html, /<meta property="og:image"[^>]*>/i, `    <meta property="og:image" content="${escAttr(image)}" />`);
  html = upsertTag(
    html,
    /<meta property="og:site_name"[^>]*>/i,
    `    <meta property="og:site_name" content="${escAttr(SITE_NAME)}" />`
  );
  html = upsertTag(html, /<meta property="twitter:url"[^>]*>/i, `    <meta property="twitter:url" content="${escAttr(url)}" />`);
  html = upsertTag(html, /<meta property="twitter:title"[^>]*>/i, `    <meta property="twitter:title" content="${escAttr(title)}" />`);
  html = upsertTag(
    html,
    /<meta property="twitter:description"[^>]*>/i,
    `    <meta property="twitter:description" content="${escAttr(description)}" />`
  );
  html = upsertTag(html, /<meta property="twitter:image"[^>]*>/i, `    <meta property="twitter:image" content="${escAttr(image)}" />`);
  html = upsertTag(html, /<link rel="canonical"[^>]*>/i, `    <link rel="canonical" href="${escAttr(url)}">`);

  // Dimensiones de imagen OG solo cuando se conocen (home con el logo).
  if (imageDims) {
    html = upsertTag(
      html,
      /<meta property="og:image:width"[^>]*>/i,
      `    <meta property="og:image:width" content="${imageDims.width}" />`
    );
    html = upsertTag(
      html,
      /<meta property="og:image:height"[^>]*>/i,
      `    <meta property="og:image:height" content="${imageDims.height}" />`
    );
    html = upsertTag(
      html,
      /<meta property="og:image:type"[^>]*>/i,
      `    <meta property="og:image:type" content="${imageDims.type}" />`
    );
  } else {
    html = html.replace(/<meta property="og:image:(width|height|type)"[^>]*>\s*/gi, '');
  }

  return html;
}

/** Escribe una réplica estática para una ruta dada. */
function writeClone(route, seo, baseHtml) {
  const html = applySeo(baseHtml, seo);
  const outPath = join(DIST_DIR, route, 'index.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
}

function main() {
  if (process.env.AAK_SEO_SKIP === '1') {
    console.log('[generate-seo] ⏭️  Skip (AAK_SEO_SKIP=1)');
    return;
  }

  if (!existsSync(INDEX_PATH)) {
    console.warn(`[generate-seo] ⚠️  No existe ${INDEX_PATH}. ¿Se ejecutó el build? Se omite.`);
    return;
  }

  const baseHtml = readFileSync(INDEX_PATH, 'utf-8');
  const products = readJson(PRODUCTS_PATH);
  const categories = readJson(CATEGORIES_PATH);

  const activeProducts = products.filter((p) => p.status === 'activo' && SLUG_RE.test(p.slug ?? ''));
  const activeByCategory = new Map();
  for (const p of activeProducts) {
    const id = p.categoryId;
    activeByCategory.set(id, (activeByCategory.get(id) ?? 0) + 1);
  }
  const activeCategories = categories.filter((c) => (activeByCategory.get(c.id) ?? 0) > 0 && SLUG_RE.test(c.slug ?? ''));

  // Limpiar directorios generados por este script (evita páginas obsoletas).
  for (const d of ['shop', 'shipping', 'category', 'product']) {
    rmSync(join(DIST_DIR, d), { recursive: true, force: true });
  }

  let count = 0;
  const homeImage = absolutize(LOGO);

  // Home (index.html base) — normaliza tags y fuerza og:image absoluto.
  const homeHtml = applySeo(baseHtml, {
    title: 'AakBejuco — Muebles Artesanales Mexicanos',
    description:
      'Descubra muebles artesanales mexicanos hechos a mano. Calidad, diseño e innovación en piezas únicas para el hogar.',
    url: `${SITE_URL}/`,
    image: homeImage,
    type: 'website',
    imageDims: { width: 300, height: 300, type: 'image/png' },
  });
  writeFileSync(INDEX_PATH, homeHtml);
  count += 1;

  // /shop
  writeClone(
    'shop',
    {
      title: 'Tienda — AakBejuco',
      description: 'Explore nuestra colección completa de muebles artesanales mexicanos hechos a mano.',
      url: `${SITE_URL}/shop`,
      image: homeImage,
      type: 'website',
      imageDims: { width: 300, height: 300, type: 'image/png' },
    },
    homeHtml
  );
  count += 1;

  // /shipping
  writeClone(
    'shipping',
    {
      title: 'Métodos de Envío — AakBejuco',
      description:
        'Información sobre nuestros métodos de envío, empaque especializado y cobertura regional para muebles artesanales.',
      url: `${SITE_URL}/shipping`,
      image: homeImage,
      type: 'website',
      imageDims: { width: 300, height: 300, type: 'image/png' },
    },
    homeHtml
  );
  count += 1;

  // /category/:slug (categorías con ≥1 producto activo)
  for (const cat of activeCategories) {
    writeClone(
      `category/${cat.slug}`,
      {
        title: `${cat.name} — AakBejuco`,
        description: `Explore nuestra colección de ${cat.name} artesanales hechos a mano. ${cat.models} modelos disponibles.`,
        url: `${SITE_URL}/category/${cat.slug}`,
        image: absolutize(cat.productImage),
        type: 'website',
        imageDims: null,
      },
      homeHtml
    );
    count += 1;
  }

  // /product/:slug (productos activos)
  for (const prod of activeProducts) {
    const name = prod.name ?? 'Producto';
    writeClone(
      `product/${prod.slug}`,
      {
        title: `${name} — AakBejuco`,
        description: truncate(prod.shortDescription || `${name} hecho a mano en México.`, 200),
        url: `${SITE_URL}/product/${prod.slug}`,
        image: prod.image ? absolutize(prod.image) : homeImage,
        type: 'product',
        imageDims: null,
      },
      homeHtml
    );
    count += 1;
  }

  writeSitemap(activeProducts, activeCategories);
  writeRobots();

  console.log(
    `[generate-seo] ✅ Etapa 1 completada: ${count} páginas (${activeProducts.length} productos activos, ${activeCategories.length} categorías con productos).`
  );
}

try {
  main();
} catch (err) {
  // Fail-safe: nunca aborta el build de Vercel.
  console.warn('[generate-seo] ⚠️  Error inesperado (no se aborta el build):', err.message);
}
