import { vi } from 'vitest';

// Mock config with API key for auth tests - BEFORE any server imports
vi.mock('../../shared/config', () => ({
  CONFIG: {
    PORT: 3000,
    NODE_ENV: 'test',
    API_KEY: 'test-secret-key',
    ALLOWED_ORIGIN: '',
    SCRAPER_TIMEOUT_MS: 30000,
    MAX_CONCURRENT_SCRAPES: 3,
    MAX_PRODUCTS: 100,
    MIN_CHECK_INTERVAL_MINUTES: 60,
    DEFAULT_CHECK_INTERVAL: 24,
    DEFAULT_CURRENCY: 'EUR',
    DEFAULT_NOTIFICATION_METHOD: 'email',
    RESEND_API_KEY: '',
    NOTIFICATION_FROM_EMAIL: '',
    NOTIFICATION_TO_EMAIL: '',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
    DB_PATH: '',
    SCRAPER_HEADLESS: true,
  },
}));

// Mock the scraper module
vi.mock('../../server/scraper/index', () => ({
  scrapePrice: vi.fn().mockResolvedValue({
    success: true,
    price: 9.99,
    currency: 'EUR',
    productName: 'Test',
    error: null,
    shopType: 'generic',
  }),
  detectShopType: vi.fn().mockReturnValue('generic'),
  validateUrlSafety: vi.fn().mockResolvedValue({ safe: true }),
}));

import request from 'supertest';
import { app } from '../../server/index';

describe('Auth API routes', () => {
  describe('GET /api/auth/check', () => {
    it('without API key returns auth_required true and authenticated false', async () => {
      const res = await request(app).get('/api/auth/check');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.auth_required).toBe(true);
      expect(res.body.data.authenticated).toBe(false);
    });

    it('with correct API key returns authenticated true', async () => {
      const res = await request(app)
        .get('/api/auth/check')
        .set('X-API-Key', 'test-secret-key');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.auth_required).toBe(true);
      expect(res.body.data.authenticated).toBe(true);
    });

    it('with wrong API key returns authenticated false', async () => {
      const res = await request(app)
        .get('/api/auth/check')
        .set('X-API-Key', 'wrong-key');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.auth_required).toBe(true);
      expect(res.body.data.authenticated).toBe(false);
    });
  });

  describe('API key protection on routes', () => {
    it('GET /api/products without API key returns 401', async () => {
      const res = await request(app).get('/api/products');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('GET /api/products with correct X-API-Key header succeeds', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('X-API-Key', 'test-secret-key');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
