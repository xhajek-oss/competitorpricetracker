import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { CONFIG } from '../shared/config';
import { getDb } from './database/connection';
import { startScheduler } from './scheduler/priceChecker';
import { startBackupScheduler, createBackup } from './backup';
import { closeBrowser } from './scraper';
import { logger } from './logger';

// Import routes
import productsRouter from './routes/products';
import pricesRouter from './routes/prices';
import alertsRouter from './routes/alerts';
import notificationsRouter from './routes/notifications';
import statsRouter from './routes/stats';
import metricsRouter, { incrementMetric } from './routes/metrics';

const app = express();

// --- Security Headers ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));

// --- CORS — restrict to own origin ---
const allowedOrigin = CONFIG.ALLOWED_ORIGIN || `http://localhost:${CONFIG.PORT}`;
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
}));

// --- Body parser with size limit ---
app.use(express.json({ limit: '100kb' }));

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Try again later.' },
});

const scrapeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Scrape rate limit exceeded. Try again later.' },
});

// --- Multi-user API Key Authentication ---
// Supports single API_KEY or comma-separated API_KEYS="label1:key1,label2:key2"
function parseApiKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  if (CONFIG.API_KEY) {
    keys.set(CONFIG.API_KEY, 'default');
  }
  if (CONFIG.API_KEYS) {
    for (const entry of CONFIG.API_KEYS.split(',')) {
      const colonIdx = entry.indexOf(':');
      if (colonIdx > 0) {
        const label = entry.slice(0, colonIdx).trim();
        const key = entry.slice(colonIdx + 1).trim();
        if (key) keys.set(key, label);
      } else if (entry.trim()) {
        keys.set(entry.trim(), 'unnamed');
      }
    }
  }
  return keys;
}

const validApiKeys = parseApiKeys();

function apiKeyAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Skip auth if no API keys configured (dev mode)
  if (validApiKeys.size === 0) {
    next();
    return;
  }

  const providedKey = req.headers['x-api-key'] as string | undefined;
  if (providedKey && validApiKeys.has(providedKey)) {
    const label = validApiKeys.get(providedKey)!;
    logger.debug({ user: label }, 'Authenticated request');
    next();
    return;
  }

  res.status(401).json({ success: false, error: 'Unauthorized. Provide a valid X-API-Key header.' });
}

// --- API request counter ---
app.use('/api', (_req, _res, next) => { incrementMetric('api_requests'); next(); });

// --- Prometheus metrics (public, no auth) ---
app.use('/metrics', metricsRouter);

// --- Health check (public, no auth) ---
const startedAt = new Date().toISOString();

app.get('/api/health', (_req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      started_at: startedAt,
      products: row.count,
      node: process.version,
    });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// --- Auth check endpoint (for frontend) ---
app.get('/api/auth/check', (req, res) => {
  if (validApiKeys.size === 0) {
    res.json({ success: true, data: { auth_required: false } });
    return;
  }
  const providedKey = req.headers['x-api-key'] as string | undefined;
  const authenticated = !!(providedKey && validApiKeys.has(providedKey));
  res.json({ success: true, data: { auth_required: true, authenticated } });
});

// --- Serve static frontend files ---
app.use(express.static(path.join(__dirname, '..', 'client'), {
  dotfiles: 'deny',
}));

// --- API Routes (protected) ---
app.use('/api/products', apiLimiter, apiKeyAuth, productsRouter);
app.use('/api', apiLimiter, apiKeyAuth, pricesRouter);
app.use('/api/alerts', apiLimiter, apiKeyAuth, alertsRouter);
app.use('/api/notifications', apiLimiter, apiKeyAuth, notificationsRouter);
app.use('/api/stats', apiLimiter, apiKeyAuth, statsRouter);

// Apply stricter rate limit to scrape-triggering endpoints
app.use('/api/products/:id/check', scrapeLimiter);

export { app };

// Only start server when not running under Vitest
if (!process.env.VITEST) {
  const db = getDb();
  startScheduler();
  startBackupScheduler();

  // Create initial backup on startup
  createBackup();

  const server = app.listen(CONFIG.PORT, () => {
    logger.info({ port: CONFIG.PORT }, `Price Tracker running at http://localhost:${CONFIG.PORT}`);
    logger.info({ auth: !!CONFIG.API_KEY }, `API key authentication: ${CONFIG.API_KEY ? 'ENABLED' : 'DISABLED'}`);
  });

  // --- Graceful Shutdown ---
  function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down gracefully...');

    server.close(async () => {
      logger.info('HTTP server closed');
      await closeBrowser();
      try {
        db.close();
        logger.info('Database connection closed');
      } catch { /* already closed */ }
      process.exit(0);
    });

    // Force exit after 10 seconds if connections hang
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
