import { Router } from 'express';
import { generateContent } from '../services/gemini.service.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// POST /api/ai/generate-content
// Body: { images: string[], categoryId: number }
// images: array of image URLs or base64 strings
router.post('/generate-content', async (req, res) => {
  try {
    const { images, categoryName } = req.body;

    if (!images || images.length === 0) {
      res.status(400).json({ error: 'At least one image is required' });
      return;
    }

    // If the image is a URL (path), convert to base64
    let imageBase64 = images[0];
    if (!imageBase64.startsWith('data:') && !imageBase64.startsWith('base64,')) {
      // Assume it's a file path relative to project root
      const imagePath = resolve(__dirname, '..', '..', '..', imageBase64);
      try {
        const imageBuffer = readFileSync(imagePath);
        imageBase64 = imageBuffer.toString('base64');
      } catch {
        // If file not found, use placeholder
        console.warn(`[AI] Could not read image: ${imagePath}`);
      }
    }

    const content = await generateContent(imageBase64, categoryName ?? 'General');
    res.json(content);
  } catch (error) {
    console.error('[AI] Error generating content:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

export default router;
