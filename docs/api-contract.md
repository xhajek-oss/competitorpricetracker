# API Contract — Competitor Price Tracker v1

> This is the single source of truth for all API endpoints.
> All agents MUST implement against this contract.
> Changes require Lead Agent approval.

## Base URL

```
http://localhost:3000/api
```

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

---

## Products

### `GET /api/products`

List all tracked products.

**Response:** `ApiResponse<Product[]>`

### `POST /api/products`

Add a new product to track.

**Request Body:**
```json
{
  "url": "https://www.amazon.de/dp/B0EXAMPLE",
  "name": "Optional product name",
  "check_interval": 24
}
```

- `url` (required): Product URL
- `name` (optional): Display name. If omitted, scraper will try to extract it.
- `check_interval` (optional): Hours between checks. Default: 24. Allowed: 6, 12, 24.

**Response:** `ApiResponse<Product>`

**Behavior:**
1. Validates the URL
2. Detects shop type (amazon/ebay/shopify/generic)
3. Performs initial price scrape
4. Creates product with current price
5. Creates a default alert (price_change_any, email)

### `GET /api/products/:id`

Get a single product with its current price.

**Response:** `ApiResponse<Product>`

### `PUT /api/products/:id`

Update product settings.

**Request Body:**
```json
{
  "name": "New name",
  "check_interval": 12,
  "is_active": true
}
```

All fields optional.

**Response:** `ApiResponse<Product>`

### `DELETE /api/products/:id`

Remove a product and all its price history and alerts.

**Response:** `ApiResponse<{ deleted: true }>`

---

## Price History

### `GET /api/products/:id/prices`

Get price history for a product.

**Query Parameters:**
- `limit` (optional): Number of records. Default: 100.
- `from` (optional): ISO date string. Only records after this date.

**Response:** `ApiResponse<PriceRecord[]>`

### `POST /api/products/:id/check`

Trigger an immediate price check for a product.

**Response:** `ApiResponse<{ product: Product, price_record: PriceRecord, changed: boolean }>`

**Behavior:**
1. Scrapes the current price
2. Saves to price_history
3. Updates product.current_price and product.last_checked_at
4. If price changed: triggers alert evaluation
5. Returns whether price changed

---

## Alerts

### `GET /api/alerts`

List all alerts. Optionally filter by product.

**Query Parameters:**
- `product_id` (optional): Filter by product ID.

**Response:** `ApiResponse<Alert[]>`

### `POST /api/alerts`

Create a new alert.

**Request Body:**
```json
{
  "product_id": 1,
  "alert_type": "price_drop_percent",
  "threshold_percent": 10,
  "notification_method": "email"
}
```

- `product_id` (required): Which product this alert belongs to.
- `alert_type` (required): One of `price_drop_percent`, `price_change_any`, `price_below`.
- `threshold_percent` (optional): Required for `price_drop_percent`. Percentage drop to trigger.
- `threshold_price` (optional): Required for `price_below`. Absolute price to trigger below.
- `notification_method` (optional): Default: `email`. Options: `email`, `telegram`, `both`.

**Response:** `ApiResponse<Alert>`

### `PUT /api/alerts/:id`

Update an alert.

**Response:** `ApiResponse<Alert>`

### `DELETE /api/alerts/:id`

Delete an alert.

**Response:** `ApiResponse<{ deleted: true }>`

---

## Notifications

### `GET /api/notifications`

List recent notifications.

**Query Parameters:**
- `limit` (optional): Default: 50.
- `product_id` (optional): Filter by product.

**Response:** `ApiResponse<Notification[]>`

---

## Shop Type Detection

The backend auto-detects the shop type from the URL:

| Pattern | Shop Type |
|---|---|
| `amazon.de`, `amazon.com`, `amazon.*` | `amazon` |
| `ebay.de`, `ebay.com`, `ebay.*` | `ebay` |
| `*.myshopify.com` or Shopify meta tags | `shopify` |
| Everything else | `generic` |

---

## Scraper Contract

Each scraper must return a `ScrapeResult`:

```typescript
{
  success: boolean;
  price: number | null;
  currency: string;
  productName: string | null;
  error?: string;
  shopType: ShopType;
}
```

Scrapers are located in `server/scraper/` with one file per shop type:
- `amazon.ts` — Amazon scraper
- `ebay.ts` — eBay scraper
- `shopify.ts` — Shopify scraper
- `generic.ts` — Fallback using meta tags / JSON-LD / schema.org

---

## Price Change Detection (Agent 2 implements)

Located in `server/database/priceDetection.ts`.

**Function:** `detectPriceChange(productId: number, newPrice: number): PriceChange | null`

- Compares newPrice with product.current_price
- Returns null if no change
- Returns PriceChange object with old/new price and percentage

**Function:** `evaluateAlerts(change: PriceChange): Alert[]`

- Checks all active alerts for the product
- Returns alerts that should fire based on the change

---

## Notification Contract (Agent 4 implements)

Located in `server/notifications/`.

**Function:** `sendNotification(payload: NotificationPayload): Promise<Notification>`

- Sends email via Resend
- Logs notification to database
- Returns the notification record

**Function:** `processAlertQueue(alerts: Alert[], change: PriceChange): Promise<void>`

- Takes triggered alerts and the price change
- Sends notifications for each alert
- Handles retries on failure
