import { Router, Request, Response } from 'express';
import { getDb } from '../database/connection';

const router = Router();

// Simple in-process counters (no external dependency)
export const metrics = {
  scrape_total: 0,
  scrape_success: 0,
  scrape_failure: 0,
  scrape_retry_total: 0,
  notification_sent: 0,
  notification_failed: 0,
  api_requests: 0,
};

export function incrementMetric(key: keyof typeof metrics, amount = 1): void {
  metrics[key] += amount;
}

// GET /metrics — Prometheus text format
router.get('/', (_req: Request, res: Response) => {
  let output = '';

  const line = (name: string, help: string, type: string, value: number) => {
    output += `# HELP ${name} ${help}\n`;
    output += `# TYPE ${name} ${type}\n`;
    output += `${name} ${value}\n`;
  };

  // In-process counters
  line('cpt_scrape_total', 'Total scrape attempts', 'counter', metrics.scrape_total);
  line('cpt_scrape_success_total', 'Successful scrapes', 'counter', metrics.scrape_success);
  line('cpt_scrape_failure_total', 'Failed scrapes', 'counter', metrics.scrape_failure);
  line('cpt_scrape_retry_total', 'Scrape retries', 'counter', metrics.scrape_retry_total);
  line('cpt_notification_sent_total', 'Notifications sent', 'counter', metrics.notification_sent);
  line('cpt_notification_failed_total', 'Notifications failed', 'counter', metrics.notification_failed);
  line('cpt_api_requests_total', 'Total API requests', 'counter', metrics.api_requests);

  // Database gauges
  try {
    const db = getDb();
    const products = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
    const active = db.prepare('SELECT COUNT(*) as c FROM products WHERE is_active = 1').get() as { c: number };
    const alerts = db.prepare('SELECT COUNT(*) as c FROM alerts WHERE is_active = 1').get() as { c: number };
    const priceRecords = db.prepare('SELECT COUNT(*) as c FROM price_history').get() as { c: number };

    line('cpt_products_total', 'Total tracked products', 'gauge', products.c);
    line('cpt_products_active', 'Active tracked products', 'gauge', active.c);
    line('cpt_alerts_active', 'Active alerts', 'gauge', alerts.c);
    line('cpt_price_records_total', 'Total price history records', 'gauge', priceRecords.c);
  } catch {
    // DB unavailable — skip gauges
  }

  // Process metrics
  line('cpt_uptime_seconds', 'Process uptime in seconds', 'gauge', Math.floor(process.uptime()));
  const mem = process.memoryUsage();
  line('cpt_memory_rss_bytes', 'Resident set size', 'gauge', mem.rss);
  line('cpt_memory_heap_used_bytes', 'V8 heap used', 'gauge', mem.heapUsed);

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(output);
});

export default router;
