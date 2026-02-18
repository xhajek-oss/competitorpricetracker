# Competitor Price Tracker

A price monitoring tool for e-commerce merchants. Track competitor product prices across Amazon, eBay, Shopify, and any online shop. Get notified when prices change.

## Features

- **Multi-Shop Support** — Track products from Amazon, eBay, Shopify, and any website with structured price data
- **Automatic Price Checks** — Schedule checks every 6, 12, or 24 hours
- **Price History Charts** — Visualize price trends over time with interactive charts
- **Smart Alerts** — Get notified on any price change, percentage drops, or when prices fall below a threshold
- **Email Notifications** — Receive professional email alerts via Resend (free tier: 100 emails/day)
- **Clean Dashboard** — Modern, responsive UI that works on desktop and mobile

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [Playwright](https://playwright.dev/) Chromium browser (installed automatically)

### Installation

```bash
git clone https://github.com/kevinjaegle/CompetitorPriceTracker.git
cd CompetitorPriceTracker
npm install
npx playwright install chromium
```

### Configuration

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Required for email notifications (get a free key at https://resend.com)
RESEND_API_KEY=re_your_api_key_here
NOTIFICATION_FROM_EMAIL=alerts@yourdomain.com
NOTIFICATION_TO_EMAIL=your@email.com
```

> **Note:** The app works without a Resend API key — notifications will be logged to the console instead of sent via email. You can add the key later.

### Start the App

```bash
npx tsx server/index.ts
```

Open **http://localhost:3000** in your browser.

## Usage

### Adding a Product

1. Click **"+ Add Product"**
2. Paste a product URL (e.g., `https://www.amazon.de/dp/B0DFSYVGJR`)
3. Optionally set a name and check interval
4. Click **"Add Product"** — the scraper will fetch the current price (takes 10-30 seconds)

### Monitoring Prices

- Products appear as cards on the dashboard with their current price
- Click a product card to see the **price history chart** and **alert settings**
- Use **"Check Now"** to trigger an immediate price check
- The scheduler automatically checks prices based on each product's interval

### Setting Up Alerts

1. Click on a product to open the detail view
2. Click **"+ Add Alert"**
3. Choose an alert type:
   - **Any price change** — triggers on every change
   - **Price drops by X%** — triggers when the price drops by a percentage
   - **Price falls below amount** — triggers when the price goes below a specific value
4. Save the alert

When an alert triggers, you'll receive an email with the old price, new price, and a link to the product.

## Tech Stack

| Component | Technology |
|---|---|
| Backend | Node.js + Express + TypeScript |
| Database | SQLite (via better-sqlite3) |
| Frontend | Plain HTML/CSS/JS + Chart.js |
| Scraping | Playwright (Chromium) |
| Email | Resend API |
| Scheduling | node-cron |

## Project Structure

```
competitor-price-tracker/
├── shared/                    # Shared types and config
│   ├── types.ts               # TypeScript type definitions
│   └── config.ts              # Central configuration
├── server/                    # Backend
│   ├── index.ts               # Express server entry point
│   ├── routes/                # REST API endpoints
│   │   ├── products.ts        # Product CRUD
│   │   ├── prices.ts          # Price history + manual check
│   │   ├── alerts.ts          # Alert CRUD
│   │   └── notifications.ts   # Notification listing
│   ├── scraper/               # Price scraping engine
│   │   ├── index.ts           # Scraper orchestrator
│   │   ├── priceParser.ts     # Shared price parsing (EUR/USD/GBP)
│   │   ├── amazon.ts          # Amazon scraper
│   │   ├── ebay.ts            # eBay scraper
│   │   ├── shopify.ts         # Shopify scraper
│   │   └── generic.ts         # Fallback scraper (JSON-LD, meta tags)
│   ├── scheduler/             # Automatic price checks
│   │   └── priceChecker.ts    # Hourly cron job
│   ├── database/              # Data layer
│   │   ├── connection.ts      # SQLite connection (singleton)
│   │   ├── migrations/        # Database schema migrations
│   │   ├── models/            # CRUD functions per table
│   │   └── priceDetection.ts  # Price change detection + alert evaluation
│   └── notifications/         # Alert delivery
│       ├── email.ts           # Resend email service
│       ├── telegram.ts        # Telegram stub (v2)
│       └── queue.ts           # Alert processing queue
├── client/                    # Frontend (served statically)
│   ├── index.html             # Single page app
│   ├── css/style.css          # Design system
│   └── js/                    # Application logic
│       ├── api.js             # REST API client
│       ├── app.js             # Main controller
│       ├── dashboard.js       # Product list + detail views
│       ├── charts.js          # Chart.js price charts
│       └── alerts.js          # Alert management UI
└── docs/                      # Documentation
    └── api-contract.md        # Full API specification
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | List all tracked products |
| `POST` | `/api/products` | Add a product (auto-scrapes price) |
| `GET` | `/api/products/:id` | Get product details |
| `PUT` | `/api/products/:id` | Update product settings |
| `DELETE` | `/api/products/:id` | Delete product + history |
| `GET` | `/api/products/:id/prices` | Get price history |
| `POST` | `/api/products/:id/check` | Trigger manual price check |
| `GET` | `/api/alerts` | List alerts |
| `POST` | `/api/alerts` | Create an alert |
| `PUT` | `/api/alerts/:id` | Update an alert |
| `DELETE` | `/api/alerts/:id` | Delete an alert |
| `GET` | `/api/notifications` | List sent notifications |

See [docs/api-contract.md](docs/api-contract.md) for full API documentation.

## Scraping Notes

The scraper uses Playwright to render pages in a real Chromium browser. Success rates vary by shop:

| Shop | Success Rate | Notes |
|---|---|---|
| Amazon | ~70-80% | Actively blocks scrapers; multiple selector fallbacks |
| eBay | ~85% | More reliable; uses structured data |
| Shopify | ~90% | Uses JSON-LD structured data |
| Generic | ~50-60% | Tries JSON-LD, meta tags, common CSS selectors |

**Tips for better scraping:**
- Use product page URLs directly (not search result pages)
- Amazon works best with `.de` / `.com` product pages (`/dp/` URLs)
- If a scrape fails, try "Check Now" again — some failures are transient

## Development

```bash
# Start in development mode (auto-reload on changes)
npx tsx watch server/index.ts

# Type check
npx tsc --noEmit

# Build for production
npx tsc
node dist/server/index.js
```

## Roadmap (v2 Ideas)

- [ ] Multi-user support with authentication
- [ ] Price comparison across shops for the same product
- [ ] Browser extension for quick URL adding
- [ ] CSV/Excel export of price data
- [ ] Telegram bot notifications
- [ ] Webhook integrations
- [ ] Deployment guide (Railway, Fly.io, Hetzner)

## License

MIT
