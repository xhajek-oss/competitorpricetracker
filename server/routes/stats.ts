import { Router, Request, Response } from 'express';
import { getDb } from '../database/connection';
import { logger } from '../logger';
import type { ApiResponse } from '../../shared/types';

const router = Router();

interface DashboardStats {
  total_products: number;
  active_products: number;
  total_alerts: number;
  total_price_records: number;
  recent_changes: Array<{
    product_id: number;
    product_name: string;
    old_price: number;
    new_price: number;
    change_percent: number;
    direction: 'up' | 'down';
    checked_at: string;
  }>;
  avg_price_change_percent: number;
}

// GET /api/stats — Dashboard statistics
router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();

    const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
    const activeCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get() as { count: number };
    const alertCount = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_active = 1').get() as { count: number };
    const priceRecordCount = db.prepare('SELECT COUNT(*) as count FROM price_history').get() as { count: number };

    // Recent price changes: find products whose last two prices differ
    const recentChanges = db.prepare(`
      WITH ranked AS (
        SELECT
          ph.product_id,
          ph.price,
          ph.checked_at,
          ROW_NUMBER() OVER (PARTITION BY ph.product_id ORDER BY ph.checked_at DESC) as rn
        FROM price_history ph
      )
      SELECT
        r1.product_id,
        p.name as product_name,
        r2.price as old_price,
        r1.price as new_price,
        r1.checked_at
      FROM ranked r1
      JOIN ranked r2 ON r1.product_id = r2.product_id AND r2.rn = 2
      JOIN products p ON p.id = r1.product_id
      WHERE r1.rn = 1 AND r1.price != r2.price
      ORDER BY r1.checked_at DESC
      LIMIT 10
    `).all() as Array<{ product_id: number; product_name: string; old_price: number; new_price: number; checked_at: string }>;

    const enriched = recentChanges.map((c) => {
      const changePercent = Math.abs(((c.new_price - c.old_price) / c.old_price) * 100);
      return {
        ...c,
        change_percent: Math.round(changePercent * 10) / 10,
        direction: (c.new_price > c.old_price ? 'up' : 'down') as 'up' | 'down',
      };
    });

    const avgChange = enriched.length > 0
      ? enriched.reduce((sum, c) => sum + c.change_percent, 0) / enriched.length
      : 0;

    const stats: DashboardStats = {
      total_products: productCount.count,
      active_products: activeCount.count,
      total_alerts: alertCount.count,
      total_price_records: priceRecordCount.count,
      recent_changes: enriched,
      avg_price_change_percent: Math.round(avgChange * 10) / 10,
    };

    const response: ApiResponse<DashboardStats> = { success: true, data: stats };
    res.json(response);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch stats');
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

export default router;
