import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole, UserStatus } from '@turizm-pazaryeri/shared';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus, { message: 'status active | banned | pending olmalı' })
  status: UserStatus;
}

export class ApproveProviderDto {
  // Ek not (opsiyonel) — sağlayıcıya bildirim metnine eklenebilir
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectProviderDto {
  @IsString()
  @MinLength(3, { message: 'Red gerekçesi en az 3 karakter olmalı' })
  @MaxLength(500, { message: 'Red gerekçesi en fazla 500 karakter olmalı' })
  reason: string;
}

export class ApproveServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectServiceDto {
  @IsString()
  @MinLength(3, { message: 'Red gerekçesi en az 3 karakter olmalı' })
  @MaxLength(500, { message: 'Red gerekçesi en fazla 500 karakter olmalı' })
  reason: string;
}

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  iconName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  iconName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1)
  isActive?: boolean;
}

export class CreateCityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}

export class UpdateCityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1)
  isActive?: boolean;
}

export class UpdateSettingsDto {
  // value: JSON-serializable — zod veya Prisma'da String; biz objeye çevirip JSON.stringify ederiz
  // Bu yüzden ekstra validasyon service katmanında yapılır.
  value: any;
}

export class ListQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  sort?: string;
}
