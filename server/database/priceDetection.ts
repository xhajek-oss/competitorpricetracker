import { getProductById } from './models/product';
import { getActiveAlertsForProduct } from './models/alert';
import type { PriceChange, Alert } from '../../shared/types';

export function detectPriceChange(productId: number, newPrice: number): PriceChange | null {
  const product = getProductById(productId);
  if (!product) return null;

  if (product.current_price === null) return null;

  const oldPrice = product.current_price;
  if (oldPrice === newPrice) return null;

  const changePercent = Math.abs(((newPrice - oldPrice) / oldPrice) * 100);
  const direction: 'up' | 'down' = newPrice > oldPrice ? 'up' : 'down';

  return {
    product,
    oldPrice,
    newPrice,
    changePercent,
    direction,
  };
}

export function evaluateAlerts(change: PriceChange): Alert[] {
  const activeAlerts = getActiveAlertsForProduct(change.product.id);
  const triggered: Alert[] = [];

  for (const alert of activeAlerts) {
    switch (alert.alert_type) {
      case 'price_change_any':
        triggered.push(alert);
        break;

      case 'price_drop_percent':
        if (
          change.direction === 'down' &&
          alert.threshold_percent !== null &&
          change.changePercent >= alert.threshold_percent
        ) {
          triggered.push(alert);
        }
        break;

      case 'price_below':
        if (alert.threshold_price !== null && change.newPrice < alert.threshold_price) {
          triggered.push(alert);
        }
        break;
    }
  }

  return triggered;
}
