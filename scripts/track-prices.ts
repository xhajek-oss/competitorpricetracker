import fs from 'node:fs';
import path from 'node:path';
import { scrapeAmazon } from '../server/scraper/amazon';
import { closeBrowser } from '../server/scraper/browser';

type ProductConfig = {
  name: string;
  url: string;
  drop_percent: number;
  enabled?: boolean;
};

type ProductState = {
  referencePriceEur: number;
  lastPriceEur: number;
  lowestPriceEur: number;
  lastAlertLevel: number;
  lastCheckedAt: string;
};

type State = Record<string, ProductState>;

const PRODUCTS_PATH = path.resolve('data/products.json');
const STATE_PATH = path.resolve('data/state.json');

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function productKey(product: ProductConfig): string {
  const asin = product.url.match(/\/dp\/([A-Z0-9]{10})/i)?.[1]?.toUpperCase();
  return asin || product.url;
}

async function getEurCzkRate(): Promise<number | null> {
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=EUR&to=CZK');
    if (!response.ok) return null;
    const data = await response.json() as { rates?: { CZK?: number } };
    return typeof data.rates?.CZK === 'number' ? data.rates.CZK : null;
  } catch {
    return null;
  }
}

async function sendTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('Telegram secrets are not configured; skipping notification.');
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram API returned ${response.status}: ${await response.text()}`);
  }
}

function formatCzk(value: number): string {
  return `${Math.round(value).toLocaleString('cs-CZ')} Kč`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main(): Promise<void> {
  const products = readJson<ProductConfig[]>(PRODUCTS_PATH, []);
  const state = readJson<State>(STATE_PATH, {});
  const eurCzk = await getEurCzkRate();

  let stateChanged = false;

  for (const product of products) {
    if (product.enabled === false) continue;

    if (!product.url.startsWith('https://www.amazon.de/')) {
      console.warn(`Skipping ${product.name}: only amazon.de URLs are allowed.`);
      continue;
    }

    if (!(product.drop_percent > 0 && product.drop_percent < 100)) {
      console.warn(`Skipping ${product.name}: drop_percent must be between 0 and 100.`);
      continue;
    }

    console.log(`Checking ${product.name}...`);
    const result = await scrapeAmazon(product.url);
    if (!result.success || result.price == null) {
      console.error(`Failed: ${result.error ?? 'unknown scraping error'}`);
      continue;
    }

    if (result.currency !== 'EUR') {
      console.warn(`Skipping ${product.name}: expected EUR, got ${result.currency}.`);
      continue;
    }

    const key = productKey(product);
    const currentPrice = result.price;
    const now = new Date().toISOString();
    const existing = state[key];

    if (!existing) {
      state[key] = {
        referencePriceEur: currentPrice,
        lastPriceEur: currentPrice,
        lowestPriceEur: currentPrice,
        lastAlertLevel: 0,
        lastCheckedAt: now,
      };
      stateChanged = true;
      console.log(`Reference price saved: €${currentPrice.toFixed(2)}`);
      continue;
    }

    const dropPercent = ((existing.referencePriceEur - currentPrice) / existing.referencePriceEur) * 100;
    const alertStep = 5;
    const alertLevel = Math.floor(dropPercent / alertStep) * alertStep;
    const shouldAlert = dropPercent >= product.drop_percent && alertLevel > existing.lastAlertLevel;

    if (dropPercent < product.drop_percent && existing.lastAlertLevel !== 0) {
      existing.lastAlertLevel = 0;
    }

    if (shouldAlert) {
      if (!eurCzk) {
        console.warn(`CZK rate unavailable; postponing alert for ${product.name}.`);
      } else {
        const referenceCzk = existing.referencePriceEur * eurCzk;
        const currentCzk = currentPrice * eurCzk;
        const savingCzk = referenceCzk - currentCzk;

        await sendTelegram([
          '🔥 <b>AMAZON PRICE DROP</b>',
          '',
          `<b>${escapeHtml(product.name)}</b>`,
          '',
          `<s>${formatCzk(referenceCzk)}</s> → <b>${formatCzk(currentCzk)}</b>`,
          '',
          `📉 <b>-${dropPercent.toFixed(1).replace('.', ',')} %</b>`,
          `💰 Ušetříš <b>${formatCzk(savingCzk)}</b>`,
          '',
          `<a href="${escapeHtml(product.url)}">🔗 Zobrazit na Amazon.de</a>`,
        ].join('\n'));

        existing.lastAlertLevel = alertLevel;
        console.log(`Telegram alert sent at -${dropPercent.toFixed(1)}%.`);
      }
    }

    existing.lastPriceEur = currentPrice;
    existing.lowestPriceEur = Math.min(existing.lowestPriceEur, currentPrice);
    existing.lastCheckedAt = now;
    stateChanged = true;

    console.log(`€${currentPrice.toFixed(2)} | drop ${dropPercent.toFixed(1)}%`);
  }

  if (stateChanged) {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser();
  });
