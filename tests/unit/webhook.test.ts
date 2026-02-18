import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config with webhook URL
vi.mock('../../shared/config', () => ({
  CONFIG: {
    WEBHOOK_URL: 'https://hooks.example.com/webhook',
  },
}));

import { sendWebhook } from '../../server/notifications/webhook';
import type { PriceChange } from '../../shared/types';

const mockChange: PriceChange = {
  product: {
    id: 1,
    url: 'https://example.com/product',
    name: 'Test Product',
    current_price: 79.99,
    currency: 'EUR',
    shop_type: 'generic',
    check_interval: 24,
    is_active: true,
    last_checked_at: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  oldPrice: 100.00,
  newPrice: 79.99,
  changePercent: -20.01,
  direction: 'down',
};

describe('sendWebhook', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends POST with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendWebhook(mockChange);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://hooks.example.com/webhook');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.event).toBe('price_change');
    expect(body.product.id).toBe(1);
    expect(body.product.name).toBe('Test Product');
    expect(body.product.url).toBe('https://example.com/product');
    expect(body.product.shop_type).toBe('generic');
    expect(body.price.old).toBe(100.00);
    expect(body.price.new).toBe(79.99);
    expect(body.price.currency).toBe('EUR');
    expect(body.price.direction).toBe('down');
    expect(body.timestamp).toBeDefined();
  });

  it('returns false when WEBHOOK_URL is empty', async () => {
    // Override the config mock for this test
    const configModule = await import('../../shared/config');
    const originalUrl = configModule.CONFIG.WEBHOOK_URL;
    (configModule.CONFIG as { WEBHOOK_URL: string }).WEBHOOK_URL = '';

    const result = await sendWebhook(mockChange);
    expect(result).toBe(false);

    // Restore
    (configModule.CONFIG as { WEBHOOK_URL: string }).WEBHOOK_URL = originalUrl;
  });

  it('handles fetch errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await sendWebhook(mockChange);
    expect(result).toBe(false);
  });

  it('returns false when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    }));

    const result = await sendWebhook(mockChange);
    expect(result).toBe(false);
  });
});
