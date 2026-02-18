import { getDb } from '../connection';
import type { PriceRecord } from '../../../shared/types';

export function addPriceRecord(productId: number, price: number, currency: string): PriceRecord {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO price_history (product_id, price, currency)
     VALUES (@product_id, @price, @currency)`
  ).run({
    product_id: productId,
    price,
    currency,
  });
  return db.prepare('SELECT * FROM price_history WHERE id = ?').get(
    Number(result.lastInsertRowid)
  ) as PriceRecord;
}

export function getPriceHistory(
  productId: number,
  limit?: number,
  from?: string
): PriceRecord[] {
  const db = getDb();
  let sql = 'SELECT * FROM price_history WHERE product_id = @product_id';
  const params: Record<string, unknown> = { product_id: productId };

  if (from) {
    sql += ' AND checked_at >= @from';
    params.from = from;
  }

  sql += ' ORDER BY checked_at DESC';

  if (limit) {
    sql += ' LIMIT @limit';
    params.limit = limit;
  }

  return db.prepare(sql).all(params) as PriceRecord[];
}

export function getLatestPrice(productId: number): PriceRecord | undefined {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM price_history WHERE product_id = ? ORDER BY checked_at DESC LIMIT 1'
  ).get(productId) as PriceRecord | undefined;
}
