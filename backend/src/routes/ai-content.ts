import { Router } from 'express';
import { generateContent } from '../services/gemini.service.js';
import { ensureBlobUrl } from './images.js';

const router = Router();

// POST /api/ai/generate-content
// Body: { images: string[], categoryName: string }
// Si la imagen es local (assets/...), la migra automáticamente a Vercel Blob
// antes de enviarla a Gemini (migración natural).
router.post('/generate-content', async (req, res) => {
  try {
    const { images, categoryName } = req.body;

    if (!images || images.length === 0) {
      res.status(400).json({ error: 'At least one image is required' });
      return;
    }

    let imageSource = images[0];

    // Si es ruta local, migrar a Blob primero (migración natural)
    if (!imageSource.startsWith('data:') && !imageSource.startsWith('base64,')) {
      const blobUrl = await ensureBlobUrl(imageSource);

      if (blobUrl !== imageSource) {
        console.log(`[AI] Image migrated to Blob: ${imageSource} → ${blobUrl}`);
        imageSource = blobUrl;
      }
    }

    // Convertir imagen a base64 para enviar a Gemini
    let imageBase64: string;

    if (imageSource.startsWith('https://')) {
      // Es URL de Blob — descargar y convertir a base64
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
      // Ya es data URL, extraer solo el base64
      imageBase64 = imageSource.split(',')[1] ?? imageSource;
    } else if (imageSource.startsWith('base64,')) {
      imageBase64 = imageSource.replace('base64,', '');
    } else {
      // Ruta local directa — se usará la original (fallback)
      const { readFileSync } = await import('fs');
      const { resolve, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const imagePath = resolve(__dirname, '..', '..', '..', 'frontend', 'src', imageSource);
      const imageBuffer = readFileSync(imagePath);
      imageBase64 = imageBuffer.toString('base64');
    }

    const content = await generateContent(imageBase64, categoryName ?? 'General');

    // Incluir la URL de Block en la respuesta para que el frontend la use
    res.json({
      ...content,
      blobImageUrl: imageSource.startsWith('https://') ? imageSource : null,
    });
  } catch (error) {
    console.error('[AI] Error generating content:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

export default router;
