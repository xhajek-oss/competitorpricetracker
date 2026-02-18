import { vi } from 'vitest';

// Mock the scraper module BEFORE importing server code
vi.mock('../../server/scraper/index', () => ({
  scrapePrice: vi.fn().mockResolvedValue({
    success: true,
    price: 29.99,
    currency: 'EUR',
    productName: 'Test Product',
    error: null,
    shopType: 'generic',
  }),
  detectShopType: vi.fn().mockReturnValue('generic'),
  validateUrlSafety: vi.fn().mockResolvedValue({ safe: true }),
  closeBrowser: vi.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { app } from '../../server/index';
import { createProduct } from '../../server/database/models/product';
import { addPriceRecord } from '../../server/database/models/priceHistory';
import { createAlert } from '../../server/database/models/alert';
import { getDb } from '../../server/database/connection';

describe('Stats API routes', () => {
  describe('GET /api/stats', () => {
    it('returns stats with zero products', async () => {
      const res = await request(app).get('/api/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.total_products).toBe(0);
      expect(res.body.data.active_products).toBe(0);
      expect(res.body.data.total_alerts).toBe(0);
      expect(res.body.data.total_price_records).toBe(0);
      expect(res.body.data.recent_changes).toEqual([]);
      expect(res.body.data.avg_price_change_percent).toBe(0);
    });

    it('returns correct product and alert counts after creating data', async () => {
      // Create two products
      const product1 = createProduct({
        url: 'https://example.com/stats-p1',
        name: 'Stats Product 1',
        shop_type: 'generic',
      });
      const product2 = createProduct({
        url: 'https://example.com/stats-p2',
        name: 'Stats Product 2',
        shop_type: 'generic',
      });

      // Add price records
      addPriceRecord(product1.id, 10.00, 'EUR');
      addPriceRecord(product2.id, 20.00, 'EUR');
      addPriceRecord(product2.id, 25.00, 'EUR');

      // Create alerts
      createAlert({
        product_id: product1.id,
        alert_type: 'price_change_any',
        notification_method: 'email',
      });
      createAlert({
        product_id: product2.id,
        alert_type: 'price_drop_percent',
        threshold_percent: 10,
        notification_method: 'telegram',
      });

      const res = await request(app).get('/api/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_products).toBe(2);
      expect(res.body.data.active_products).toBe(2);
      expect(res.body.data.total_alerts).toBe(2);
      expect(res.body.data.total_price_records).toBe(3);
    });

    it('returns recent_changes when prices change', async () => {
      // Create a product and add two price records with different prices
      const product = createProduct({
        url: 'https://example.com/stats-change',
        name: 'Price Change Product',
        shop_type: 'generic',
      });

      // Insert price records with explicit timestamps to ensure deterministic ordering
      const db = getDb();
      db.prepare(
        `INSERT INTO price_history (product_id, price, currency, checked_at) VALUES (?, ?, ?, ?)`
      ).run(product.id, 100.00, 'EUR', '2025-01-01T10:00:00Z');
      db.prepare(
        `INSERT INTO price_history (product_id, price, currency, checked_at) VALUES (?, ?, ?, ?)`
      ).run(product.id, 80.00, 'EUR', '2025-01-01T11:00:00Z');

      const res = await request(app).get('/api/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recent_changes).toHaveLength(1);

      const change = res.body.data.recent_changes[0];
      expect(change.product_id).toBe(product.id);
      expect(change.product_name).toBe('Price Change Product');
      expect(change.old_price).toBe(100.00);
      expect(change.new_price).toBe(80.00);
      expect(change.direction).toBe('down');
      expect(change.change_percent).toBe(20);
      expect(res.body.data.avg_price_change_percent).toBe(20);
    });
  });
});
