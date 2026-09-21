import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateReservationDto {
  @IsString()
  serviceId!: string;

  @IsString()
  scheduleId!: string;

  @IsString()
  pricingId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  participantCount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  contactName!: string;

  @IsString()
  @MaxLength(20)
  contactPhone!: string;

  @IsString()
  @MaxLength(255)
  contactEmail!: string;
}

export class CancelReservationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
