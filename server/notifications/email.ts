import { Resend } from 'resend';
import { CONFIG } from '../../shared/config';
import { logger } from '../logger';
import type { NotificationPayload } from '../../shared/types';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!CONFIG.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(CONFIG.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendEmail(payload: NotificationPayload): Promise<boolean> {
  const client = getResendClient();

  if (!client) {
    logger.info({ to: payload.to, subject: payload.subject, product: payload.productName }, 'Email notification (dev mode)');
    return true;
  }

  const html = buildEmailHtml(payload);

  try {
    await client.emails.send({
      from: CONFIG.NOTIFICATION_FROM_EMAIL,
      to: payload.to,
      subject: payload.subject,
      html,
    });
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Failed to send email');
    return false;
  }
}

function buildEmailHtml(payload: NotificationPayload): string {
  const isDown = payload.newPrice < payload.oldPrice;
  const arrowColor = isDown ? '#16a34a' : '#dc2626';
  const arrow = isDown ? '↓' : '↑';
  const changeText = `${arrow} ${Math.abs(payload.changePercent).toFixed(1)}%`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background:#1e293b;padding:24px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:20px;">Price Alert</h1>
      </div>

      <!-- Content -->
      <div style="padding:32px 24px;">
        <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b;">${escapeHtml(payload.productName)}</h2>

        <!-- Price Change -->
        <div style="background:#f8fafc;border-radius:8px;padding:24px;margin:16px 0;text-align:center;">
          <div style="font-size:14px;color:#64748b;margin-bottom:8px;">Price ${isDown ? 'dropped' : 'increased'}</div>
          <div style="display:flex;justify-content:center;align-items:center;gap:16px;">
            <span style="font-size:24px;color:#94a3b8;text-decoration:line-through;">${payload.currency}${payload.oldPrice.toFixed(2)}</span>
            <span style="font-size:20px;">&rarr;</span>
            <span style="font-size:28px;font-weight:700;color:${arrowColor};">${payload.currency}${payload.newPrice.toFixed(2)}</span>
          </div>
          <div style="margin-top:8px;font-size:16px;font-weight:600;color:${arrowColor};">${changeText}</div>
        </div>

        <!-- CTA Button -->
        <div style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(payload.productUrl)}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:16px;">View Product</a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">Powered by Competitor Price Tracker</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
