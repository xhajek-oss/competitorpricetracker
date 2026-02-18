import Database from 'better-sqlite3';

export function migrate(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const migrationName = '001_initial';
  const existing = db.prepare('SELECT id FROM migrations WHERE name = ?').get(migrationName);
  if (existing) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      name TEXT,
      current_price REAL,
      currency TEXT DEFAULT 'EUR',
      shop_type TEXT NOT NULL,
      check_interval INTEGER DEFAULT 24,
      is_active INTEGER DEFAULT 1,
      last_checked_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'EUR',
      checked_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      alert_type TEXT NOT NULL,
      threshold_percent REAL,
      threshold_price REAL,
      notification_method TEXT DEFAULT 'email',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER NOT NULL REFERENCES alerts(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      sent_at TEXT DEFAULT (datetime('now')),
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_product_id ON alerts(product_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_product_id ON notifications(product_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_alert_id ON notifications(alert_id);
  `);

  db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationName);
}
