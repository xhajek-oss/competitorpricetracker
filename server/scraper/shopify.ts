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

export async function scrapeShopify(url: string): Promise<ScrapeResult> {
  const b = await getBrowser();
  const page = await b.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.SCRAPER_TIMEOUT_MS });

    let price: number | null = null;
    let currency = 'EUR';
    let productName: string | null = null;

    // Strategy 1: JSON-LD structured data
    try {
      const jsonLdScripts = await page.$$eval(
        'script[type="application/ld+json"]',
        (scripts) => scripts.map((s) => s.textContent || '')
      );

      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script);
          const product = data['@type'] === 'Product' ? data : null;
          if (product && product.offers) {
            const offer = Array.isArray(product.offers)
              ? product.offers[0]
              : product.offers;
            if (offer && offer.price) {
              price = parseFloat(offer.price);
              currency = offer.priceCurrency || currency;
              productName = product.name || null;
              break;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      /* no JSON-LD */
    }

    // Strategy 2: OpenGraph meta tags
    if (price === null) {
      try {
        const ogPrice = await page.$eval(
          'meta[property="og:price:amount"]',
          (el) => el.getAttribute('content')
        );
        if (ogPrice) {
          const parsed = parsePrice(ogPrice);
          price = parsed.price;
        }
      } catch {
        /* no OG price */
      }

      try {
        const ogCurrency = await page.$eval(
          'meta[property="og:price:currency"]',
          (el) => el.getAttribute('content')
        );
        if (ogCurrency) currency = ogCurrency;
      } catch {
        /* no OG currency */
      }
    }

    // Strategy 3: Common Shopify CSS selectors
    if (price === null) {
      const shopifySelectors = [
        '.product-price',
        '.price',
        '[data-product-price]',
        '.product__price',
        '.price__regular .price-item',
      ];

      for (const selector of shopifySelectors) {
        try {
          const el = await page.$(selector);
          if (el) {
            const text = await el.textContent();
            if (text && text.trim()) {
              const parsed = parsePrice(text);
              if (parsed.price > 0) {
                price = parsed.price;
                currency = parsed.currency;
                break;
              }
            }
          }
        } catch {
          continue;
        }
      }
    }

    // Get product name if not found yet
    if (!productName) {
      try {
        productName = await page.$eval(
          'meta[property="og:title"]',
          (el) => el.getAttribute('content')
        );
      } catch {
        /* no OG title */
      }
    }
    if (!productName) {
      try {
        productName = await page.$eval('h1', (el) => el.textContent?.trim() || null);
      } catch {
        /* no h1 */
      }
    }

    if (price === null || price === 0) {
      return {
        success: false,
        price: null,
        currency,
        productName,
        error: 'Price not found on page',
        shopType: 'shopify',
      };
    }

    return { success: true, price, currency, productName, shopType: 'shopify' };
  } finally {
    await page.close();
  }
}
