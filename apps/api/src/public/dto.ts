import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ServiceSortOption } from '@turizm-pazaryeri/shared';

export class PublicListQueryDto {
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
  city?: string; // slug

  @IsOptional()
  @IsString()
  category?: string; // slug

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsString()
  date?: string; // ISO date — schedule's startAt >=

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ServiceSortOption)
  sort?: ServiceSortOption;
}
