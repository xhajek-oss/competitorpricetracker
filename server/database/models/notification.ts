import { getDb } from '../connection';
import type { Notification, NotificationStatus } from '../../../shared/types';

export function createNotification(data: {
  alert_id: number;
  product_id: number;
  message: string;
  status?: NotificationStatus;
}): Notification {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO notifications (alert_id, product_id, message, status)
     VALUES (@alert_id, @product_id, @message, @status)`
  ).run({
    alert_id: data.alert_id,
    product_id: data.product_id,
    message: data.message,
    status: data.status ?? 'pending',
  });
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(
    Number(result.lastInsertRowid)
  ) as Notification;
}

export function updateNotificationStatus(id: number, status: NotificationStatus): void {
  const db = getDb();
  db.prepare('UPDATE notifications SET status = ? WHERE id = ?').run(status, id);
}

export function getNotifications(limit?: number, productId?: number): Notification[] {
  const db = getDb();
  let sql = 'SELECT * FROM notifications';
  const params: Record<string, unknown> = {};

  if (productId !== undefined) {
    sql += ' WHERE product_id = @product_id';
    params.product_id = productId;
  }

  sql += ' ORDER BY sent_at DESC';

  if (limit) {
    sql += ' LIMIT @limit';
    params.limit = limit;
  }

  return db.prepare(sql).all(params) as Notification[];
}
