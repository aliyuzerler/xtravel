import { IsEmail, IsEnum, IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { UserRole } from '@turizm-pazaryeri/shared';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  // strictPropertyInitialization için: class-validator + Transform ile doldurulur
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalı' })
  @MaxLength(72, { message: 'Şifre en fazla 72 karakter olmalı' })
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/, { message: 'Geçersiz telefon numarası' })
  phone?: string;

  @IsEnum(UserRole, {
    message: `role yalnızca ${UserRole.USER} veya ${UserRole.PROVIDER} olabilir`,
  })
  role!: UserRole.USER | UserRole.PROVIDER;

  // Provider başvurusu için ek alanlar (role=provider ise zorunlu)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,11}$/, { message: 'Vergi/TCKN no 10-11 haneli olmalı' })
  taxNumber?: string;
}

export class LoginDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class ProviderApplyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,11}$/, { message: 'Vergi/TCKN no 10-11 haneli olmalı' })
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Yeni şifre en az 8 karakter olmalı' })
  @MaxLength(72)
  newPassword!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/, { message: 'Geçersiz telefon numarası' })
  phone?: string;
}
