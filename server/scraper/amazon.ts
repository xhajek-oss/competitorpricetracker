import type { ScrapeResult } from '../../shared/types';
import { CONFIG } from '../../shared/config';
import { parsePrice } from './priceParser';
import { getBrowser, USER_AGENT } from './browser';

export async function scrapeAmazon(url: string): Promise<ScrapeResult> {
  const b = await getBrowser();
  const context = await b.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.SCRAPER_TIMEOUT_MS });

    // Handle cookie consent
    try {
      await page.click('#sp-cc-accept', { timeout: 3000 });
    } catch {
      /* no consent popup */
    }

    // Try multiple price selectors (Amazon changes these frequently)
    const priceSelectors = [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.priceToPay .a-offscreen',
      '#corePrice_feature_div .a-offscreen',
      '#tp_price_block_total_price_ww .a-offscreen',
      '.apexPriceToPay .a-offscreen',
    ];

    let priceText: string | null = null;
    for (const selector of priceSelectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          priceText = await el.textContent();
          if (priceText && priceText.trim()) break;
        }
      } catch {
        continue;
      }
    }

    // Get product name
    let productName: string | null = null;
    try {
      productName = await page.$eval('#productTitle', (el) => el.textContent?.trim() || null);
    } catch {
      /* no title found */
    }

    if (!priceText) {
      return {
        success: false,
        price: null,
        currency: 'EUR',
        productName,
        error: 'Price not found on page',
        shopType: 'amazon',
      };
    }

    const { price, currency } = parsePrice(priceText);

    return { success: true, price, currency, productName, shopType: 'amazon' };
  } finally {
    await context.close();
  }
}
