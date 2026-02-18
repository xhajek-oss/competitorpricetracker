// ============================================
// Competitor Price Tracker — Shared Types
// Used by ALL agents. Do NOT modify without
// Lead Agent approval.
// ============================================

// --- Database Models ---

export type ShopType = 'amazon' | 'ebay' | 'shopify' | 'generic';
export type CheckInterval = 6 | 12 | 24;
export type AlertType = 'price_drop_percent' | 'price_change_any' | 'price_below';
export type NotificationMethod = 'email' | 'telegram' | 'webhook' | 'both';
export type NotificationStatus = 'sent' | 'failed' | 'pending';

export interface Product {
  id: number;
  url: string;
  name: string;
  current_price: number | null;
  currency: string;
  shop_type: ShopType;
  check_interval: CheckInterval;
  is_active: boolean;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceRecord {
  id: number;
  product_id: number;
  price: number;
  currency: string;
  checked_at: string;
}

export interface Alert {
  id: number;
  product_id: number;
  alert_type: AlertType;
  threshold_percent: number | null;
  threshold_price: number | null;
  notification_method: NotificationMethod;
  is_active: boolean;
  created_at: string;
}

export interface Notification {
  id: number;
  alert_id: number;
  product_id: number;
  sent_at: string;
  message: string;
  status: NotificationStatus;
}

// --- API Request/Response Types ---

export interface CreateProductRequest {
  url: string;
  name?: string;
  check_interval?: CheckInterval;
}

export interface UpdateProductRequest {
  name?: string;
  check_interval?: CheckInterval;
  is_active?: boolean;
}

export interface CreateAlertRequest {
  product_id: number;
  alert_type: AlertType;
  threshold_percent?: number;
  threshold_price?: number;
  notification_method?: NotificationMethod;
}

export interface UpdateAlertRequest {
  alert_type?: AlertType;
  threshold_percent?: number;
  threshold_price?: number;
  notification_method?: NotificationMethod;
  is_active?: boolean;
}

// --- Scraper Types ---

export interface ScrapeResult {
  success: boolean;
  price: number | null;
  currency: string;
  productName: string | null;
  error?: string;
  shopType: ShopType;
}

// --- API Response Wrapper ---

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- Price Change Detection ---

export interface PriceChange {
  product: Product;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  direction: 'up' | 'down';
}

// --- Notification Payload ---

export interface NotificationPayload {
  to: string;
  subject: string;
  productName: string;
  productUrl: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  currency: string;
}
