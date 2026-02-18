import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { CONFIG } from '../shared/config';
import { logger } from './logger';

const BACKUP_DIR = path.join(path.dirname(CONFIG.DB_PATH), 'backups');
const MAX_BACKUPS = 7;

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export function createBackup(): string | null {
  try {
    ensureBackupDir();

    if (!fs.existsSync(CONFIG.DB_PATH)) {
      logger.warn('Database file not found, skipping backup');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const backupName = `tracker_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    fs.copyFileSync(CONFIG.DB_PATH, backupPath);
    logger.info({ backupPath }, `Backup created: ${backupName}`);

    rotateBackups();

    return backupPath;
  } catch (error) {
    logger.error({ err: error }, 'Failed to create database backup');
    return null;
  }
}

function rotateBackups(): void {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('tracker_') && f.endsWith('.db'))
      .sort()
      .reverse();

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
        logger.info({ file }, `Deleted old backup: ${file}`);
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to rotate backups');
  }
}

export function startBackupScheduler(): void {
  // Run daily at 03:00
  cron.schedule('0 3 * * *', () => {
    logger.info('Running scheduled database backup...');
    createBackup();
  });

  logger.info('Backup scheduler started — daily backup at 03:00');
}
