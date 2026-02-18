import type { ScrapeResult } from '../../shared/types';
import { CONFIG } from '../../shared/config';
import { parsePrice } from './priceParser';
import { getBrowser, USER_AGENT } from './browser';

export async function scrapeGeneric(url: string): Promise<ScrapeResult> {
  const b = await getBrowser();
  const context = await b.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.SCRAPER_TIMEOUT_MS });

    let price: number | null = null;
    let currency = 'EUR';
    let productName: string | null = null;

    // Strategy 1: JSON-LD structured data (schema.org Product/Offer)
    try {
      const jsonLdScripts = await page.$$eval(
        'script[type="application/ld+json"]',
        (scripts) => scripts.map((s) => s.textContent || '')
      );

      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script);
          // Handle both single object and array
          const items = Array.isArray(data) ? data : [data];

          for (const item of items) {
            if (item['@type'] === 'Product' || item['@type'] === 'IndividualProduct') {
              productName = item.name || null;
              const offers = item.offers;
              if (offers) {
                const offer = Array.isArray(offers) ? offers[0] : offers;
                if (offer && (offer.price || offer.lowPrice)) {
                  price = parseFloat(offer.price || offer.lowPrice);
                  currency = offer.priceCurrency || currency;
                  break;
                }
              }
            }
            // Check for Offer type directly
            if (item['@type'] === 'Offer' || item['@type'] === 'AggregateOffer') {
              if (item.price || item.lowPrice) {
                price = parseFloat(item.price || item.lowPrice);
                currency = item.priceCurrency || currency;
              }
            }
          }
          if (price !== null) break;
        } catch {
          continue;
        }
      }
    } catch {
      /* no JSON-LD */
    }

    // Strategy 2: OpenGraph meta tags
    if (price === null) {
      const ogPriceSelectors = [
        'meta[property="og:price:amount"]',
        'meta[property="product:price:amount"]',
      ];

      for (const selector of ogPriceSelectors) {
        try {
          const content = await page.$eval(selector, (el) => el.getAttribute('content'));
          if (content) {
            const parsed = parsePrice(content);
            if (parsed.price > 0) {
              price = parsed.price;
              break;
            }
          }
        } catch {
          continue;
        }
      }

      // Try to get currency from OG tags
      try {
        const ogCurrency = await page.$eval(
          'meta[property="og:price:currency"], meta[property="product:price:currency"]',
          (el) => el.getAttribute('content')
        );
        if (ogCurrency) currency = ogCurrency;
      } catch {
        /* no OG currency */
      }
    }

    // Strategy 3: Microdata / itemprop="price"
    if (price === null) {
      try {
        const priceEl = await page.$('[itemprop="price"]');
        if (priceEl) {
          const content = await priceEl.getAttribute('content');
          const text = content || (await priceEl.textContent());
          if (text) {
            const parsed = parsePrice(text);
            if (parsed.price > 0) {
              price = parsed.price;
              currency = parsed.currency;
            }
          }
        }
      } catch {
        /* no itemprop price */
      }
    }

    // Strategy 4: Common CSS selectors
    if (price === null) {
      const commonSelectors = [
        '.price',
        '.product-price',
        '[data-price]',
        '.current-price',
        '.sale-price',
        '.offer-price',
        '#price',
        '.price-value',
        '.product__price',
      ];

      for (const selector of commonSelectors) {
        try {
          const el = await page.$(selector);
          if (el) {
            // Check data-price attribute first
            const dataPrice = await el.getAttribute('data-price');
            if (dataPrice) {
              const parsed = parsePrice(dataPrice);
              if (parsed.price > 0) {
                price = parsed.price;
                currency = parsed.currency;
                break;
              }
            }
            // Fallback to text content
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

    // Get product name if not found from JSON-LD
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
        productName = await page.$eval('[itemprop="name"]', (el) => el.textContent?.trim() || null);
      } catch {
        /* no itemprop name */
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
        shopType: 'generic',
      };
    }

    return { success: true, price, currency, productName, shopType: 'generic' };
  } finally {
    await context.close();
  }
}
