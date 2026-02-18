import { chromium, Browser } from 'playwright';
import { CONFIG } from '../../shared/config';
import { logger } from '../logger';

let browser: Browser | null = null;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export { USER_AGENT };

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    const launchOptions: Record<string, unknown> = {
      headless: CONFIG.SCRAPER_HEADLESS,
    };

    // Proxy support
    if (CONFIG.PROXY_URL) {
      launchOptions.proxy = { server: CONFIG.PROXY_URL };
      logger.info({ proxy: CONFIG.PROXY_URL }, 'Launching browser with proxy');
    }

    browser = await chromium.launch(launchOptions);
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
      logger.info('Playwright browser closed');
    } catch {
      /* already closed */
    }
    browser = null;
  }
}
