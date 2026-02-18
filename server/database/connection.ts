import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { migrate } from './migrations/001_initial';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'tracker.db');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);

  dbInstance = db;
  return db;
}

/** Inject an in-memory DB for testing. */
export function setTestDb(db: Database.Database): void {
  dbInstance = db;
}

/** Clear the current DB instance (for test teardown). */
export function resetDb(): void {
  dbInstance = null;
}
