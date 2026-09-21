import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export enum UploadContentType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
}

export class PresignUploadDto {
  @IsString()
  filename!: string; // "turlu-resim.jpg"

  @IsEnum(UploadContentType, {
    message: 'contentType yalnızca image/jpeg, image/png, image/webp olabilir',
  })
  contentType!: UploadContentType;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024, { message: 'Maksimum dosya boyutu 5MB' })
  size?: number;

  @IsOptional()
  @IsString()
  folder?: string; // "service-images", "provider-logo" vb.
}
