import type { Alert, PriceChange, NotificationPayload } from '../../shared/types';
import { CONFIG } from '../../shared/config';
import { createNotification, updateNotificationStatus } from '../database/models/notification';
import { sendEmail } from './email';
import { sendTelegramNotification } from './telegram';

export async function processAlertQueue(alerts: Alert[], change: PriceChange): Promise<void> {
  console.log(`Processing ${alerts.length} alert(s) for ${change.product.name || change.product.url}`);

  for (const alert of alerts) {
    try {
      const payload: NotificationPayload = {
        to: CONFIG.NOTIFICATION_TO_EMAIL,
        subject: `Price Alert: ${change.product.name || 'Product'} — ${change.direction === 'down' ? '↓' : '↑'} ${change.changePercent.toFixed(1)}%`,
        productName: change.product.name || change.product.url,
        productUrl: change.product.url,
        oldPrice: change.oldPrice,
        newPrice: change.newPrice,
        changePercent: change.direction === 'down' ? -change.changePercent : change.changePercent,
        currency: change.product.currency || 'EUR',
      };

      // Create notification record first
      const notification = createNotification({
        alert_id: alert.id,
        product_id: change.product.id,
        message: `${change.product.name}: ${payload.currency}${change.oldPrice.toFixed(2)} -> ${payload.currency}${change.newPrice.toFixed(2)} (${change.direction} ${change.changePercent.toFixed(1)}%)`,
        status: 'pending',
      });

      let success = false;

      // Send based on notification method
      if (alert.notification_method === 'email' || alert.notification_method === 'both') {
        success = await sendEmail(payload);
      }

      if (alert.notification_method === 'telegram' || alert.notification_method === 'both') {
        const telegramSuccess = await sendTelegramNotification(payload);
        success = success || telegramSuccess;
      }

      // Update notification status
      updateNotificationStatus(notification.id, success ? 'sent' : 'failed');

      if (success) {
        console.log(`  Notification sent for alert #${alert.id}`);
      } else {
        console.log(`  Notification failed for alert #${alert.id}`);
      }

      // Small delay between notifications to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`  Error processing alert #${alert.id}:`, error);
    }
  }
}
