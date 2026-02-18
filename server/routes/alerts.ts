import { Router, Request, Response } from 'express';
import { getAlerts, createAlert, updateAlert, deleteAlert } from '../database/models/alert';
import type { ApiResponse, Alert, CreateAlertRequest, UpdateAlertRequest } from '../../shared/types';

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
    const message = error instanceof Error ? error.message : 'Failed to fetch alerts';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

// POST / — Create a new alert
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as CreateAlertRequest;

    if (!body.product_id || !body.alert_type) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'product_id and alert_type are required',
      };
      res.status(400).json(response);
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
    const message = error instanceof Error ? error.message : 'Failed to create alert';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

// PUT /:id — Update an alert
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      const response: ApiResponse<never> = { success: false, error: 'Invalid alert ID' };
      res.status(400).json(response);
      return;
    }

    const body = req.body as UpdateAlertRequest;
    const alert = updateAlert(id, {
      alert_type: body.alert_type,
      threshold_percent: body.threshold_percent,
      threshold_price: body.threshold_price,
      notification_method: body.notification_method,
      is_active: body.is_active,
    });

    if (!alert) {
      const response: ApiResponse<never> = { success: false, error: 'Alert not found' };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Alert> = { success: true, data: alert };
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update alert';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

// DELETE /:id — Delete an alert
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      const response: ApiResponse<never> = { success: false, error: 'Invalid alert ID' };
      res.status(400).json(response);
      return;
    }

    const deleted = deleteAlert(id);
    if (!deleted) {
      const response: ApiResponse<never> = { success: false, error: 'Alert not found' };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<{ deleted: true }> = { success: true, data: { deleted: true } };
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete alert';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

export default router;
