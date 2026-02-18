import { getDb } from '../connection';
import type { Alert, AlertType, NotificationMethod } from '../../../shared/types';

interface AlertRow {
  id: number;
  product_id: number;
  alert_type: string;
  threshold_percent: number | null;
  threshold_price: number | null;
  notification_method: string;
  is_active: number;
  created_at: string;
}

function rowToAlert(row: AlertRow): Alert {
  return {
    ...row,
    alert_type: row.alert_type as AlertType,
    notification_method: row.notification_method as NotificationMethod,
    is_active: row.is_active === 1,
  };
}

export function getAlerts(productId?: number): Alert[] {
  const db = getDb();
  if (productId !== undefined) {
    const rows = db.prepare(
      'SELECT * FROM alerts WHERE product_id = ? ORDER BY created_at DESC'
    ).all(productId) as AlertRow[];
    return rows.map(rowToAlert);
  }
  const rows = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC').all() as AlertRow[];
  return rows.map(rowToAlert);
}

export function getAlertById(id: number): Alert | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as AlertRow | undefined;
  return row ? rowToAlert(row) : undefined;
}

export function createAlert(data: {
  product_id: number;
  alert_type: AlertType;
  threshold_percent?: number;
  threshold_price?: number;
  notification_method?: NotificationMethod;
}): Alert {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO alerts (product_id, alert_type, threshold_percent, threshold_price, notification_method)
     VALUES (@product_id, @alert_type, @threshold_percent, @threshold_price, @notification_method)`
  ).run({
    product_id: data.product_id,
    alert_type: data.alert_type,
    threshold_percent: data.threshold_percent ?? null,
    threshold_price: data.threshold_price ?? null,
    notification_method: data.notification_method ?? 'email',
  });
  return getAlertById(Number(result.lastInsertRowid))!;
}

export function updateAlert(
  id: number,
  data: Partial<Pick<Alert, 'alert_type' | 'threshold_percent' | 'threshold_price' | 'notification_method' | 'is_active'>>
): Alert | undefined {
  const db = getDb();
  const existing = getAlertById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  if (data.alert_type !== undefined) {
    fields.push('alert_type = @alert_type');
    values.alert_type = data.alert_type;
  }
  if (data.threshold_percent !== undefined) {
    fields.push('threshold_percent = @threshold_percent');
    values.threshold_percent = data.threshold_percent;
  }
  if (data.threshold_price !== undefined) {
    fields.push('threshold_price = @threshold_price');
    values.threshold_price = data.threshold_price;
  }
  if (data.notification_method !== undefined) {
    fields.push('notification_method = @notification_method');
    values.notification_method = data.notification_method;
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = @is_active');
    values.is_active = data.is_active ? 1 : 0;
  }

  if (fields.length === 0) return existing;

  db.prepare(`UPDATE alerts SET ${fields.join(', ')} WHERE id = @id`).run(values);
  return getAlertById(id);
}

export function deleteAlert(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getActiveAlertsForProduct(productId: number): Alert[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM alerts WHERE product_id = ? AND is_active = 1 ORDER BY created_at DESC'
  ).all(productId) as AlertRow[];
  return rows.map(rowToAlert);
}
