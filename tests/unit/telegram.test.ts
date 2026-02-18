import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config with Telegram credentials
vi.mock('../../shared/config', () => ({
  CONFIG: {
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    TELEGRAM_CHAT_ID: '123456789',
  },
}));

import { sendTelegramNotification } from '../../server/notifications/telegram';
import type { NotificationPayload } from '../../shared/types';

const mockPayload: NotificationPayload = {
  to: 'test@example.com',
  subject: 'Price Alert',
  productName: 'Test Product',
  productUrl: 'https://example.com/product',
  oldPrice: 100.0,
  newPrice: 79.99,
  changePercent: -20.01,
  currency: 'EUR',
};

describe('sendTelegramNotification', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends message to Telegram API with correct parameters', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendTelegramNotification(mockPayload);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/bottest-bot-token/sendMessage');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.chat_id).toBe('123456789');
    expect(body.parse_mode).toBe('HTML');
    expect(body.text).toContain('Test Product');
    expect(body.text).toContain('EUR100.00');
    expect(body.text).toContain('EUR79.99');
  });

  it('returns false on API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    }));

    const result = await sendTelegramNotification(mockPayload);
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await sendTelegramNotification(mockPayload);
    expect(result).toBe(false);
  });

  it('includes price drop indicator for price decreases', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await sendTelegramNotification(mockPayload);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('📉');
    expect(body.text).toContain('dropped');
  });

  it('includes price increase indicator for price increases', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const increasePayload = { ...mockPayload, oldPrice: 50, newPrice: 75, changePercent: 50 };
    await sendTelegramNotification(increasePayload);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('📈');
    expect(body.text).toContain('increased');
  });
});
