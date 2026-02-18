import {
  getAlerts,
  getAlertById,
  createAlert,
  updateAlert,
  deleteAlert,
  getActiveAlertsForProduct,
} from '../../server/database/models/alert';
import { createProduct } from '../../server/database/models/product';
import type { Product } from '../../shared/types';

describe('Alert model', () => {
  let product: Product;

  beforeEach(() => {
    product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
  });

  describe('createAlert', () => {
    it('applies defaults (notification_method=email, is_active=true)', () => {
      const alert = createAlert({
        product_id: product.id,
        alert_type: 'price_change_any',
      });

      expect(alert).toBeDefined();
      expect(alert.id).toBeTypeOf('number');
      expect(alert.product_id).toBe(product.id);
      expect(alert.alert_type).toBe('price_change_any');
      expect(alert.notification_method).toBe('email');
      expect(alert.is_active).toBe(true);
      expect(alert.threshold_percent).toBeNull();
      expect(alert.threshold_price).toBeNull();
      expect(alert.created_at).toBeTypeOf('string');
    });

    it('creates alert with all fields specified', () => {
      const alert = createAlert({
        product_id: product.id,
        alert_type: 'price_drop_percent',
        threshold_percent: 15,
        threshold_price: 50.0,
        notification_method: 'telegram',
      });

      expect(alert.alert_type).toBe('price_drop_percent');
      expect(alert.threshold_percent).toBe(15);
      expect(alert.threshold_price).toBe(50.0);
      expect(alert.notification_method).toBe('telegram');
    });
  });

  describe('getAlerts', () => {
    it('returns all alerts when no productId filter', () => {
      const product2 = createProduct({ url: 'https://example.com/p2', shop_type: 'ebay' });
      createAlert({ product_id: product.id, alert_type: 'price_change_any' });
      createAlert({ product_id: product2.id, alert_type: 'price_below', threshold_price: 20 });

      const alerts = getAlerts();
      expect(alerts).toHaveLength(2);
    });

    it('returns alerts filtered by product_id', () => {
      const product2 = createProduct({ url: 'https://example.com/p2', shop_type: 'ebay' });
      createAlert({ product_id: product.id, alert_type: 'price_change_any' });
      createAlert({ product_id: product.id, alert_type: 'price_below', threshold_price: 10 });
      createAlert({ product_id: product2.id, alert_type: 'price_change_any' });

      const alerts = getAlerts(product.id);
      expect(alerts).toHaveLength(2);
      expect(alerts.every((a) => a.product_id === product.id)).toBe(true);
    });
  });

  describe('getAlertById', () => {
    it('returns the correct alert', () => {
      const created = createAlert({
        product_id: product.id,
        alert_type: 'price_drop_percent',
        threshold_percent: 10,
      });

      const found = getAlertById(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.alert_type).toBe('price_drop_percent');
      expect(found!.threshold_percent).toBe(10);
    });

    it('returns undefined for non-existent id', () => {
      const result = getAlertById(9999);
      expect(result).toBeUndefined();
    });
  });

  describe('updateAlert', () => {
    it('changes alert_type', () => {
      const alert = createAlert({
        product_id: product.id,
        alert_type: 'price_change_any',
      });

      const updated = updateAlert(alert.id, { alert_type: 'price_below' });
      expect(updated).toBeDefined();
      expect(updated!.alert_type).toBe('price_below');
    });

    it('toggles is_active', () => {
      const alert = createAlert({
        product_id: product.id,
        alert_type: 'price_change_any',
      });
      expect(alert.is_active).toBe(true);

      const deactivated = updateAlert(alert.id, { is_active: false });
      expect(deactivated!.is_active).toBe(false);

      const reactivated = updateAlert(alert.id, { is_active: true });
      expect(reactivated!.is_active).toBe(true);
    });

    it('returns undefined for non-existent id', () => {
      const result = updateAlert(9999, { alert_type: 'price_below' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteAlert', () => {
    it('removes alert and returns true', () => {
      const alert = createAlert({
        product_id: product.id,
        alert_type: 'price_change_any',
      });

      const deleted = deleteAlert(alert.id);
      expect(deleted).toBe(true);

      const found = getAlertById(alert.id);
      expect(found).toBeUndefined();
    });

    it('returns false for non-existent id', () => {
      const result = deleteAlert(9999);
      expect(result).toBe(false);
    });
  });

  describe('getActiveAlertsForProduct', () => {
    it('only returns active alerts for the given product', () => {
      createAlert({ product_id: product.id, alert_type: 'price_change_any' });
      const inactiveAlert = createAlert({
        product_id: product.id,
        alert_type: 'price_below',
        threshold_price: 30,
      });
      updateAlert(inactiveAlert.id, { is_active: false });

      // Alert on a different product (should not appear)
      const product2 = createProduct({ url: 'https://example.com/p2', shop_type: 'ebay' });
      createAlert({ product_id: product2.id, alert_type: 'price_change_any' });

      const active = getActiveAlertsForProduct(product.id);
      expect(active).toHaveLength(1);
      expect(active[0].is_active).toBe(true);
      expect(active[0].product_id).toBe(product.id);
    });
  });
});
