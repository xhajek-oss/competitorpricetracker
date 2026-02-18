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
import { createAlert } from '../../server/database/models/alert';

/** Helper to create a product for alert tests */
function seedProduct(name = 'Alert Test Product') {
  return createProduct({
    url: `https://example.com/${name.replace(/\s+/g, '-').toLowerCase()}`,
    name,
    shop_type: 'generic',
  });
}

describe('Alerts API routes', () => {
  describe('GET /api/alerts', () => {
    it('returns empty array initially', async () => {
      const res = await request(app).get('/api/alerts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns alerts filtered by product_id', async () => {
      const product1 = seedProduct('Product One');
      const product2 = seedProduct('Product Two');

      createAlert({ product_id: product1.id, alert_type: 'price_change_any' });
      createAlert({ product_id: product1.id, alert_type: 'price_below', threshold_price: 10 });
      createAlert({ product_id: product2.id, alert_type: 'price_change_any' });

      const res = await request(app).get(`/api/alerts?product_id=${product1.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((a: { product_id: number }) => a.product_id === product1.id)).toBe(true);
    });
  });

  describe('POST /api/alerts', () => {
    it('creates alert (201)', async () => {
      const product = seedProduct();

      const res = await request(app)
        .post('/api/alerts')
        .send({
          product_id: product.id,
          alert_type: 'price_change_any',
          notification_method: 'email',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product_id).toBe(product.id);
      expect(res.body.data.alert_type).toBe('price_change_any');
      expect(res.body.data.notification_method).toBe('email');
      expect(res.body.data.is_active).toBe(true);
    });

    it('returns 400 without product_id', async () => {
      const res = await request(app)
        .post('/api/alerts')
        .send({ alert_type: 'price_change_any' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 with non-existent product', async () => {
      const res = await request(app)
        .post('/api/alerts')
        .send({ product_id: 9999, alert_type: 'price_change_any' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Product not found');
    });

    it('returns 400 with invalid alert_type', async () => {
      const product = seedProduct();

      const res = await request(app)
        .post('/api/alerts')
        .send({ product_id: product.id, alert_type: 'invalid_type' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('alert_type');
    });
  });

  describe('PUT /api/alerts/:id', () => {
    it('updates alert', async () => {
      const product = seedProduct();
      const alert = createAlert({
        product_id: product.id,
        alert_type: 'price_change_any',
        notification_method: 'email',
      });

      const res = await request(app)
        .put(`/api/alerts/${alert.id}`)
        .send({
          alert_type: 'price_drop_percent',
          threshold_percent: 10,
          notification_method: 'telegram',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert_type).toBe('price_drop_percent');
      expect(res.body.data.threshold_percent).toBe(10);
      expect(res.body.data.notification_method).toBe('telegram');
    });

    it('returns 400 with invalid alert_type', async () => {
      const product = seedProduct();
      const alert = createAlert({
        product_id: product.id,
        alert_type: 'price_change_any',
      });

      const res = await request(app)
        .put(`/api/alerts/${alert.id}`)
        .send({ alert_type: 'invalid_type' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 with non-existent id', async () => {
      const res = await request(app)
        .put('/api/alerts/9999')
        .send({ alert_type: 'price_change_any' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/alerts/:id', () => {
    it('deletes alert', async () => {
      const product = seedProduct();
      const alert = createAlert({
        product_id: product.id,
        alert_type: 'price_change_any',
      });

      const res = await request(app).delete(`/api/alerts/${alert.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);
    });

    it('returns 404 with non-existent id', async () => {
      const res = await request(app).delete('/api/alerts/9999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
