# Aak Artesanías v1

Aplicación web Angular 22 para catálogo de muebles artesanales mexicanos. Cliente para la API de administración de contenidos, con catálogo público, cotizaciones y generación de PDF.

## Stack

| Capa | Tecnología |
|------|-----------|
| **Framework** | Angular 22 (standalone, Signals) |
| **Estilos** | Tailwind CSS v4 + PostCSS |
| **Iconos** | ng-icons (Feather, Heroicons, Material) |
| **PDF** | jsPDF + jspdf-autotable |
| **Markdown** | marked |
| **Galería** | lightgallery |
| **Admin API** | Express + TypeScript (en `admin-api/`) |
| **Despliegue** | Vercel |

## Requisitos

- Node.js >= 22
- npm >= 11

## Scripts disponibles

| Comando | Descripción |
|---------|------------|
| `npm install` | Instalar dependencias |
| `npm start` | Iniciar servidor de desarrollo (puerto 4200) |
| `npm run build` | Build de producción (ejecuta prebuild automáticamente) |
| `npm run watch` | Build en modo watch (desarrollo) |
| `npm run prebuild` | Verificar integridad de datos, sincronizar configuraciones |
| `npm run i18n:extract` | Extraer textos para traducción |

## Flujo de trabajo

### Desarrollo local

```bash
# 1. Clonar e instalar
npm install

# 2. Iniciar servidor de desarrollo
npm start

# 3. Abrir http://localhost:4200
```

### Build de producción

```bash
npm run build
```

El build:
1. Ejecuta `utilities/prebuild.mjs` que verifica archivos JSON de configuración y datos
2. Sincroniza productos desde `admin-api/data/` si hay datos más recientes
3. Genera `src/app/core/data/contact.config.ts` desde `config/contact.config.json`
4. Compila la aplicación con Angular CLI en modo producción

El output se genera en `dist/AakArtesanias/`.

### Despliegue en Vercel

El proyecto incluye [`vercel.json`](vercel.json) con configuración lista para Vercel.

**Opción 1 — CLI de Vercel:**
```bash
npm i -g vercel
vercel --prod
```

**Opción 2 — Git + Vercel Dashboard:**
1. Subir el proyecto a GitHub
2. En [vercel.com](https://vercel.com), importar el repositorio
3. Framework: Angular
4. Build command: `npm run build`
5. Output directory: `dist/AakArtesanias`
6. Desplegar

### Admin API (opcional)

Para usar la API de administración local:

```bash
cd admin-api
npm install
cp .env.example .env   # Configurar GEMINI_API_KEY
npm run dev
```

## Estructura del proyecto

```
AakArtesanias/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── data/           # JSON de productos, categorías
│   │   │   ├── models/         # Interfaces TypeScript
│   │   │   ├── services/       # Servicios (productos, categorías, cotización, etc.)
│   │   │   └── utils/          # Utilidades
│   │   ├── features/
│   │   │   ├── home/           # Página principal
│   │   │   ├── shop/           # Tienda (lista de productos)
│   │   │   ├── category/       # Productos por categoría
│   │   │   ├── product-detail/ # Detalle de producto
│   │   │   ├── quote/          # Cotización
│   │   │   └── shipping/       # Información de envío
│   │   ├── shared/             # Componentes reutilizables
│   │   └── admin/              # Panel de administración
│   ├── assets/                 # Imágenes, fuentes, SVGs
│   ├── styles.css              # Estilos globales + tema corporativo
│   └── index.html              # Entry point con meta tags SEO
├── config/                     # Configuración (contacto, envío)
├── utilities/                  # Scripts de soporte (prebuild, seed)
└── admin-api/                  # API Express para administración
```

## SEO

La aplicación incluye un [`SeoService`](src/app/core/services/seo.service.ts) que actualiza dinámicamente:
- Title de la página
- Meta description
- Open Graph (og:title, og:description, og:image, og:url)
- Twitter Card

Cada componente de página (home, shop, category, product-detail, quote, shipping) establece sus propias meta etiquetas en `ngOnInit`.

## Características

- **Modo oscuro** con persistencia en localStorage y detección de preferencia del sistema
- **Catálogo dinámico** desde archivos JSON con categorías y variantes
- **Productos destacados** en la página principal
- **Cotización** con calculadora de envío y exportación a PDF
- **Lista de deseos** con persistencia local
- **Galería de imágenes** con lightgallery
- **Diseño responsive** con Tailwind CSS
- **Scroll animations** con directiva personalizada IntersectionObserver

## Licencia

Uso interno — Aak Artesanías
