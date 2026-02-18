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
import { createNotification } from '../../server/database/models/notification';

describe('Notifications API routes', () => {
  describe('GET /api/notifications', () => {
    it('returns empty array initially', async () => {
      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns notifications after creating some', async () => {
      const product = createProduct({
        url: 'https://example.com/notif-product',
        name: 'Notif Product',
        shop_type: 'generic',
      });
      const alert = createAlert({
        product_id: product.id,
        alert_type: 'price_change_any',
      });

      createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'Price changed from 20 to 15 EUR',
        status: 'sent',
      });
      createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'Price changed from 15 to 12 EUR',
        status: 'sent',
      });

      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].message).toBeTypeOf('string');
      expect(res.body.data[0].product_id).toBe(product.id);
    });

    it('filters by product_id', async () => {
      const product1 = createProduct({
        url: 'https://example.com/notif-p1',
        name: 'Notif P1',
        shop_type: 'generic',
      });
      const product2 = createProduct({
        url: 'https://example.com/notif-p2',
        name: 'Notif P2',
        shop_type: 'generic',
      });
      const alert1 = createAlert({
        product_id: product1.id,
        alert_type: 'price_change_any',
      });
      const alert2 = createAlert({
        product_id: product2.id,
        alert_type: 'price_change_any',
      });

      createNotification({
        alert_id: alert1.id,
        product_id: product1.id,
        message: 'Notification for product 1',
      });
      createNotification({
        alert_id: alert2.id,
        product_id: product2.id,
        message: 'Notification for product 2',
      });
      createNotification({
        alert_id: alert1.id,
        product_id: product1.id,
        message: 'Another notification for product 1',
      });

      const res = await request(app).get(`/api/notifications?product_id=${product1.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(
        res.body.data.every((n: { product_id: number }) => n.product_id === product1.id)
      ).toBe(true);
    });

    it('respects limit parameter', async () => {
      const product = createProduct({
        url: 'https://example.com/notif-limit',
        name: 'Notif Limit',
        shop_type: 'generic',
      });
      const alert = createAlert({
        product_id: product.id,
        alert_type: 'price_change_any',
      });

      createNotification({ alert_id: alert.id, product_id: product.id, message: 'Msg 1' });
      createNotification({ alert_id: alert.id, product_id: product.id, message: 'Msg 2' });
      createNotification({ alert_id: alert.id, product_id: product.id, message: 'Msg 3' });
      createNotification({ alert_id: alert.id, product_id: product.id, message: 'Msg 4' });
      createNotification({ alert_id: alert.id, product_id: product.id, message: 'Msg 5' });

      const res = await request(app).get('/api/notifications?limit=3');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });
  });
});
