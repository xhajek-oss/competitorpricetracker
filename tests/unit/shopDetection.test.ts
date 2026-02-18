import { detectShopType } from '../../server/scraper/index';

describe('detectShopType', () => {
  it('detects amazon.de as "amazon"', () => {
    expect(detectShopType('https://www.amazon.de/dp/B09V3KXJPB')).toBe('amazon');
  });

  it('detects amazon.com as "amazon"', () => {
    expect(detectShopType('https://www.amazon.com/dp/B09V3KXJPB')).toBe('amazon');
  });

  it('detects ebay.de as "ebay"', () => {
    expect(detectShopType('https://www.ebay.de/itm/123456')).toBe('ebay');
  });

  it('detects ebay.com as "ebay"', () => {
    expect(detectShopType('https://www.ebay.com/itm/789012')).toBe('ebay');
  });

  it('detects myshopify.com as "shopify"', () => {
    expect(detectShopType('https://cool-store.myshopify.com/products/widget')).toBe('shopify');
  });

  it('detects shopify.com as "shopify"', () => {
    expect(detectShopType('https://shopify.com/store/example')).toBe('shopify');
  });

  it('returns "generic" for example.com', () => {
    expect(detectShopType('https://www.example.com/product/42')).toBe('generic');
  });

  it('returns "generic" for an unrecognized shop', () => {
    expect(detectShopType('https://www.otto.de/produkt/12345')).toBe('generic');
  });
});
