import express from 'express';
import cors from 'cors';
import path from 'path';
import { CONFIG } from '../shared/config';
import { getDb } from './database/connection';
import { startScheduler } from './scheduler/priceChecker';

// Import routes
import productsRouter from './routes/products';
import pricesRouter from './routes/prices';
import alertsRouter from './routes/alerts';
import notificationsRouter from './routes/notifications';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'client')));

// API Routes
app.use('/api/products', productsRouter);
app.use('/api', pricesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/notifications', notificationsRouter);

// Initialize database
getDb();

// Start scheduler
startScheduler();

// Start server
app.listen(CONFIG.PORT, () => {
  console.log(`Price Tracker running at http://localhost:${CONFIG.PORT}`);
  console.log(`Dashboard: http://localhost:${CONFIG.PORT}`);
  console.log(`API: http://localhost:${CONFIG.PORT}/api`);
});
