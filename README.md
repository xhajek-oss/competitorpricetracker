# Competitor Price Tracker

Self-hosted price monitoring tool for e-commerce. Track competitor prices across Amazon, eBay, Shopify, and any online shop. Get notified instantly when prices change via Email, Telegram, or Webhook.

![License](https://img.shields.io/github/license/kevinjaegle/CompetitorPriceTracker)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Tests](https://img.shields.io/badge/tests-144%20passed-brightgreen)
![Docker](https://img.shields.io/badge/docker-ready-blue)

## Features

**Core**
- **Multi-Shop Scraping** — Amazon, eBay, Shopify, and generic shops with automatic detection
- **Automatic Price Checks** — Schedule checks every 6, 12, or 24 hours
- **Price History Charts** — Interactive Chart.js graphs with time-based x-axis
- **Smart Alerts** — Trigger on any change, percentage drops, or absolute price thresholds

**Notifications**
- **Email** via [Resend](https://resend.com) (free tier: 100 emails/day)
- **Telegram** via Bot API
- **Webhook** — JSON POST to any URL on price changes
- Combine methods per alert (e.g. Email + Telegram)

**Dashboard**
- **Multi-Product Comparison** — Overlay price trends for multiple products on one chart
- **Price Change Indicators** — See price movements at a glance with percentage badges
- **Dark Mode** — Toggle between light and dark themes, saved in browser
- **CSV Import/Export** — Bulk import products from CSV, export price history

**Security & Ops**
- **API Key Authentication** — Single key or multi-user with labeled keys
- **Rate Limiting** — Separate limits for API requests and scraping
- **Prometheus Metrics** — `/metrics` endpoint for Grafana/monitoring
- **Structured Logging** — JSON logs via Pino
- **Auto Backups** — Daily SQLite backups at 03:00 with 7-day rotation
- **Scraper Resilience** — Retry with exponential backoff, browser context isolation, proxy support
- **Docker Ready** — Multi-stage Dockerfile with health check

## Quick Start

### Prerequisites

- Node.js >= 20
- npm

### Install & Run

```bash
git clone https://github.com/kevinjaegle/CompetitorPriceTracker.git
cd CompetitorPriceTracker
npm install
npx playwright install chromium

cp .env.example .env  # edit as needed

npm run dev
```

Open **http://localhost:3000** in your browser.

### Docker

```bash
docker build -t price-tracker .
docker run -d \
  -p 3000:3000 \
  -v price-data:/app/data \
  --env-file .env \
  price-tracker
```

## Usage

### Adding a Product

1. Click **"+ Add Product"**
2. Paste a product URL (e.g. `https://www.amazon.de/dp/B0DFSYVGJR`)
3. Optionally set a name and check interval
4. Click **"Add Product"** — the scraper fetches the current price (10-30 seconds)

### Bulk Import

1. Click **"Import CSV"**
2. Upload a CSV file with format: `url,name,check_interval` (one product per line)
3. The system validates URLs and imports all products at once

### Setting Up Alerts

1. Click on a product to open the detail view
2. Click **"+ Add Alert"**
3. Choose alert type and notification method
4. Save — you'll be notified when conditions are met

### Price Comparison

1. Click **"Compare"** from the product list
2. Select 2+ products to overlay their price charts
3. Color-coded lines show each product's trend over time

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `API_KEY` | Single API key for authentication | _(empty = no auth)_ |
| `API_KEYS` | Multi-user keys: `admin:key1,reader:key2` | _(empty)_ |
| `RESEND_API_KEY` | [Resend](https://resend.com) API key for emails | |
| `NOTIFICATION_FROM_EMAIL` | Sender email address | |
| `NOTIFICATION_TO_EMAIL` | Recipient email address | |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from [@BotFather](https://t.me/BotFather) | |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for notifications | |
| `WEBHOOK_URL` | URL to receive JSON POST on price changes | |
| `PROXY_URL` | Route scraper through proxy (http/https/socks5) | |
| `SCRAPER_TIMEOUT_MS` | Page load timeout in ms | `30000` |
| `SCRAPER_HEADLESS` | Run browser headless | `true` |

> **Note:** The app works without any notification keys configured — you can add them later.

## API

All endpoints under `/api` require the `X-API-Key` header when authentication is enabled.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check (public) |
| `GET` | `/api/products` | List all products with current prices |
| `POST` | `/api/products` | Add product `{url, name?, check_interval?}` |
| `GET` | `/api/products/:id` | Get product details |
| `PUT` | `/api/products/:id` | Update product settings |
| `DELETE` | `/api/products/:id` | Delete product and all price history |
| `POST` | `/api/products/:id/check` | Trigger immediate price check |
| `POST` | `/api/products/import` | Bulk import from CSV `{csv: "url,name,interval\n..."}` |
| `GET` | `/api/products/:id/prices` | Price history (supports `?limit=` and `?from=`) |
| `GET` | `/api/alerts` | List alerts (supports `?product_id=`) |
| `POST` | `/api/alerts` | Create alert |
| `PUT` | `/api/alerts/:id` | Update alert |
| `DELETE` | `/api/alerts/:id` | Delete alert |
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/notifications` | Notification history |
| `GET` | `/api/auth/check` | Check if auth is required/valid |
| `GET` | `/metrics` | Prometheus metrics (public) |

See [docs/api-contract.md](docs/api-contract.md) for the full API specification.

### Alert Types

| Type | Description |
|---|---|
| `price_change_any` | Notify on any price change |
| `price_drop_percent` | Notify when price drops by X% |
| `price_below` | Notify when price falls below a threshold |

## Scraping Notes

The scraper uses Playwright to render pages in a real Chromium browser. It retries up to 3 times with exponential backoff on failure.

| Shop | Method | Notes |
|---|---|---|
| Amazon | CSS selectors with fallbacks | Multiple price element selectors |
| eBay | CSS selectors | Reliable structured data |
| Shopify | JSON-LD structured data | High success rate |
| Generic | JSON-LD, meta tags, CSS heuristics | Best-effort for unknown shops |

**Tips:**
- Use product page URLs directly (not search results)
- Amazon works best with `/dp/` URLs
- If a scrape fails, try "Check Now" again — some failures are transient
- Use `PROXY_URL` to route through a proxy if your IP gets blocked

## Project Structure

```
CompetitorPriceTracker/
├── client/                    # Frontend (vanilla JS, no build step)
│   ├── index.html
│   ├── css/style.css          # Design system with dark mode
│   └── js/
│       ├── api.js             # REST API client
│       ├── app.js             # Main controller, themes, CSV, comparison
│       ├── charts.js          # Chart.js price charts
│       ├── alerts.js          # Alert management UI
│       └── dashboard.js       # Product list & detail views
├── server/                    # Express + TypeScript backend
│   ├── index.ts               # App setup, middleware, auth
│   ├── backup.ts              # Daily SQLite backup with rotation
│   ├── logger.ts              # Pino structured logging
│   ├── database/
│   │   ├── connection.ts      # SQLite connection
│   │   ├── migrations/        # Schema migrations
│   │   ├── models/            # Product, Price, Alert, Notification
│   │   └── priceDetection.ts  # Change detection + alert evaluation
│   ├── scraper/
│   │   ├── browser.ts         # Shared Playwright browser instance
│   │   ├── index.ts           # Orchestrator with retry logic
│   │   ├── priceParser.ts     # Multi-currency price parsing
│   │   ├── amazon.ts          # Amazon scraper
│   │   ├── ebay.ts            # eBay scraper
│   │   ├── shopify.ts         # Shopify scraper
│   │   └── generic.ts         # Generic fallback scraper
│   ├── notifications/
│   │   ├── email.ts           # Resend email
│   │   ├── telegram.ts        # Telegram Bot API
│   │   ├── webhook.ts         # Webhook POST
│   │   └── queue.ts           # Notification dispatcher
│   ├── routes/                # REST API route handlers
│   │   ├── products.ts        # Product CRUD + import
│   │   ├── prices.ts          # Price history + manual check
│   │   ├── alerts.ts          # Alert CRUD
│   │   ├── notifications.ts   # Notification listing
│   │   ├── stats.ts           # Dashboard statistics
│   │   └── metrics.ts         # Prometheus metrics
│   └── scheduler/
│       └── priceChecker.ts    # Hourly cron job
├── shared/
│   ├── types.ts               # TypeScript type definitions
│   └── config.ts              # Central configuration
├── tests/                     # 144 tests (Vitest + Supertest)
│   ├── unit/                  # Price parser, shop detection, URL safety
│   ├── database/              # Model CRUD, price detection
│   └── routes/                # API integration tests
├── Dockerfile                 # Multi-stage production build
├── .env.example               # All configuration options
└── package.json
```

## Development

```bash
npm run dev          # Start with auto-reload (tsx watch)
npm test             # Run all 144 tests
npm run test:watch   # Tests in watch mode
npm run build        # TypeScript build
npm start            # Start production build
```

## Tech Stack

| Component | Technology |
|---|---|
| Backend | Express + TypeScript |
| Database | SQLite via better-sqlite3 |
| Frontend | Vanilla JS + Chart.js |
| Scraping | Playwright (Chromium) |
| Email | Resend API |
| Messaging | Telegram Bot API |
| Logging | Pino |
| Testing | Vitest + Supertest |
| Scheduling | node-cron |

## License

[MIT](LICENSE)
