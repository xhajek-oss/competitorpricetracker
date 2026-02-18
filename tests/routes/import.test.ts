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
import { CONFIG } from '../../shared/config';

describe('Import API routes', () => {
  describe('POST /api/products/import', () => {
    it('imports products from CSV string', async () => {
      const csv = [
        'https://example.com/import-p1,Product 1,24',
        'https://example.com/import-p2,Product 2,12',
      ].join('\n');

      const res = await request(app)
        .post('/api/products/import')
        .send({ csv });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(2);
      expect(res.body.data.failed).toBe(0);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.details).toHaveLength(2);
      expect(res.body.data.details[0].success).toBe(true);
      expect(res.body.data.details[1].success).toBe(true);
    });

    it('handles header row', async () => {
      const csv = [
        'url,name,interval',
        'https://example.com/import-header,Header Product,24',
      ].join('\n');

      const res = await request(app)
        .post('/api/products/import')
        .send({ csv });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(1);
      expect(res.body.data.failed).toBe(0);
      expect(res.body.data.total).toBe(1);
    });

    it('rejects invalid URLs', async () => {
      const csv = [
        'not-a-valid-link,Bad Product,24',
        'https://example.com/import-valid,Valid Product,24',
      ].join('\n');

      const res = await request(app)
        .post('/api/products/import')
        .send({ csv });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(1);
      expect(res.body.data.failed).toBe(1);
      expect(res.body.data.details[0].success).toBe(false);
      expect(res.body.data.details[0].error).toContain('Invalid URL');
      expect(res.body.data.details[1].success).toBe(true);
    });

    it('respects MAX_PRODUCTS limit', async () => {
      // Fill up to max by creating products directly
      const maxProducts = CONFIG.MAX_PRODUCTS;
      for (let i = 0; i < maxProducts; i++) {
        createProduct({
          url: `https://example.com/fill-${i}`,
          name: `Fill Product ${i}`,
          shop_type: 'generic',
        });
      }

      const csv = 'https://example.com/over-limit,Over Limit,24';

      const res = await request(app)
        .post('/api/products/import')
        .send({ csv });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('import');
    });

    it('returns 400 when csv field is missing', async () => {
      const res = await request(app)
        .post('/api/products/import')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('CSV');
    });
  });
});
