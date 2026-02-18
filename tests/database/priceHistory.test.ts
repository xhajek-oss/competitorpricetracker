import {
  addPriceRecord,
  getPriceHistory,
  getLatestPrice,
} from '../../server/database/models/priceHistory';
import { createProduct } from '../../server/database/models/product';
import { getDb } from '../../server/database/connection';
import type { Product } from '../../shared/types';

/** Insert a price record with an explicit checked_at timestamp. */
function addPriceRecordAt(productId: number, price: number, currency: string, checkedAt: string) {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO price_history (product_id, price, currency, checked_at)
     VALUES (@product_id, @price, @currency, @checked_at)`
  ).run({ product_id: productId, price, currency, checked_at: checkedAt });
  return db.prepare('SELECT * FROM price_history WHERE id = ?').get(Number(result.lastInsertRowid));
}

describe('PriceHistory model', () => {
  let product: Product;

  beforeEach(() => {
    product = createProduct({ url: 'https://example.com/p1', shop_type: 'generic' });
  });

  describe('addPriceRecord', () => {
    it('creates record with correct fields', () => {
      const record = addPriceRecord(product.id, 29.99, 'EUR');

      expect(record).toBeDefined();
      expect(record.id).toBeTypeOf('number');
      expect(record.product_id).toBe(product.id);
      expect(record.price).toBe(29.99);
      expect(record.currency).toBe('EUR');
      expect(record.checked_at).toBeTypeOf('string');
    });
  });

  describe('getPriceHistory', () => {
    it('returns records in DESC order by checked_at', () => {
      addPriceRecordAt(product.id, 10.0, 'EUR', '2026-01-01 10:00:00');
      addPriceRecordAt(product.id, 20.0, 'EUR', '2026-01-02 10:00:00');
      addPriceRecordAt(product.id, 30.0, 'EUR', '2026-01-03 10:00:00');

      const history = getPriceHistory(product.id);
      expect(history).toHaveLength(3);
      // Most recent first (DESC)
      expect(history[0].price).toBe(30.0);
      expect(history[2].price).toBe(10.0);
    });

    it('respects limit parameter', () => {
      addPriceRecordAt(product.id, 10.0, 'EUR', '2026-01-01 10:00:00');
      addPriceRecordAt(product.id, 20.0, 'EUR', '2026-01-02 10:00:00');
      addPriceRecordAt(product.id, 30.0, 'EUR', '2026-01-03 10:00:00');

      const history = getPriceHistory(product.id, 2);
      expect(history).toHaveLength(2);
    });

    it('filters by from date', () => {
      addPriceRecord(product.id, 10.0, 'EUR');
      addPriceRecord(product.id, 20.0, 'EUR');

      // Use a future date to exclude all existing records
      const futureDate = '2099-01-01T00:00:00.000Z';
      const history = getPriceHistory(product.id, undefined, futureDate);
      expect(history).toHaveLength(0);

      // Use a past date to include all records
      const pastDate = '2000-01-01T00:00:00.000Z';
      const historyAll = getPriceHistory(product.id, undefined, pastDate);
      expect(historyAll).toHaveLength(2);
    });
  });

  describe('getLatestPrice', () => {
    it('returns the most recent record', () => {
      addPriceRecordAt(product.id, 10.0, 'EUR', '2026-01-01 10:00:00');
      addPriceRecordAt(product.id, 20.0, 'EUR', '2026-01-02 10:00:00');
      addPriceRecordAt(product.id, 55.5, 'USD', '2026-01-03 10:00:00');

      const latest = getLatestPrice(product.id);
      expect(latest).toBeDefined();
      expect(latest!.price).toBe(55.5);
      expect(latest!.currency).toBe('USD');
    });

    it('returns undefined when no records exist', () => {
      const latest = getLatestPrice(product.id);
      expect(latest).toBeUndefined();
    });
  });
});
