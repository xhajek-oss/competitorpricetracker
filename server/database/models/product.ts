import { getDb } from '../connection';
import type { Product, ShopType, CheckInterval } from '../../../shared/types';

interface ProductRow {
  id: number;
  url: string;
  name: string | null;
  current_price: number | null;
  currency: string;
  shop_type: string;
  check_interval: number;
  is_active: number;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProduct(row: ProductRow): Product {
  return {
    ...row,
    name: row.name ?? '',
    shop_type: row.shop_type as ShopType,
    check_interval: row.check_interval as CheckInterval,
    is_active: row.is_active === 1,
  };
}

export function getAllProducts(): Product[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all() as ProductRow[];
  return rows.map(rowToProduct);
}

export function getProductById(id: number): Product | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  return row ? rowToProduct(row) : undefined;
}

export function createProduct(data: {
  url: string;
  name?: string;
  shop_type: ShopType;
  check_interval?: CheckInterval;
}): Product {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO products (url, name, shop_type, check_interval)
     VALUES (@url, @name, @shop_type, @check_interval)`
  );
  const result = stmt.run({
    url: data.url,
    name: data.name ?? null,
    shop_type: data.shop_type,
    check_interval: data.check_interval ?? 24,
  });
  return getProductById(Number(result.lastInsertRowid))!;
}

export function updateProduct(
  id: number,
  data: Partial<Pick<Product, 'name' | 'check_interval' | 'is_active' | 'current_price' | 'last_checked_at'>>
): Product | undefined {
  const db = getDb();
  const existing = getProductById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  if (data.name !== undefined) {
    fields.push('name = @name');
    values.name = data.name;
  }
  if (data.check_interval !== undefined) {
    fields.push('check_interval = @check_interval');
    values.check_interval = data.check_interval;
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = @is_active');
    values.is_active = data.is_active ? 1 : 0;
  }
  if (data.current_price !== undefined) {
    fields.push('current_price = @current_price');
    values.current_price = data.current_price;
  }
  if (data.last_checked_at !== undefined) {
    fields.push('last_checked_at = @last_checked_at');
    values.last_checked_at = data.last_checked_at;
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = @id`).run(values);
  return getProductById(id);
}

export function deleteProduct(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getProductsDueForCheck(): Product[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM products
     WHERE is_active = 1
       AND (last_checked_at IS NULL
            OR datetime(last_checked_at, '+' || check_interval || ' hours') <= datetime('now'))
     ORDER BY last_checked_at ASC NULLS FIRST`
  ).all() as ProductRow[];
  return rows.map(rowToProduct);
}
