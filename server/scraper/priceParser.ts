/**
 * Shared price parsing utility used by all scrapers.
 * Handles European (1.234,56) and US ($1,234.56) formats.
 */
export function parsePrice(text: string): { price: number; currency: string } {
  let currency = 'EUR';
  if (text.includes('$')) currency = 'USD';
  else if (text.includes('\u00a3')) currency = 'GBP';
  else if (text.includes('\u20ac')) currency = 'EUR';

  // Remove currency symbols, spaces, and non-breaking spaces
  const cleaned = text.replace(/[\u20ac$\u00a3\s\u00a0]/g, '').trim();

  // Handle European format: 1.234,56 -> 1234.56
  let numStr: string;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Has both: determine which is decimal separator (last one)
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // European: 1.234,56
      numStr = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56
      numStr = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Could be European decimal (29,99) or US thousands (1,234)
    // If exactly 2 digits after comma, treat as decimal
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      numStr = cleaned.replace(',', '.');
    } else {
      numStr = cleaned.replace(/,/g, '');
    }
  } else {
    numStr = cleaned;
  }

  const price = parseFloat(numStr);
  return { price: isNaN(price) ? 0 : price, currency };
}
