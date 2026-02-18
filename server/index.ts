import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { CONFIG } from '../shared/config';
import { getDb } from './database/connection';
import { startScheduler } from './scheduler/priceChecker';

// Import routes
import productsRouter from './routes/products';
import pricesRouter from './routes/prices';
import alertsRouter from './routes/alerts';
import notificationsRouter from './routes/notifications';

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
app.use(express.json({ limit: '10kb' }));

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

// --- API Key Authentication ---
function apiKeyAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Skip auth if no API key is configured (dev mode)
  if (!CONFIG.API_KEY) {
    next();
    return;
  }

  const providedKey = req.headers['x-api-key'];
  if (providedKey === CONFIG.API_KEY) {
    next();
    return;
  }

  res.status(401).json({ success: false, error: 'Unauthorized. Provide a valid X-API-Key header.' });
}

// --- Auth check endpoint (for frontend) ---
app.get('/api/auth/check', (req, res) => {
  if (!CONFIG.API_KEY) {
    res.json({ success: true, data: { auth_required: false } });
    return;
  }
  const providedKey = req.headers['x-api-key'];
  const authenticated = providedKey === CONFIG.API_KEY;
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

// Apply stricter rate limit to scrape-triggering endpoints
app.use('/api/products/:id/check', scrapeLimiter);

export { app };

// Only start server when not running under Vitest
if (!process.env.VITEST) {
  getDb();
  startScheduler();

  app.listen(CONFIG.PORT, () => {
    console.log(`Price Tracker running at http://localhost:${CONFIG.PORT}`);
    if (CONFIG.API_KEY) {
      console.log('API key authentication: ENABLED');
    } else {
      console.log('API key authentication: DISABLED (set API_KEY in .env for production)');
    }
  });
}
