import { Router, Request, Response } from 'express';
import { getNotifications } from '../database/models/notification';
import type { ApiResponse, Notification } from '../../shared/types';

const router = Router();

// GET / — List notifications
router.get('/', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const productId = req.query.product_id
      ? parseInt(req.query.product_id as string, 10)
      : undefined;

    const notifications = getNotifications(limit, productId);
    const response: ApiResponse<Notification[]> = { success: true, data: notifications };
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch notifications';
    const response: ApiResponse<never> = { success: false, error: message };
    res.status(500).json(response);
  }
});

export default router;
