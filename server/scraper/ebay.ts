import { chromium, Browser } from 'playwright';
import type { ScrapeResult } from '../../shared/types';
import { CONFIG } from '../../shared/config';
import { parsePrice } from './priceParser';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: CONFIG.SCRAPER_HEADLESS });
  }
  return browser;
}

export async function scrapeEbay(url: string): Promise<ScrapeResult> {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.SCRAPER_TIMEOUT_MS });

    // Handle cookie consent
    try {
      await page.click('#gdpr-banner-accept', { timeout: 3000 });
    } catch {
      /* no consent popup */
    }

    // Try multiple price selectors — prefer Buy It Now prices
    const priceSelectors = [
      '.x-price-primary .ux-textspans',
      '.x-bin-price .ux-textspans',
      '#prcIsum',
      '[itemprop="price"]',
      '.vi-price .notranslate',
    ];

    let priceText: string | null = null;
    for (const selector of priceSelectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          // Check for content attribute first (structured data)
          const content = await el.getAttribute('content');
          if (content && content.trim()) {
            priceText = content;
            break;
          }
          const text = await el.textContent();
          if (text && text.trim()) {
            priceText = text;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    // Get product name
    let productName: string | null = null;
    const titleSelectors = ['.x-item-title__mainTitle', '#itemTitle', 'h1.x-item-title'];
    for (const selector of titleSelectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          productName = await el.textContent();
          if (productName) {
            // Remove "Details about" prefix that eBay sometimes adds
            productName = productName.replace(/^Details about\s*/i, '').trim();
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (!priceText) {
      return {
        success: false,
        price: null,
        currency: 'EUR',
        productName,
        error: 'Price not found on page',
        shopType: 'ebay',
      };
    }

    const { price, currency } = parsePrice(priceText);

    return { success: true, price, currency, productName, shopType: 'ebay' };
  } finally {
    await context.close();
  }
}
