import { CONFIG } from '../../shared/config';
import type { NotificationPayload } from '../../shared/types';

const TELEGRAM_API = 'https://api.telegram.org';

export async function sendTelegramNotification(payload: NotificationPayload): Promise<boolean> {
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
    console.log('[DEV MODE] Telegram notification:');
    console.log(`   ${payload.productName}: ${payload.currency}${payload.oldPrice.toFixed(2)} -> ${payload.currency}${payload.newPrice.toFixed(2)} (${payload.changePercent > 0 ? '+' : ''}${payload.changePercent.toFixed(1)}%)`);
    return true;
  }

  const message = buildTelegramMessage(payload);

  try {
    const url = `${TELEGRAM_API}/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', response.status, error);
      return false;
    }

    const data = await response.json() as { ok: boolean };
    return data.ok === true;
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    return false;
  }
}

function buildTelegramMessage(payload: NotificationPayload): string {
  const isDown = payload.newPrice < payload.oldPrice;
  const arrow = isDown ? '📉' : '📈';
  const direction = isDown ? 'dropped' : 'increased';
  const changeSign = payload.changePercent > 0 ? '+' : '';

  return [
    `${arrow} <b>Price Alert</b>`,
    ``,
    `<b>${escapeHtml(payload.productName)}</b>`,
    ``,
    `Price ${direction}:`,
    `<s>${payload.currency}${payload.oldPrice.toFixed(2)}</s> → <b>${payload.currency}${payload.newPrice.toFixed(2)}</b>`,
    `Change: <b>${changeSign}${payload.changePercent.toFixed(1)}%</b>`,
    ``,
    `<a href="${escapeHtml(payload.productUrl)}">View Product</a>`,
  ].join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
