import { Router, Request, Response } from 'express';
import { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../database/models/product';
import { addPriceRecord } from '../database/models/priceHistory';
import { createAlert } from '../database/models/alert';
import { scrapePrice, detectShopType } from '../scraper';
import type { ApiResponse, Product, CreateProductRequest, UpdateProductRequest } from '../../shared/types';

const router = Router();

// GET / — List all products
router.get('/', (_req: Request, res: Response) => {
  try {
    const products = getAllProducts();
    const response: ApiResponse<Product[]> = { success: true, data: products };
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch products';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

// POST / — Add a new product
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateProductRequest;

    // Validate URL
    if (!body.url || typeof body.url !== 'string') {
      const response: ApiResponse<never> = { success: false, error: 'URL is required' };
      res.status(400).json(response);
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.url);
    } catch {
      const response: ApiResponse<never> = { success: false, error: 'Invalid URL format' };
      res.status(400).json(response);
      return;
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      const response: ApiResponse<never> = { success: false, error: 'URL must use http or https protocol' };
      res.status(400).json(response);
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
    const message = error instanceof Error ? error.message : 'Failed to create product';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

// GET /:id — Get a single product
router.get('/:id', (req: Request, res: Response) => {
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

    const response: ApiResponse<Product> = { success: true, data: product };
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch product';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

// PUT /:id — Update a product
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      const response: ApiResponse<never> = { success: false, error: 'Invalid product ID' };
      res.status(400).json(response);
      return;
    }

    const body = req.body as UpdateProductRequest;
    const product = updateProduct(id, {
      name: body.name,
      check_interval: body.check_interval,
      is_active: body.is_active,
    });

    if (!product) {
      const response: ApiResponse<never> = { success: false, error: 'Product not found' };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Product> = { success: true, data: product };
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update product';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

// DELETE /:id — Delete a product
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      const response: ApiResponse<never> = { success: false, error: 'Invalid product ID' };
      res.status(400).json(response);
      return;
    }

    const deleted = deleteProduct(id);
    if (!deleted) {
      const response: ApiResponse<never> = { success: false, error: 'Product not found' };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<{ deleted: true }> = { success: true, data: { deleted: true } };
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete product';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

export default router;
