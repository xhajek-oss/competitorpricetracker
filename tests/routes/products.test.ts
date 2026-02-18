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

describe('Products API routes', () => {
  describe('GET /api/products', () => {
    it('returns empty array initially', async () => {
      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/products', () => {
    it('creates product with valid URL (201)', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({ url: 'https://example.com/product-1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.url).toBe('https://example.com/product-1');
      expect(res.body.data.id).toBeTypeOf('number');
      expect(res.body.data.is_active).toBe(true);
    });

    it('returns 400 without URL', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 with invalid URL', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({ url: 'not-a-valid-url' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 with invalid check_interval', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({ url: 'https://example.com/product-1', check_interval: 3 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('check_interval');
    });
  });

  describe('GET /api/products/:id', () => {
    it('returns product by id', async () => {
      const product = createProduct({
        url: 'https://example.com/product-get',
        name: 'Get Test',
        shop_type: 'generic',
      });

      const res = await request(app).get(`/api/products/${product.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(product.id);
      expect(res.body.data.name).toBe('Get Test');
    });

    it('returns 404 with non-existent id', async () => {
      const res = await request(app).get('/api/products/9999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });

    it('returns 400 with invalid id', async () => {
      const res = await request(app).get('/api/products/abc');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('PUT /api/products/:id', () => {
    it('updates product name', async () => {
      const product = createProduct({
        url: 'https://example.com/product-update',
        name: 'Old Name',
        shop_type: 'generic',
      });

      const res = await request(app)
        .put(`/api/products/${product.id}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Name');
    });

    it('returns 404 with non-existent id', async () => {
      const res = await request(app)
        .put('/api/products/9999')
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('deletes product', async () => {
      const product = createProduct({
        url: 'https://example.com/product-delete',
        name: 'Delete Me',
        shop_type: 'generic',
      });

      const res = await request(app).delete(`/api/products/${product.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);

      // Verify it's gone
      const getRes = await request(app).get(`/api/products/${product.id}`);
      expect(getRes.status).toBe(404);
    });

    it('returns 404 with non-existent id', async () => {
      const res = await request(app).delete('/api/products/9999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
