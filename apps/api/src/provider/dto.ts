import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PricingUnit, ScheduleStatus, ServiceStatus } from '@turizm-pazaryeri/shared';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------
export class UpdateProviderProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}

// -----------------------------------------------------------------------------
// Apply (user → provider başvurusu)
// -----------------------------------------------------------------------------
export class ProviderApplyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName!: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

// -----------------------------------------------------------------------------
// Service (Step 1: temel bilgiler)
// -----------------------------------------------------------------------------
export class CreateServiceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsString()
  categoryId!: string;

  @IsString()
  cityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingPoint?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(720)
  durationHours?: number;
}

export class UpdateServiceDto extends CreateServiceDto {}

// -----------------------------------------------------------------------------
// Service images (Step 2)
// -----------------------------------------------------------------------------
export class AddServiceImageDto {
  @IsString()
  imageUrl!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}

export class UpdateServiceImageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}

// -----------------------------------------------------------------------------
// Pricing (Step 3)
// -----------------------------------------------------------------------------
export class CreatePricingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = 'TRY';

  @IsEnum(PricingUnit, { message: 'unit: per_person | per_group' })
  unit!: PricingUnit;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdatePricingDto extends CreatePricingDto {}

// -----------------------------------------------------------------------------
// Schedules (Step 4)
// -----------------------------------------------------------------------------
export class CreateScheduleDto {
  @IsString()
  startAt!: string; // ISO string

  @IsString()
  endAt!: string; // ISO string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity!: number;

  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus = ScheduleStatus.OPEN;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity?: number;

  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;
}

/**
 * Toplu gün ekleme: bir tarih aralığındaki her gün için,
 * belirtilen saatte schedule üretir.
 */
export class BulkCreateSchedulesDto {
  @IsString()
  startDate!: string; // YYYY-MM-DD

  @IsString()
  endDate!: string; // YYYY-MM-DD

  @IsString()
  startTime!: string; // HH:mm

  @IsString()
  endTime!: string; // HH:mm

  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @ValidateIf((o) => o.weekdays !== undefined)
  @Transform(({ value }) => (Array.isArray(value) ? value : String(value).split(',').map((s: string) => parseInt(s, 10))))
  weekdays?: number[]; // 0=Sunday..6=Saturday
}

// -----------------------------------------------------------------------------
// Reservation actions
// -----------------------------------------------------------------------------
export class ConfirmReservationDto {}

export class CancelReservationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
