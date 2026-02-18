import Database from 'better-sqlite3';
import { beforeEach, afterAll } from 'vitest';
import { setTestDb, resetDb } from '../server/database/connection';
import { migrate } from '../server/database/migrations/001_initial';

let db: Database.Database;

beforeEach(() => {
  // Fresh in-memory DB for every test
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db);
  setTestDb(db);
});

afterAll(() => {
  resetDb();
});
