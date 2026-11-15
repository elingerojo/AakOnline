import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import aiContentRouter from './routes/ai-content.js';
import imagesRouter from './routes/images.js';
import shippingConfigRouter from './routes/shipping-config.js';
import cacheRouter from './routes/cache.js';
import metricsRouter from './routes/metrics.js';
import { promptCache } from './services/prompt-cache.service.js';

// Load .env
config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 3000;

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/ai', aiContentRouter);
app.use('/api/images', imagesRouter);
app.use('/api/shipping-config', shippingConfigRouter);
app.use('/api/cache', cacheRouter);
app.use('/api/metrics', metricsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Errores de parseo del cuerpo (express.json) y demás: JSON sin stack trace.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = Number(err?.status) || 500;
  console.warn('[api] request error:', err?.message ?? 'unknown');
  res.status(status).json({ error: status === 400 ? 'invalid-request' : 'internal-error' });
});

// Inicializar caché de prompts al arrancar
promptCache.initialize().then(() => {
  console.log('[Gemini] Prompt cache initialized');
});

app.listen(PORT, () => {
  console.log(`[admin-api] Server running on http://localhost:${PORT}`);
  console.log(`[admin-api] Data directory: ../frontend/src/app/core/data`);
});
