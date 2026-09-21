import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class InitPaymentDto {
  @IsUUID()
  reservationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  callbackUrl?: string;
}

export class IyzicoWebhookDto {
  @IsString()
  signature!: string; // iyzico'dan gelen imza

  @IsString()
  conversationId!: string;

  @IsEnum(['success', 'failure'])
  status!: 'success' | 'failure';

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  // İmza doğrulama için ham body (request raw)
  rawBody?: string;
}
