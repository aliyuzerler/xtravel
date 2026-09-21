/**
 * Ortak yardımcı fonksiyonlar.
 */

export function formatPrice(amount: number, currency = 'TRY'): string {
  const symbols: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' };
  return `${symbols[currency] || currency} ${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | Date, withTime = false): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (withTime) {
    return d.toLocaleString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string | Date): string {
  return formatDate(iso, true);
}

export function timeAgo(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const diff = Date.now() - d.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'az önce';
  if (diff < hour) return `${Math.floor(diff / minute)} dk önce`;
  if (diff < day) return `${Math.floor(diff / hour)} saat önce`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} gün önce`;
  return formatDate(d);
}

export function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function categoryIcon(name: string | null): string {
  const map: Record<string, string> = {
    landmark: '🏛️', ship: '🚢', utensils: '🍽️', mountain: '⛰️',
    building: '🏛️', 'map-pin': '📍', test: '🎯',
  };
  return map[name || ''] || '🎯';
}

export function notificationIcon(type: string): string {
  const map: Record<string, string> = {
    reservation_confirmed: '✓',
    reservation_cancelled: '✗',
    reservation_completed: '✓',
    service_approved: '✓',
    service_rejected: '✗',
    provider_approved: '✓',
    provider_rejected: '✗',
    payment_received: '💰',
    payment_failed: '⚠',
    refund_processed: '💰',
    generic: 'ℹ',
  };
  return map[type] || 'ℹ';
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: '#16A34A', approved: '#16A34A', published: '#16A34A', confirmed: '#16A34A',
    completed: '#16A34A', captured: '#16A34A', open: '#16A34A',
    pending: '#F59E0B', pending_approval: '#F59E0B', pending_payment: '#F59E0B',
    initiated: '#F59E0B', authorized: '#F59E0B',
    banned: '#DC2626', rejected: '#DC2626', suspended: '#DC2626',
    failed: '#DC2626', cancelled: '#DC2626', closed: '#DC2626',
    draft: '#94A3B8', refunded: '#0EA5E9', partially_refunded: '#0EA5E9',
  };
  return map[status] || '#94A3B8';
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_payment: 'Ödeme Bekliyor',
    confirmed: 'Onaylı',
    completed: 'Tamamlandı',
    cancelled: 'İptal',
    refunded: 'İade Edildi',
    published: 'Yayında',
    pending_approval: 'Onay Bekliyor',
    rejected: 'Reddedildi',
    draft: 'Taslak',
    paused: 'Duraklatıldı',
    active: 'Aktif',
    banned: 'Banlı',
    pending: 'Beklemede',
    approved: 'Onaylı',
    suspended: 'Askıya Alınmış',
    captured: 'Tahsil Edildi',
    initiated: 'Başlatıldı',
    failed: 'Başarısız',
  };
  return map[status] || status;
}
