import type { NotificationPayload } from '../../shared/types';

export async function sendTelegramNotification(payload: NotificationPayload): Promise<boolean> {
  console.log('[TELEGRAM] Not yet implemented. Notification would be sent:');
  console.log(`   Product: ${payload.productName}`);
  console.log(`   Price: ${payload.currency}${payload.oldPrice.toFixed(2)} -> ${payload.currency}${payload.newPrice.toFixed(2)}`);
  return false;
}
