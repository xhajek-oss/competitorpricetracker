import { Router, Request, Response } from 'express';
import { getProductById, updateProduct } from '../database/models/product';
import { getPriceHistory, addPriceRecord } from '../database/models/priceHistory';
import { detectPriceChange, evaluateAlerts } from '../database/priceDetection';
import { scrapePrice } from '../scraper';
import type { ApiResponse, PriceRecord, Product } from '../../shared/types';

const router = Router();

// GET /api/products/:id/prices — Get price history
router.get('/products/:id/prices', (req: Request, res: Response) => {
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

    // Cap limit to prevent abuse
    const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 100 : rawLimit), 1000);

    const from = req.query.from as string | undefined;
    if (from && isNaN(Date.parse(from))) {
      res.status(400).json({ success: false, error: 'Invalid date format for "from" parameter' });
      return;
    }

    const prices = getPriceHistory(id, limit, from);
    const response: ApiResponse<PriceRecord[]> = { success: true, data: prices };
    res.json(response);
  } catch (error) {
    console.error('Failed to fetch price history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch price history' });
  }
});

// POST /api/products/:id/check — Trigger immediate price check
router.post('/products/:id/check', async (req: Request, res: Response) => {
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

    // Scrape current price
    const scrapeResult = await scrapePrice(product.url);

    if (!scrapeResult.success || scrapeResult.price === null) {
      res.status(502).json({ success: false, error: 'Failed to scrape price from this page' });
      return;
    }

    // Add price record to history
    const priceRecord = addPriceRecord(id, scrapeResult.price, scrapeResult.currency);

    // Detect price change
    const change = detectPriceChange(id, scrapeResult.price);
    let changed = false;

    if (change) {
      changed = true;
      const triggered = evaluateAlerts(change);

      if (triggered.length > 0) {
        try {
          const { processAlertQueue } = require('../notifications/queue');
          await processAlertQueue(triggered, change);
        } catch {
          console.log(`${triggered.length} alert(s) triggered but notification module not loaded`);
        }
      }
    }

    // Update product with new price and last_checked_at
    const updatedProduct = updateProduct(id, {
      current_price: scrapeResult.price,
      last_checked_at: new Date().toISOString(),
      name: product.name || scrapeResult.productName || undefined,
    });

    const response: ApiResponse<{ product: Product; price_record: PriceRecord; changed: boolean }> = {
      success: true,
      data: {
        product: updatedProduct!,
        price_record: priceRecord,
        changed,
      },
    };
    res.json(response);
  } catch (error) {
    console.error('Failed to check price:', error);
    res.status(500).json({ success: false, error: 'Failed to check price' });
  }
});

export default router;
