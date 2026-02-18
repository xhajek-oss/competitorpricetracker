import cron from 'node-cron';
import { getProductsDueForCheck, updateProduct } from '../database/models/product';
import { addPriceRecord } from '../database/models/priceHistory';
import { detectPriceChange, evaluateAlerts } from '../database/priceDetection';
import { scrapePrice } from '../scraper';

let notificationHandler: ((alerts: any[], change: any) => Promise<void>) | null = null;

// Try to load notification handler
try {
  const { processAlertQueue } = require('../notifications/queue');
  notificationHandler = processAlertQueue;
} catch {
  console.log('Notification module not available yet -- alerts will be logged to console');
}

export function startScheduler(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled price check...`);
    await checkDueProducts();
  });

  console.log('Scheduler started -- checking prices every hour');
}

async function checkDueProducts(): Promise<void> {
  const products = getProductsDueForCheck();
  console.log(`${products.length} product(s) due for checking`);

  for (const product of products) {
    try {
      console.log(`Checking: ${product.name || product.url}`);
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
          console.log(
            `Price changed for ${product.name}: ${change.oldPrice} -> ${change.newPrice} (${change.direction} ${change.changePercent.toFixed(1)}%)`
          );
          const triggered = evaluateAlerts(change);

          if (triggered.length > 0 && notificationHandler) {
            await notificationHandler(triggered, change);
          } else if (triggered.length > 0) {
            console.log(`${triggered.length} alert(s) triggered but notification module not loaded`);
          }
        }
      } else {
        console.log(`Failed to scrape ${product.url}: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error checking ${product.url}:`, error);
    }

    // Small delay between scrapes to be polite
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

// Export for manual triggering
export { checkDueProducts };
