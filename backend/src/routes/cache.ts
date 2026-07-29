import { Router } from 'express';
import { promptCache } from '../services/prompt-cache.service.js';

const router = Router();

// POST /api/cache/refresh — Refresca el caché de exclusión (si es día nuevo)
router.post('/refresh', async (_req, res) => {
  try {
    await promptCache.refreshIfNeeded();
    res.json({ success: true, refreshedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[Cache] Refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh cache' });
  }
});

export default router;
