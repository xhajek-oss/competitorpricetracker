import { vi } from 'vitest';

// Mock the scraper module BEFORE importing server code
vi.mock('../../server/scraper/index', () => ({
  scrapePrice: vi.fn().mockResolvedValue({
    success: true,
    price: 29.99,
    currency: 'EUR',
    productName: 'Test Product',
    error: null,
    shopType: 'generic',
  }),
  detectShopType: vi.fn().mockReturnValue('generic'),
  validateUrlSafety: vi.fn().mockResolvedValue({ safe: true }),
  closeBrowser: vi.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { app } from '../../server/index';

describe('Metrics endpoint', () => {
  describe('GET /metrics', () => {
    it('returns text/plain content type', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
    });

    it('contains expected metric names', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.text).toContain('cpt_products_total');
      expect(res.text).toContain('cpt_uptime_seconds');
      expect(res.text).toContain('cpt_scrape_total');
      expect(res.text).toContain('cpt_scrape_success_total');
      expect(res.text).toContain('cpt_scrape_failure_total');
      expect(res.text).toContain('cpt_notification_sent_total');
      expect(res.text).toContain('cpt_api_requests_total');
      expect(res.text).toContain('cpt_memory_rss_bytes');
      expect(res.text).toContain('cpt_memory_heap_used_bytes');
    });

    it('returns valid Prometheus format', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      const lines = res.text.split('\n').filter((l: string) => l.length > 0);

      // Each metric should have HELP, TYPE, and value lines
      for (const line of lines) {
        // Every line should either be a comment (# HELP or # TYPE) or a metric value
        const isComment = line.startsWith('# HELP ') || line.startsWith('# TYPE ');
        const isMetricValue = /^[a-z_]+ \d/.test(line);
        expect(isComment || isMetricValue).toBe(true);
      }

      // Verify TYPE annotations exist
      expect(res.text).toContain('# TYPE cpt_products_total gauge');
      expect(res.text).toContain('# TYPE cpt_uptime_seconds gauge');
      expect(res.text).toContain('# TYPE cpt_scrape_total counter');
    });
  });
});
