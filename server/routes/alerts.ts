import { Router, Request, Response } from 'express';
import { getAlerts, createAlert, updateAlert, deleteAlert } from '../database/models/alert';
import { getProductById } from '../database/models/product';
import type { ApiResponse, Alert, CreateAlertRequest, UpdateAlertRequest } from '../../shared/types';

const VALID_ALERT_TYPES = ['price_change_any', 'price_drop_percent', 'price_below'];
const VALID_METHODS = ['email', 'telegram', 'both'];

const router = Router();

// GET / — List alerts, optionally filtered by product_id
router.get('/', (req: Request, res: Response) => {
  try {
    const productId = req.query.product_id
      ? parseInt(req.query.product_id as string, 10)
      : undefined;

    const alerts = getAlerts(productId);
    const response: ApiResponse<Alert[]> = { success: true, data: alerts };
    res.json(response);
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

// POST / — Create a new alert
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as CreateAlertRequest;

    if (!body.product_id || !body.alert_type) {
      res.status(400).json({ success: false, error: 'product_id and alert_type are required' });
      return;
    }

    // Validate product exists
    const product = getProductById(body.product_id);
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    // Validate alert_type
    if (!VALID_ALERT_TYPES.includes(body.alert_type)) {
      res.status(400).json({ success: false, error: 'Invalid alert_type. Must be: ' + VALID_ALERT_TYPES.join(', ') });
      return;
    }

    // Validate notification_method
    if (body.notification_method && !VALID_METHODS.includes(body.notification_method)) {
      res.status(400).json({ success: false, error: 'Invalid notification_method. Must be: ' + VALID_METHODS.join(', ') });
      return;
    }

    const alert = createAlert({
      product_id: body.product_id,
      alert_type: body.alert_type,
      threshold_percent: body.threshold_percent,
      threshold_price: body.threshold_price,
      notification_method: body.notification_method,
    });

    const response: ApiResponse<Alert> = { success: true, data: alert };
    res.status(201).json(response);
  } catch (error) {
    console.error('Failed to create alert:', error);
    res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});

// PUT /:id — Update an alert
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid alert ID' });
      return;
    }

    const body = req.body as UpdateAlertRequest;

    // Validate alert_type if provided
    if (body.alert_type && !VALID_ALERT_TYPES.includes(body.alert_type)) {
      res.status(400).json({ success: false, error: 'Invalid alert_type' });
      return;
    }

    // Validate notification_method if provided
    if (body.notification_method && !VALID_METHODS.includes(body.notification_method)) {
      res.status(400).json({ success: false, error: 'Invalid notification_method' });
      return;
    }

    const alert = updateAlert(id, {
      alert_type: body.alert_type,
      threshold_percent: body.threshold_percent,
      threshold_price: body.threshold_price,
      notification_method: body.notification_method,
      is_active: body.is_active,
    });

    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    const response: ApiResponse<Alert> = { success: true, data: alert };
    res.json(response);
  } catch (error) {
    console.error('Failed to update alert:', error);
    res.status(500).json({ success: false, error: 'Failed to update alert' });
  }
});

// DELETE /:id — Delete an alert
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid alert ID' });
      return;
    }

    const deleted = deleteAlert(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Failed to delete alert:', error);
    res.status(500).json({ success: false, error: 'Failed to delete alert' });
  }
});

export default router;
