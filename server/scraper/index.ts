import dns from 'dns/promises';
import type { ScrapeResult, ShopType } from '../../shared/types';
import { CONFIG } from '../../shared/config';
import { scrapeAmazon } from './amazon';
import { scrapeEbay } from './ebay';
import { scrapeShopify } from './shopify';
import { scrapeGeneric } from './generic';
import { logger } from '../logger';

// --- Concurrency limiter ---
let activeScrapes = 0;
const maxConcurrent = CONFIG.MAX_CONCURRENT_SCRAPES;
const waitQueue: Array<() => void> = [];

async function acquireScrapeSlot(): Promise<void> {
  if (activeScrapes < maxConcurrent) {
    activeScrapes++;
    return;
  }
  return new Promise((resolve) => {
    waitQueue.push(() => { activeScrapes++; resolve(); });
  });
}

function releaseScrapeSlot(): void {
  activeScrapes--;
  const next = waitQueue.shift();
  if (next) next();
}

// --- Retry with exponential backoff ---
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

async function scrapePriceWithRetry(url: string, shopType: ShopType): Promise<ScrapeResult> {
  let lastResult: ScrapeResult | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let result: ScrapeResult;
      switch (shopType) {
        case 'amazon': result = await scrapeAmazon(url); break;
        case 'ebay': result = await scrapeEbay(url); break;
        case 'shopify': result = await scrapeShopify(url); break;
        default: result = await scrapeGeneric(url); break;
      }

      if (result.success) return result;

      lastResult = result;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn({ url, attempt, maxRetries: MAX_RETRIES, delay }, `Scrape failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastResult = {
        success: false,
        price: null,
        currency: 'EUR',
        productName: null,
        error: error instanceof Error ? error.message : 'Unknown scraping error',
        shopType,
      };
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn({ url, attempt, err: error }, `Scrape threw error, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error({ url, shopType }, `All ${MAX_RETRIES} scrape attempts failed`);
  return lastResult!;
}

// --- SSRF Protection ---
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

const BLOCKED_HOSTNAMES = ['localhost', '0.0.0.0', '[::1]'];

export async function validateUrlSafety(url: string): Promise<{ safe: boolean; reason?: string }> {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  // Block known private hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { safe: false, reason: 'URL points to a local/private address' };
  }

  // Block IP literals in private ranges
  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) {
      return { safe: false, reason: 'URL points to a private IP range' };
    }
  }

  // Resolve DNS and check resulting IPs
  try {
    const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
    for (const addr of addresses) {
      for (const pattern of PRIVATE_IP_RANGES) {
        if (pattern.test(addr)) {
          return { safe: false, reason: `URL resolves to private IP (${addr})` };
        }
      }
    }
  } catch {
    // DNS resolution failure — allow the scraper to handle it
  }

  return { safe: true };
}

export function detectShopType(url: string): ShopType {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes('amazon.')) return 'amazon';
  if (hostname.includes('ebay.')) return 'ebay';
  if (hostname.includes('myshopify.com') || hostname.includes('shopify.')) return 'shopify';
  return 'generic';
}

export async function scrapePrice(url: string): Promise<ScrapeResult> {
  const shopType = detectShopType(url);

  // SSRF check
  const safety = await validateUrlSafety(url);
  if (!safety.safe) {
    return {
      success: false,
      price: null,
      currency: 'EUR',
      productName: null,
      error: safety.reason || 'URL blocked for security reasons',
      shopType,
    };
  }

  // Wait for a scrape slot
  await acquireScrapeSlot();

  try {
    return await scrapePriceWithRetry(url, shopType);
  } finally {
    releaseScrapeSlot();
  }
}
