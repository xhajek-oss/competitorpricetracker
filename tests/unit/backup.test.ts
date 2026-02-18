import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Use vi.hoisted to make variables available to hoisted vi.mock calls
const { testDir, testDbPath } = vi.hoisted(() => {
  const _path = require('path');
  const testDir = _path.join(__dirname, '..', '..', 'data', 'test-backups-' + Date.now());
  const testDbPath = _path.join(testDir, 'test.db');
  return { testDir, testDbPath };
});

// Mock logger
vi.mock('../../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock CONFIG
vi.mock('../../shared/config', () => ({
  CONFIG: {
    DB_PATH: testDbPath,
  },
}));

import { createBackup } from '../../server/backup';

describe('backup', () => {
  beforeEach(() => {
    // Create test directory and a fake DB file
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testDbPath, 'fake-database-content');
  });

  afterEach(() => {
    // Clean up
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('creates a backup file', () => {
    const result = createBackup();
    expect(result).not.toBeNull();
    expect(fs.existsSync(result!)).toBe(true);

    const content = fs.readFileSync(result!, 'utf-8');
    expect(content).toBe('fake-database-content');
  });

  it('creates backup in a backups subdirectory', () => {
    const result = createBackup();
    expect(result).not.toBeNull();
    expect(result!).toContain('backups');
    expect(path.basename(result!)).toMatch(/^tracker_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/);
  });

  it('returns null if DB file does not exist', () => {
    fs.unlinkSync(testDbPath);
    const result = createBackup();
    expect(result).toBeNull();
  });

  it('rotates old backups (keeps max 7)', () => {
    const backupDir = path.join(testDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    // Create 9 old backup files
    for (let i = 0; i < 9; i++) {
      const name = `tracker_2025-01-0${i + 1}_03-00-00.db`;
      fs.writeFileSync(path.join(backupDir, name), 'old');
    }

    // Create a new backup (should trigger rotation)
    createBackup();

    const remaining = fs.readdirSync(backupDir).filter((f) => f.startsWith('tracker_'));
    // 9 old + 1 new = 10, but rotation keeps max 7
    expect(remaining.length).toBeLessThanOrEqual(7);
  });
});
