import {
  DiscountType,
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  PricingUnit,
  ProviderStatus,
  RefundStatus,
  ReservationStatus,
  ReviewStatus,
  ScheduleStatus,
  ServiceSortOption,
  ServiceStatus,
  UserStatus,
  UserRole,
} from './enums';

/**
 * Standart API yanıt formatı (00-ortak-baglam.txt A7)
 * Başarı: { success: true, data }
 * Hata   : { success: false, message, statusCode, errors? }
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  statusCode: number;
  errors?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
}

export type ApiResult<T = unknown> = ApiResponse<T> | ApiErrorResponse;

/**
 * Tüm listeleme endpoint'leri page, limit, sort parametreleri + toplam kayıt döner
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
}

export interface PaginatedData<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

/**
 * UUID tipi — Prisma UUID alanları ile uyumlu
 */
export type UUID = string;

/**
 * ISO 8601 tarih string'i (backend'te Date'e çevrilir)
 */
export type ISODateString = string;

/**
 * Coğrafi koordinat
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Hizmet listeleme filtre parametreleri (GET /api/services)
 */
export interface ServiceListQuery extends PaginationParams {
  city?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  date?: ISODateString;
  search?: string;
  sort?: ServiceSortOption | string;
}

/**
 * Admin filtre parametreleri
 */
export interface AdminUserListQuery extends PaginationParams {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}

export interface AdminProviderListQuery extends PaginationParams {
  status?: ProviderStatus;
}

export interface AdminServiceListQuery extends PaginationParams {
  status?: ServiceStatus;
}

export interface ProviderEarningsQuery {
  from?: ISODateString;
  to?: ISODateString;
}

/**
 * Auth payload (JWT access token içeriği)
 */
export interface JwtAccessPayload {
  sub: UUID;
  role: UserRole;
  status: UserStatus;
  providerId?: UUID | null;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: UUID;
  tokenFamily?: string;
  iat?: number;
  exp?: number;
}

/**
 * DTO örnekleri (sadece tipler — class-validator dekoratörleri API tarafında uygulanır)
 */
export interface RegisterDto {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: UserRole.PROVIDER | UserRole.USER;
  // PROVIDER rolü için ek alanlar (apply endpoint'inde doldurulur)
  companyName?: string;
  taxNumber?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface CreateReservationDto {
  serviceId: UUID;
  scheduleId: UUID;
  pricingId: UUID;
  participantCount: number;
  couponCode?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

export interface CreateServiceDto {
  categoryId: UUID;
  cityId: UUID;
  title: string;
  description: string;
  meetingPoint?: string;
  latitude?: number;
  longitude?: number;
  durationHours?: number;
}

export interface CreatePricingDto {
  name: string;
  price: number;
  currency?: string;
  unit: PricingUnit;
  description?: string;
  isActive?: boolean;
}

export interface CreateScheduleDto {
  startAt: ISODateString;
  endAt: ISODateString;
  capacity: number;
  status?: ScheduleStatus;
}

export interface CreateCouponDto {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minAmount?: number;
  validFrom: ISODateString;
  validTo: ISODateString;
  usageLimit?: number;
  isActive?: boolean;
}

/**
 * Domain entity tipleri (Prisma modelleri ile birebir eşleşir)
 * — seçili alanlar, ileride genişletilebilir
 */
export interface UserEntity {
  id: UUID;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ServiceProviderEntity {
  id: UUID;
  userId: UUID;
  companyName: string;
  taxNumber: string | null;
  phone: string | null;
  description: string | null;
  logoUrl: string | null;
  status: ProviderStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ServiceEntity {
  id: UUID;
  providerId: UUID;
  categoryId: UUID;
  cityId: UUID;
  title: string;
  slug: string;
  description: string | null;
  meetingPoint: string | null;
  latitude: number | null;
  longitude: number | null;
  durationHours: number | null;
  status: ServiceStatus;
  rejectionReason: string | null;
  isFeatured: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ReservationEntity {
  id: UUID;
  reservationCode: string;
  userId: UUID;
  serviceId: UUID;
  scheduleId: UUID;
  pricingId: UUID;
  participantCount: number;
  unitPrice: number;
  totalPrice: number;
  discountAmount: number;
  couponId: UUID | null;
  status: ReservationStatus;
  cancellationReason: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PaymentEntity {
  id: UUID;
  reservationId: UUID;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  providerTransactionId: string | null;
  status: PaymentStatus;
  rawResponse: unknown | null;
  createdAt: ISODateString;
}

export interface RefundEntity {
  id: UUID;
  paymentId: UUID;
  amount: number;
  reason: string | null;
  status: RefundStatus;
  createdAt: ISODateString;
}

export interface ReviewEntity {
  id: UUID;
  serviceId: UUID;
  userId: UUID;
  reservationId: UUID;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: ISODateString;
}

export interface NotificationEntity {
  id: UUID;
  userId: UUID;
  type: NotificationType | string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: ISODateString;
}

/**
 * Dashboard istatistikleri (GET /api/admin/dashboard/stats)
 */
export interface DashboardStats {
  totalUsers: number;
  totalProviders: number;
  totalServices: number;
  publishedServices: number;
  pendingProviders: number;
  pendingServices: number;
  totalReservations: number;
  totalRevenue: number;
  activeReservations: number;
}

/**
 * Sağlayıcı kazanç raporu
 */
export interface ProviderEarningsReport {
  totalRevenue: number;
  platformCommission: number;
  netEarnings: number;
  reservationCount: number;
  completedCount: number;
  cancelledCount: number;
  byService: Array<{
    serviceId: UUID;
    serviceTitle: string;
    count: number;
    revenue: number;
  }>;
}
