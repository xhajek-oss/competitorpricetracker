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
}));

import request from 'supertest';
import { app } from '../../server/index';
import { createProduct } from '../../server/database/models/product';
import { addPriceRecord } from '../../server/database/models/priceHistory';

describe('Prices API routes', () => {
  describe('GET /api/products/:id/prices', () => {
    it('returns price history for a product', async () => {
      const product = createProduct({
        url: 'https://example.com/price-history',
        name: 'Price History Product',
        shop_type: 'generic',
      });

      addPriceRecord(product.id, 19.99, 'EUR');
      addPriceRecord(product.id, 24.99, 'EUR');
      addPriceRecord(product.id, 22.49, 'EUR');

      const res = await request(app).get(`/api/products/${product.id}/prices`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      const prices = res.body.data.map((r: { price: number }) => r.price);
      expect(prices).toContain(19.99);
      expect(prices).toContain(24.99);
      expect(prices).toContain(22.49);
      // All records belong to the correct product
      expect(
        res.body.data.every((r: { product_id: number }) => r.product_id === product.id)
      ).toBe(true);
    });

    it('returns 404 with non-existent product', async () => {
      const res = await request(app).get('/api/products/9999/prices');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });

    it('returns 400 with invalid id', async () => {
      const res = await request(app).get('/api/products/abc/prices');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid');
    });

    it('respects limit parameter', async () => {
      const product = createProduct({
        url: 'https://example.com/price-limit',
        name: 'Limit Product',
        shop_type: 'generic',
      });

      addPriceRecord(product.id, 10.00, 'EUR');
      addPriceRecord(product.id, 20.00, 'EUR');
      addPriceRecord(product.id, 30.00, 'EUR');
      addPriceRecord(product.id, 40.00, 'EUR');
      addPriceRecord(product.id, 50.00, 'EUR');

      const res = await request(app).get(`/api/products/${product.id}/prices?limit=2`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('returns 400 with invalid from date', async () => {
      const product = createProduct({
        url: 'https://example.com/price-from',
        name: 'From Product',
        shop_type: 'generic',
      });

      const res = await request(app).get(
        `/api/products/${product.id}/prices?from=not-a-date`
      );

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid date');
    });
  });

  describe('POST /api/products/:id/check', () => {
    it('triggers scrape and returns result', async () => {
      const product = createProduct({
        url: 'https://example.com/check-product',
        name: 'Check Product',
        shop_type: 'generic',
      });

      const res = await request(app).post(`/api/products/${product.id}/check`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.product).toBeDefined();
      expect(res.body.data.price_record).toBeDefined();
      expect(res.body.data.price_record.price).toBe(29.99);
      expect(res.body.data.price_record.currency).toBe('EUR');
      expect(typeof res.body.data.changed).toBe('boolean');
    });
  });
});
