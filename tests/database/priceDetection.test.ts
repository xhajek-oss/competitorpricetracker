import { detectPriceChange, evaluateAlerts } from '../../server/database/priceDetection';
import { createProduct, updateProduct } from '../../server/database/models/product';
import { createAlert } from '../../server/database/models/alert';
import type { PriceChange } from '../../shared/types';

describe('Price Detection', () => {
  describe('detectPriceChange', () => {
    it('returns null for non-existent product', () => {
      const result = detectPriceChange(9999, 50);
      expect(result).toBeNull();
    });

    it('returns null when current_price is null', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      // current_price defaults to null
      const result = detectPriceChange(product.id, 50);
      expect(result).toBeNull();
    });

    it('returns null when price is unchanged', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      updateProduct(product.id, { current_price: 100 });

      const result = detectPriceChange(product.id, 100);
      expect(result).toBeNull();
    });

    it('returns PriceChange with direction=up when price increases', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      updateProduct(product.id, { current_price: 100 });

      const result = detectPriceChange(product.id, 150);
      expect(result).not.toBeNull();
      expect(result!.direction).toBe('up');
      expect(result!.oldPrice).toBe(100);
      expect(result!.newPrice).toBe(150);
      expect(result!.product.id).toBe(product.id);
    });

    it('returns PriceChange with direction=down when price decreases', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      updateProduct(product.id, { current_price: 100 });

      const result = detectPriceChange(product.id, 75);
      expect(result).not.toBeNull();
      expect(result!.direction).toBe('down');
      expect(result!.oldPrice).toBe(100);
      expect(result!.newPrice).toBe(75);
    });

    it('calculates changePercent correctly (100 to 80 = 20%)', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      updateProduct(product.id, { current_price: 100 });

      const result = detectPriceChange(product.id, 80);
      expect(result).not.toBeNull();
      expect(result!.changePercent).toBeCloseTo(20, 5);
      expect(result!.direction).toBe('down');
    });
  });

  describe('evaluateAlerts', () => {
    it('price_change_any triggers on any change', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      updateProduct(product.id, { current_price: 100 });
      createAlert({ product_id: product.id, alert_type: 'price_change_any' });

      const change: PriceChange = {
        product: { ...product, current_price: 100 },
        oldPrice: 100,
        newPrice: 110,
        changePercent: 10,
        direction: 'up',
      };

      const triggered = evaluateAlerts(change);
      expect(triggered).toHaveLength(1);
      expect(triggered[0].alert_type).toBe('price_change_any');
    });

    it('price_drop_percent triggers when drop exceeds threshold', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      updateProduct(product.id, { current_price: 100 });
      createAlert({
        product_id: product.id,
        alert_type: 'price_drop_percent',
        threshold_percent: 10,
      });

      const change: PriceChange = {
        product: { ...product, current_price: 100 },
        oldPrice: 100,
        newPrice: 85,
        changePercent: 15,
        direction: 'down',
      };

      const triggered = evaluateAlerts(change);
      expect(triggered).toHaveLength(1);
      expect(triggered[0].alert_type).toBe('price_drop_percent');
    });

    it('price_drop_percent does NOT trigger on price increase', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      updateProduct(product.id, { current_price: 100 });
      createAlert({
        product_id: product.id,
        alert_type: 'price_drop_percent',
        threshold_percent: 10,
      });

      const change: PriceChange = {
        product: { ...product, current_price: 100 },
        oldPrice: 100,
        newPrice: 120,
        changePercent: 20,
        direction: 'up',
      };

      const triggered = evaluateAlerts(change);
      expect(triggered).toHaveLength(0);
    });

    it('price_drop_percent does NOT trigger when drop is below threshold', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      updateProduct(product.id, { current_price: 100 });
      createAlert({
        product_id: product.id,
        alert_type: 'price_drop_percent',
        threshold_percent: 20,
      });

      const change: PriceChange = {
        product: { ...product, current_price: 100 },
        oldPrice: 100,
        newPrice: 90,
        changePercent: 10,
        direction: 'down',
      };

      const triggered = evaluateAlerts(change);
      expect(triggered).toHaveLength(0);
    });

    it('price_below triggers when new price is below threshold', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      updateProduct(product.id, { current_price: 100 });
      createAlert({
        product_id: product.id,
        alert_type: 'price_below',
        threshold_price: 90,
      });

      const change: PriceChange = {
        product: { ...product, current_price: 100 },
        oldPrice: 100,
        newPrice: 80,
        changePercent: 20,
        direction: 'down',
      };

      const triggered = evaluateAlerts(change);
      expect(triggered).toHaveLength(1);
      expect(triggered[0].alert_type).toBe('price_below');
    });

    it('price_below does NOT trigger when price is above threshold', () => {
      const product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
      updateProduct(product.id, { current_price: 100 });
      createAlert({
        product_id: product.id,
        alert_type: 'price_below',
        threshold_price: 50,
      });

      const change: PriceChange = {
        product: { ...product, current_price: 100 },
        oldPrice: 100,
        newPrice: 80,
        changePercent: 20,
        direction: 'down',
      };

      const triggered = evaluateAlerts(change);
      expect(triggered).toHaveLength(0);
    });
  });
});
