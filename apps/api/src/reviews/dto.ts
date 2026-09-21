import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Puan en az 1 olmalı' })
  @Max(5, { message: 'Puan en fazla 5 olmalı' })
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Yorum en fazla 2000 karakter olmalı' })
  comment?: string;
}

export class RejectReviewDto {
  @IsString()
  @MinLength(3, { message: 'Red gerekçesi en az 3 karakter olmalı' })
  @MaxLength(500, { message: 'Red gerekçesi en fazla 500 karakter olmalı' })
  reason!: string;
}

export class ReviewListQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(['newest', 'highest', 'lowest'])
  sort?: 'newest' | 'highest' | 'lowest' = 'newest';
}
