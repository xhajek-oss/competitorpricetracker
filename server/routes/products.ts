import { Router, Request, Response } from 'express';
import { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../database/models/product';
import { addPriceRecord } from '../database/models/priceHistory';
import { createAlert } from '../database/models/alert';
import { scrapePrice, detectShopType, validateUrlSafety } from '../scraper';
import { getDb } from '../database/connection';
import { CONFIG } from '../../shared/config';
import { logger } from '../logger';
import type { ApiResponse, Product, CreateProductRequest, UpdateProductRequest } from '../../shared/types';

type ProductWithChange = Product & { previous_price?: number | null };

function enrichProductsWithPreviousPrice(products: Product[]): ProductWithChange[] {
  if (products.length === 0) return [];
  const db = getDb();
  const stmt = db.prepare(`
    SELECT price FROM price_history
    WHERE product_id = ?
    ORDER BY checked_at DESC
    LIMIT 1 OFFSET 1
  `);
  return products.map((p) => {
    const row = stmt.get(p.id) as { price: number } | undefined;
    return { ...p, previous_price: row ? row.price : null };
  });
}

const ALLOWED_INTERVALS = [6, 12, 24];

const router = Router();

// GET / — List all products (with previous_price for change indicators)
router.get('/', (_req: Request, res: Response) => {
  try {
    const products = getAllProducts();
    const enriched = enrichProductsWithPreviousPrice(products);
    const response: ApiResponse<ProductWithChange[]> = { success: true, data: enriched };
    res.json(response);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch products:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// POST / — Add a new product
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateProductRequest;

    // Validate URL
    if (!body.url || typeof body.url !== 'string') {
      res.status(400).json({ success: false, error: 'URL is required' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.url);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid URL format' });
      return;
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      res.status(400).json({ success: false, error: 'URL must use http or https' });
      return;
    }

    // SSRF protection
    const safety = await validateUrlSafety(body.url);
    if (!safety.safe) {
      res.status(400).json({ success: false, error: 'This URL cannot be tracked for security reasons' });
      return;
    }

    // Validate check_interval
    if (body.check_interval !== undefined && !ALLOWED_INTERVALS.includes(body.check_interval)) {
      res.status(400).json({ success: false, error: 'check_interval must be 6, 12, or 24' });
      return;
    }

    // Enforce max products limit
    const existing = getAllProducts();
    if (existing.length >= CONFIG.MAX_PRODUCTS) {
      res.status(400).json({ success: false, error: `Maximum of ${CONFIG.MAX_PRODUCTS} products reached` });
      return;
    }

    // Detect shop type
    const shopType = detectShopType(body.url);

    // Scrape current price
    const scrapeResult = await scrapePrice(body.url);

    // Create product
    const product = createProduct({
      url: body.url,
      name: body.name || scrapeResult.productName || undefined,
      shop_type: shopType,
      check_interval: body.check_interval,
    });

    // If scrape was successful, update product with current price and add to price history
    if (scrapeResult.success && scrapeResult.price !== null) {
      addPriceRecord(product.id, scrapeResult.price, scrapeResult.currency);
      updateProduct(product.id, {
        current_price: scrapeResult.price,
        last_checked_at: new Date().toISOString(),
      });
    }

    // Create a default alert (price_change_any, email)
    createAlert({
      product_id: product.id,
      alert_type: 'price_change_any',
      notification_method: 'email',
    });

    // Re-fetch updated product
    const updatedProduct = getProductById(product.id)!;
    const response: ApiResponse<Product> = { success: true, data: updatedProduct };
    res.status(201).json(response);
  } catch (error) {
    logger.error({ err: error }, 'Failed to create product:', error);
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

// GET /:id — Get a single product
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid product ID' });
      return;
    }

    const product = getProductById(id);
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const response: ApiResponse<Product> = { success: true, data: product };
    res.json(response);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch product:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

// PUT /:id — Update a product
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid product ID' });
      return;
    }

    const body = req.body as UpdateProductRequest;

    // Validate check_interval if provided
    if (body.check_interval !== undefined && !ALLOWED_INTERVALS.includes(body.check_interval)) {
      res.status(400).json({ success: false, error: 'check_interval must be 6, 12, or 24' });
      return;
    }

    const product = updateProduct(id, {
      name: body.name,
      check_interval: body.check_interval,
      is_active: body.is_active,
    });

    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const response: ApiResponse<Product> = { success: true, data: product };
    res.json(response);
  } catch (error) {
    logger.error({ err: error }, 'Failed to update product:', error);
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

// DELETE /:id — Delete a product
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid product ID' });
      return;
    }

    const deleted = deleteProduct(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete product:', error);
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

// POST /import — Bulk import products from CSV data
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { csv } = req.body as { csv: string };
    if (!csv || typeof csv !== 'string') {
      res.status(400).json({ success: false, error: 'CSV data is required in the "csv" field' });
      return;
    }

    const lines = csv.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      res.status(400).json({ success: false, error: 'CSV is empty' });
      return;
    }

    // Detect header row
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('url');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const existing = getAllProducts();
    const maxSlots = CONFIG.MAX_PRODUCTS - existing.length;

    if (dataLines.length > maxSlots) {
      res.status(400).json({
        success: false,
        error: `Can only import ${maxSlots} more products (${existing.length}/${CONFIG.MAX_PRODUCTS} used)`,
      });
      return;
    }

    const results: Array<{ url: string; success: boolean; error?: string }> = [];

    for (const line of dataLines) {
      // Parse CSV line (handles quoted fields)
      const parts = line.match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g);
      if (!parts) {
        results.push({ url: line, success: false, error: 'Invalid CSV format' });
        continue;
      }

      const fields = parts.map((p) =>
        p.replace(/^,/, '').replace(/^"(.*)"$/, '$1').replace(/""/g, '"').trim()
      );

      const url = fields[0];
      const name = fields[1] || undefined;
      const interval = fields[2] ? parseInt(fields[2], 10) : 24;

      if (!url) {
        results.push({ url: '', success: false, error: 'Empty URL' });
        continue;
      }

      try {
        new URL(url);
      } catch {
        results.push({ url, success: false, error: 'Invalid URL format' });
        continue;
      }

      if (![6, 12, 24].includes(interval)) {
        results.push({ url, success: false, error: 'Invalid check_interval (must be 6, 12, or 24)' });
        continue;
      }

      try {
        const safety = await validateUrlSafety(url);
        if (!safety.safe) {
          results.push({ url, success: false, error: 'URL blocked for security reasons' });
          continue;
        }

        const shopType = detectShopType(url);
        const product = createProduct({ url, name, shop_type: shopType, check_interval: interval as 6 | 12 | 24 });
        createAlert({ product_id: product.id, alert_type: 'price_change_any', notification_method: 'email' });
        results.push({ url, success: true });
      } catch (error) {
        results.push({ url, success: false, error: 'Failed to create product' });
      }
    }

    const imported = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.status(201).json({
      success: true,
      data: { imported, failed, total: results.length, details: results },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to import products');
    res.status(500).json({ success: false, error: 'Failed to import products' });
  }
});

export default router;
