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
      const response: ApiResponse<never> = { success: false, error: 'Invalid product ID' };
      res.status(400).json(response);
      return;
    }

    const product = getProductById(id);
    if (!product) {
      const response: ApiResponse<never> = { success: false, error: 'Product not found' };
      res.status(404).json(response);
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const from = req.query.from as string | undefined;

    const prices = getPriceHistory(id, limit, from);
    const response: ApiResponse<PriceRecord[]> = { success: true, data: prices };
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch price history';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

// POST /api/products/:id/check — Trigger immediate price check
router.post('/products/:id/check', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      const response: ApiResponse<never> = { success: false, error: 'Invalid product ID' };
      res.status(400).json(response);
      return;
    }

    const product = getProductById(id);
    if (!product) {
      const response: ApiResponse<never> = { success: false, error: 'Product not found' };
      res.status(404).json(response);
      return;
    }

    // Scrape current price
    const scrapeResult = await scrapePrice(product.url);

    if (!scrapeResult.success || scrapeResult.price === null) {
      const response: ApiResponse<never> = {
        success: false,
        error: scrapeResult.error || 'Failed to scrape price',
      };
      res.status(502).json(response);
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
        // Try to process alert queue if notification module is available
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
    const message = error instanceof Error ? error.message : 'Failed to check price';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

export default router;
