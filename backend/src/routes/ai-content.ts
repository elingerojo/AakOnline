import { Router } from 'express';
import { generateContent, GeminiError } from '../services/gemini.service.js';
import { ensureBlobUrl } from './images.js';

const router = Router();

// POST /api/ai/generate-content
// Body: { images: string[], categoryName: string, categoryId: number }
// Gemini primero, Blob después (solo si Gemini responde OK)
router.post('/generate-content', async (req, res) => {
  try {
    const { images, categoryName, categoryId } = req.body;

    if (!images || images.length === 0) {
      res.status(400).json({ error: 'At least one image is required' });
      return;
    }

    if (!categoryId) {
      res.status(400).json({ error: 'categoryId is required' });
      return;
    }

    let imageSource = images[0];

    // ── 1. Convertir imagen a base64 (sin subir a Blob aún) ────────────────
    let imageBase64: string;

    if (imageSource.startsWith('https://')) {
      // URL de Blob — descargar y convertir a base64
      try {
        const response = await fetch(imageSource);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageBase64 = buffer.toString('base64');
      } catch (err) {
        console.error('[AI] Error fetching Blob image:', err);
        res.status(500).json({ error: 'Failed to fetch image from Blob storage' });
        return;
      }
    } else if (imageSource.startsWith('data:')) {
      imageBase64 = imageSource.split(',')[1] ?? imageSource;
    } else if (imageSource.startsWith('base64,')) {
      imageBase64 = imageSource.replace('base64,', '');
    } else {
      // Ruta local — leer del filesystem
      const { readFileSync } = await import('fs');
      const { resolve, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const imagePath = resolve(__dirname, '..', '..', '..', 'frontend', 'src', imageSource);
      const imageBuffer = readFileSync(imagePath);
      imageBase64 = imageBuffer.toString('base64');
    }

    // ── 2. Llamar a Gemini (si falla, no se sube nada a Blob) ─────────────
    const content = await generateContent(imageBase64, categoryName ?? 'General', categoryId);

    // ── 3. Solo si Gemini funciona, migrar la imagen a Blob ───────────────
    let blobImageUrl: string | null = null;

    if (imageSource.startsWith('assets/') || (!imageSource.startsWith('https://') && !imageSource.startsWith('data:'))) {
      // Es ruta local → migrar a Blob ahora
      blobImageUrl = await ensureBlobUrl(imageSource);
      if (blobImageUrl !== imageSource) {
        console.log(`[AI] Image migrated to Blob after Gemini success: ${imageSource} → ${blobImageUrl}`);
      } else {
        blobImageUrl = null; // No se pudo migrar
      }
    } else if (imageSource.startsWith('https://')) {
      blobImageUrl = imageSource; // Ya está en Blob
    }

    res.json({
      ...content,
      blobImageUrl,
    });
  } catch (error) {
    if (error instanceof GeminiError) {
      console.error(`[AI] Gemini error ${error.statusCode}: ${error.message}`);
      res.status(error.statusCode).json({
        error: error.message,
        statusCode: error.statusCode,
        statusText: error.statusText,
      });
    } else {
      console.error('[AI] Unexpected error:', error);
      res.status(500).json({
        error: 'Error inesperado al generar contenido',
        statusCode: 500,
      });
    }
  }
});

export default router;
