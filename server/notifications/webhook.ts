import { CONFIG } from '../../shared/config';
import { logger } from '../logger';
import type { PriceChange } from '../../shared/types';

export async function sendWebhook(change: PriceChange): Promise<boolean> {
  if (!CONFIG.WEBHOOK_URL) {
    logger.warn('Webhook URL not configured');
    return false;
  }

  const payload = {
    event: 'price_change',
    product: {
      id: change.product.id,
      name: change.product.name,
      url: change.product.url,
      shop_type: change.product.shop_type,
    },
    price: {
      old: change.oldPrice,
      new: change.newPrice,
      currency: change.product.currency,
      change_percent: change.changePercent,
      direction: change.direction,
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(CONFIG.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      logger.error({ status: response.status, url: CONFIG.WEBHOOK_URL }, 'Webhook request failed');
      return false;
    }

    logger.info({ url: CONFIG.WEBHOOK_URL }, 'Webhook sent successfully');
    return true;
  } catch (error) {
    logger.error({ err: error, url: CONFIG.WEBHOOK_URL }, 'Webhook request error');
    return false;
  }
}
