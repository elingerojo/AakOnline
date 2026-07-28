import { Router } from 'express';
import multer from 'multer';
import { put, del } from '@vercel/blob';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// ── Multer: memoryStorage (no escribe en disco) ──────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP and GIF are allowed.'));
    }
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAssetsDir(): string {
  return resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'assets');
}

/**
 * Detecta si una ruta de imagen es local (comienza con "assets/")
 * y en ese caso la sube a Vercel Blob, devolviendo la URL pública.
 * Si ya es URL de Blob, la devuelve tal cual.
 */
export async function ensureBlobUrl(imagePath: string): Promise<string> {
  if (!imagePath || imagePath.startsWith('https://')) {
    return imagePath; // Ya es URL externa (Blob, etc.)
  }

  // Es una ruta local (ej: "assets/img/products/065.png")
  // Intentamos resolverla en el filesystem
  const localPath = imagePath.startsWith('assets/')
    ? resolve(getAssetsDir(), imagePath.replace('assets/', ''))
    : resolve(getAssetsDir(), 'img', 'products', imagePath);

  if (!existsSync(localPath)) {
    console.warn(`[Blob] Local image not found: ${localPath}`);
    return imagePath; // Devolvemos la ruta original como fallback
  }

  try {
    const buffer = readFileSync(localPath);
    const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    const blob = await put(filename, buffer, {
      access: 'public',
      addRandomSuffix: true,
    });

    console.log(`[Blob] Migrated local image → ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error('[Blob] Error uploading local image:', error);
    return imagePath;
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /api/images/upload — Sube imagen a Vercel Blob
router.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const buffer = req.file.buffer;
    const ext = req.file.originalname.split('.').pop() ?? 'jpg';
    const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const blob = await put(filename, buffer, {
      access: 'public',
      addRandomSuffix: true,
    });

    res.json({
      url: blob.url,
      filename: blob.pathname,
      size: req.file.size,
    });
  } catch (error) {
    console.error('[Blob] Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// POST /api/images/migrate-local — Migra una imagen local a Vercel Blob
router.post('/migrate-local', async (req, res) => {
  const { localPath } = req.body;

  if (!localPath) {
    res.status(400).json({ error: 'localPath is required' });
    return;
  }

  const blobUrl = await ensureBlobUrl(localPath);

  if (blobUrl === localPath) {
    res.status(400).json({ error: 'Could not migrate image', localPath });
    return;
  }

  res.json({ url: blobUrl, original: localPath });
});

// DELETE /api/images/delete — Elimina de Vercel Blob
router.delete('/delete', async (req, res) => {
  const { url } = req.body;

  if (!url?.startsWith('https://')) {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  try {
    await del(url);
    res.json({ success: true });
  } catch (error) {
    console.error('[Blob] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;
export { upload };
