import type { ScrapeResult, ShopType } from '../../shared/types';
import { scrapeAmazon } from './amazon';
import { scrapeEbay } from './ebay';
import { scrapeShopify } from './shopify';
import { scrapeGeneric } from './generic';

export function detectShopType(url: string): ShopType {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes('amazon.')) return 'amazon';
  if (hostname.includes('ebay.')) return 'ebay';
  if (hostname.includes('myshopify.com') || hostname.includes('shopify.')) return 'shopify';
  return 'generic';
}

export async function scrapePrice(url: string): Promise<ScrapeResult> {
  const shopType = detectShopType(url);
  try {
    switch (shopType) {
      case 'amazon': return await scrapeAmazon(url);
      case 'ebay': return await scrapeEbay(url);
      case 'shopify': return await scrapeShopify(url);
      default: return await scrapeGeneric(url);
    }
  } catch (error) {
    return {
      success: false,
      price: null,
      currency: 'EUR',
      productName: null,
      error: error instanceof Error ? error.message : 'Unknown scraping error',
      shopType,
    };
  }
}
