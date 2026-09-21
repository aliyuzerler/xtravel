/**
 * Kullanıcı rolleri (00-ortak-baglam.txt A5 Rol Matrisi)
 *
 * - SUPER_ADMIN : Platform yöneticisi (tüm yetkiler)
 * - PROVIDER    : Hizmet sağlayıcı (kendi hizmetlerini yönetir)
 * - USER        : Son kullanıcı (rezervasyon yapar, ödeme yapar)
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  PROVIDER = 'provider',
  USER = 'user',
}

export const USER_ROLES: readonly UserRole[] = Object.freeze([
  UserRole.SUPER_ADMIN,
  UserRole.PROVIDER,
  UserRole.USER,
]);

/**
 * Kullanıcı durumu
 */
export enum UserStatus {
  ACTIVE = 'active',
  BANNED = 'banned',
  PENDING = 'pending',
}

/**
 * Sağlayıcı (service_providers.status) durumu
 */
export enum ProviderStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

/**
 * Hizmet (services.status) durumu
 */
export enum ServiceStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  PAUSED = 'paused',
}

/**
 * Fiyatlandırma birimi (service_pricing.unit)
 */
export enum PricingUnit {
  PER_PERSON = 'per_person',
  PER_GROUP = 'per_group',
}

/**
 * Takvim slotu durumu (service_schedules.status)
 */
export enum ScheduleStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

/**
 * Rezervasyon durumu (reservations.status)
 */
export enum ReservationStatus {
  PENDING_PAYMENT = 'pending_payment',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/**
 * Ödeme sağlayıcı (payments.provider)
 */
export enum PaymentProvider {
  IYZICO = 'iyzico',
  PAYTR = 'paytr',
  MANUAL = 'manual',
}

/**
 * Ödeme durumu (payments.status)
 */
export enum PaymentStatus {
  INITIATED = 'initiated',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

/**
 * İade durumu (refunds.status)
 */
export enum RefundStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Kupon indirim tipi (coupons.discount_type)
 */
export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

/**
 * Bildirim tipleri (notifications.type) — şema VARCHAR(50) serbest
 */
export enum NotificationType {
  RESERVATION_CONFIRMED = 'reservation_confirmed',
  RESERVATION_CANCELLED = 'reservation_cancelled',
  RESERVATION_COMPLETED = 'reservation_completed',
  SERVICE_APPROVED = 'service_approved',
  SERVICE_REJECTED = 'service_rejected',
  PROVIDER_APPROVED = 'provider_approved',
  PROVIDER_REJECTED = 'provider_rejected',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  REFUND_PROCESSED = 'refund_processed',
  GENERIC = 'generic',
}

/**
 * Yorum durumu (reviews.status) — Faz 7'de devreye girer
 */
export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Hizmet listeleme sıralama seçenekleri (public API)
 */
export enum ServiceSortOption {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  DURATION_ASC = 'duration_asc',
  DURATION_DESC = 'duration_desc',
  POPULAR = 'popular',
  FEATURED = 'featured',
}
