import { Router, Request, Response } from 'express';
import { getNotifications } from '../database/models/notification';
import type { ApiResponse, Notification } from '../../shared/types';

const router = Router();

// GET / — List notifications
router.get('/', (req: Request, res: Response) => {
  try {
    const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 50 : rawLimit), 500);
    const productId = req.query.product_id
      ? parseInt(req.query.product_id as string, 10)
      : undefined;

    const notifications = getNotifications(limit, productId);
    const response: ApiResponse<Notification[]> = { success: true, data: notifications };
    res.json(response);
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

export default router;
