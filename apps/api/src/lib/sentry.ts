/**
 * Sentry entegrasyonu (opsiyonel).
 *
 * @sentry/node paketi yoksa sessizce fallback yapar (console.log).
 * Üretimde SENTRY_DSN env var ile aktive edilir.
 *
 * Kullanım:
 *   import { captureException, captureMessage, setTag } from '@/lib/sentry';
 *   captureException(new Error('Payment failed'), { tags: { feature: 'payment' } });
 *
 * Kritik olay işaretleme (Faz-8):
 *   - Ödeme başarısız: captureMessage('Payment failed', 'error', { tags: { feature: 'payment', reservationId } })
 *   - İade başarılı: captureMessage('Refund processed', 'info', { tags: { feature: 'refund', reservationId } })
 *   - Webhook imza hatası: captureException(new Error('Webhook signature mismatch'), { tags: { feature: 'webhook' } })
 */

const SENTRY_DSN = process.env.SENTRY_DSN;

let sentryInstance: any = null;

try {
  if (SENTRY_DSN && process.env.NODE_ENV === 'production') {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1,
    });
    sentryInstance = Sentry;
    console.log('[Sentry] Initialized');
  } else {
    console.log('[Sentry] Not initialized (no DSN or not production)');
  }
} catch (e) {
  console.warn('[Sentry] Init failed, falling back to console:', (e as Error).message);
}

export function captureException(error: Error, context?: {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: { id: string; email?: string };
}): void {
  if (sentryInstance) {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([k, v]) => sentryInstance.setTag(k, v));
    }
    if (context?.extra) {
      Object.entries(context.extra).forEach(([k, v]) => sentryInstance.setExtra(k, v));
    }
    if (context?.user) {
      sentryInstance.setUser(context.user);
    }
    sentryInstance.captureException(error);
  }
  console.error(`[ERROR] ${error.message}`, error.stack, context);
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}): void {
  if (sentryInstance) {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([k, v]) => sentryInstance.setTag(k, v));
    }
    if (context?.extra) {
      Object.entries(context.extra).forEach(([k, v]) => sentryInstance.setExtra(k, v));
    }
    sentryInstance.captureMessage(message, level);
  }
  const prefix = level === 'error' ? '[ERROR]' : level === 'warning' ? '[WARN]' : '[INFO]';
  console.log(`${prefix} ${message}`, context);
}

export function setUser(user: { id: string; email?: string; role?: string }): void {
  if (sentryInstance) {
    sentryInstance.setUser(user);
  }
}

export function setTag(key: string, value: string): void {
  if (sentryInstance) {
    sentryInstance.setTag(key, value);
  }
}
