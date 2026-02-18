import { parsePrice } from '../../server/scraper/priceParser';

describe('parsePrice', () => {
  // --- EUR prices ---
  it('parses EUR price with comma decimal ("29,99\u20ac")', () => {
    const result = parsePrice('29,99\u20ac');
    expect(result).toEqual({ price: 29.99, currency: 'EUR' });
  });

  it('parses EUR price with thousands separator ("1.234,56 \u20ac")', () => {
    const result = parsePrice('1.234,56 \u20ac');
    expect(result).toEqual({ price: 1234.56, currency: 'EUR' });
  });

  it('parses EUR price without symbol ("49,90")', () => {
    const result = parsePrice('49,90');
    expect(result).toEqual({ price: 49.90, currency: 'EUR' });
  });

  // --- USD prices ---
  it('parses simple USD price ("$19.99")', () => {
    const result = parsePrice('$19.99');
    expect(result).toEqual({ price: 19.99, currency: 'USD' });
  });

  it('parses USD with thousands separator ("$1,234.56")', () => {
    const result = parsePrice('$1,234.56');
    expect(result).toEqual({ price: 1234.56, currency: 'USD' });
  });

  it('parses USD whole dollar amount ("$100")', () => {
    const result = parsePrice('$100');
    expect(result).toEqual({ price: 100, currency: 'USD' });
  });

  // --- GBP prices ---
  it('parses GBP price ("\u00a349.99")', () => {
    const result = parsePrice('\u00a349.99');
    expect(result).toEqual({ price: 49.99, currency: 'GBP' });
  });

  it('parses GBP with thousands ("\u00a31,250.00")', () => {
    const result = parsePrice('\u00a31,250.00');
    expect(result).toEqual({ price: 1250.00, currency: 'GBP' });
  });

  // --- No currency symbol ---
  it('defaults to EUR when no currency symbol is present', () => {
    const result = parsePrice('15.00');
    expect(result.currency).toBe('EUR');
    expect(result.price).toBe(15.00);
  });

  // --- Whitespace handling ---
  it('handles leading/trailing whitespace', () => {
    const result = parsePrice('  $24.99  ');
    expect(result).toEqual({ price: 24.99, currency: 'USD' });
  });

  it('handles non-breaking spaces ("\u00a029,99\u00a0\u20ac")', () => {
    const result = parsePrice('\u00a029,99\u00a0\u20ac');
    expect(result).toEqual({ price: 29.99, currency: 'EUR' });
  });

  // --- Comma as thousands separator (>2 digits after comma) ---
  it('treats comma as thousands separator when >2 digits follow ("1,234")', () => {
    const result = parsePrice('1,234');
    expect(result).toEqual({ price: 1234, currency: 'EUR' });
  });

  // --- Zero and edge cases ---
  it('parses zero ("$0.00")', () => {
    const result = parsePrice('$0.00');
    expect(result).toEqual({ price: 0, currency: 'USD' });
  });

  it('parses a single digit price ("\u20ac5")', () => {
    const result = parsePrice('\u20ac5');
    expect(result).toEqual({ price: 5, currency: 'EUR' });
  });

  // --- Unparseable text ---
  it('returns price 0 for unparseable text', () => {
    const result = parsePrice('not a price');
    expect(result.price).toBe(0);
  });
});
