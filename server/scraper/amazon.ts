import type { ScrapeResult } from '../../shared/types';
import { CONFIG } from '../../shared/config';
import { parsePrice } from './priceParser';
import { getBrowser, USER_AGENT } from './browser';

export async function scrapeAmazon(url: string): Promise<ScrapeResult> {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: USER_AGENT,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    extraHTTPHeaders: {
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    },
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.SCRAPER_TIMEOUT_MS,
    });

    try {
      await page.click('#sp-cc-accept', { timeout: 3000 });
    } catch {
      /* no consent popup */
    }

    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
      /* page may keep background requests open */
    }

    const pageTitle = await page.title().catch(() => '');
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    const lower = `${pageTitle}\n${bodyText}`.toLowerCase();

    const blocked = [
      'captcha',
      'enter the characters you see below',
      'geben sie die zeichen ein',
      'robot check',
      'automated access',
      'api-services-support@amazon.com',
    ].some((needle) => lower.includes(needle));

    if (blocked) {
      return {
        success: false,
        price: null,
        currency: 'EUR',
        productName: null,
        error: `Amazon blocked the request (CAPTCHA/bot check). HTTP ${response?.status() ?? 'unknown'}`,
        shopType: 'amazon',
      };
    }

    let productName: string | null = null;
    for (const selector of ['#productTitle', '#title', 'h1.a-size-large']) {
      try {
        const text = await page.locator(selector).first().textContent({ timeout: 1500 });
        if (text?.trim()) {
          productName = text.trim();
          break;
        }
      } catch {
        /* keep trying */
      }
    }

    const priceSelectors = [
      '#corePrice_feature_div .priceToPay .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen',
      '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
      '#apex_offerDisplay_desktop .a-price .a-offscreen',
      '#newAccordionRow_1 .a-price .a-offscreen',
      '#price_inside_buybox',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.reinventPricePriceToPayMargin .a-offscreen',
      '.apexPriceToPay .a-offscreen',
      '.priceToPay .a-offscreen',
      '.a-price:not(.a-text-price) .a-offscreen',
    ];

    const candidates: string[] = [];
    for (const selector of priceSelectors) {
      try {
        const texts = await page.locator(selector).allTextContents();
        for (const text of texts) {
          const trimmed = text.trim();
          if (trimmed) candidates.push(trimmed);
        }
      } catch {
        /* keep trying */
      }
    }

    // Fallback: reconstruct prices from Amazon's visually split whole/fraction markup.
    try {
      const splitPrices = await page.locator('.a-price').evaluateAll((nodes) =>
        nodes.map((node) => {
          const whole = node.querySelector('.a-price-whole')?.textContent?.trim() ?? '';
          const fraction = node.querySelector('.a-price-fraction')?.textContent?.trim() ?? '';
          const symbol = node.querySelector('.a-price-symbol')?.textContent?.trim() ?? '';
          if (!whole) return '';
          return `${whole}${fraction ? `,${fraction}` : ''} ${symbol}`.trim();
        }).filter(Boolean),
      );
      candidates.push(...splitPrices);
    } catch {
      /* ignore split-price fallback errors */
    }

    // Keep only plausible EUR prices and prefer the first offer-like value in DOM order.
    for (const candidate of candidates) {
      if (!/[€]|\bEUR\b/i.test(candidate)) continue;
      try {
        const { price, currency } = parsePrice(candidate);
        if (price != null && Number.isFinite(price) && price > 0 && currency === 'EUR') {
          return { success: true, price, currency, productName, shopType: 'amazon' };
        }
      } catch {
        /* malformed candidate */
      }
    }

    const status = response?.status();
    const diagnostic = bodyText.replace(/\s+/g, ' ').slice(0, 180);
    return {
      success: false,
      price: null,
      currency: 'EUR',
      productName,
      error: `Price not found on page${status ? ` (HTTP ${status})` : ''}. Page: ${pageTitle || 'unknown'}. ${diagnostic}`,
      shopType: 'amazon',
    };
  } finally {
    await context.close();
  }
}
