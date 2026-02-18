import {
  createNotification,
  updateNotificationStatus,
  getNotifications,
} from '../../server/database/models/notification';
import { createProduct } from '../../server/database/models/product';
import { createAlert } from '../../server/database/models/alert';
import type { Product, Alert } from '../../shared/types';

describe('Notification model', () => {
  let product: Product;
  let alert: Alert;

  beforeEach(() => {
    product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
    alert = createAlert({ product_id: product.id, alert_type: 'price_change_any' });
  });

  describe('createNotification', () => {
    it('creates notification with default status (pending)', () => {
      const notification = createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'Price changed!',
      });

      expect(notification).toBeDefined();
      expect(notification.id).toBeTypeOf('number');
      expect(notification.alert_id).toBe(alert.id);
      expect(notification.product_id).toBe(product.id);
      expect(notification.message).toBe('Price changed!');
      expect(notification.status).toBe('pending');
      expect(notification.sent_at).toBeTypeOf('string');
    });

    it('creates notification with explicit status', () => {
      const notification = createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'Already sent',
        status: 'sent',
      });

      expect(notification.status).toBe('sent');
    });
  });

  describe('updateNotificationStatus', () => {
    it('changes the notification status', () => {
      const notification = createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'Pending notification',
      });
      expect(notification.status).toBe('pending');

      updateNotificationStatus(notification.id, 'sent');

      const all = getNotifications();
      const updated = all.find((n) => n.id === notification.id);
      expect(updated).toBeDefined();
      expect(updated!.status).toBe('sent');
    });
  });

  describe('getNotifications', () => {
    it('returns all notifications', () => {
      createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'Notification 1',
      });
      createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'Notification 2',
      });

      const notifications = getNotifications();
      expect(notifications).toHaveLength(2);
    });

    it('filters by product_id', () => {
      const product2 = createProduct({ url: 'https://example.com/p2', shop_type: 'ebay' });
      const alert2 = createAlert({ product_id: product2.id, alert_type: 'price_change_any' });

      createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'For product 1',
      });
      createNotification({
        alert_id: alert2.id,
        product_id: product2.id,
        message: 'For product 2',
      });

      const filtered = getNotifications(undefined, product.id);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].product_id).toBe(product.id);
    });

    it('respects limit parameter', () => {
      createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'Notification 1',
      });
      createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'Notification 2',
      });
      createNotification({
        alert_id: alert.id,
        product_id: product.id,
        message: 'Notification 3',
      });

      const limited = getNotifications(2);
      expect(limited).toHaveLength(2);
    });
  });
});
