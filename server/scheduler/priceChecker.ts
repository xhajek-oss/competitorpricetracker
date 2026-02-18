import cron from 'node-cron';
import { getProductsDueForCheck, updateProduct } from '../database/models/product';
import { addPriceRecord } from '../database/models/priceHistory';
import { detectPriceChange, evaluateAlerts } from '../database/priceDetection';
import { scrapePrice } from '../scraper';
import { logger } from '../logger';

let notificationHandler: ((alerts: any[], change: any) => Promise<void>) | null = null;

// Try to load notification handler
try {
  const { processAlertQueue } = require('../notifications/queue');
  notificationHandler = processAlertQueue;
} catch {
  logger.warn('Notification module not available -- alerts will be logged only');
}

let isRunning = false;

export function startScheduler(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    if (isRunning) {
      logger.warn('Previous check still running, skipping this cycle');
      return;
    }
    isRunning = true;
    try {
      logger.info('Running scheduled price check...');
      await checkDueProducts();
    } finally {
      isRunning = false;
    }
  });

  logger.info('Scheduler started -- checking prices every hour');
}

async function checkDueProducts(): Promise<void> {
  const products = getProductsDueForCheck();
  logger.info({ count: products.length }, `${products.length} product(s) due for checking`);

  for (const product of products) {
    try {
      logger.info({ productId: product.id, name: product.name || product.url }, 'Checking product');
      const result = await scrapePrice(product.url);

      if (result.success && result.price !== null) {
        // Record price
        addPriceRecord(product.id, result.price, result.currency);

        // Check for changes
        const change = detectPriceChange(product.id, result.price);

        // Update product
        updateProduct(product.id, {
          current_price: result.price,
          last_checked_at: new Date().toISOString(),
          name: product.name || result.productName || product.name,
        });

        if (change) {
          logger.info(
            { productId: product.id, oldPrice: change.oldPrice, newPrice: change.newPrice, direction: change.direction, changePercent: change.changePercent },
            `Price changed for ${product.name}: ${change.oldPrice} -> ${change.newPrice} (${change.direction} ${change.changePercent.toFixed(1)}%)`
          );
          const triggered = evaluateAlerts(change);

          if (triggered.length > 0 && notificationHandler) {
            await notificationHandler(triggered, change);
          } else if (triggered.length > 0) {
            logger.warn({ alertCount: triggered.length }, 'Alerts triggered but notification module not loaded');
          }
        }
      } else {
        logger.warn({ productId: product.id, url: product.url, error: result.error }, 'Failed to scrape product');
      }
    } catch (error) {
      logger.error({ productId: product.id, url: product.url, err: error }, 'Error checking product');
    }

    // Small delay between scrapes to be polite
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

// Export for manual triggering
export { checkDueProducts };
