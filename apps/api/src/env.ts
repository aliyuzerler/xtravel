import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// .env dosyasını process.env'e yükle (ConfigModule'den önce çalışır).
// Sırasıyla: cwd/.env → ../.env → ../../.env arar.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv') as {
    config: (opts?: { path?: string; override?: boolean }) => { error?: Error };
  };
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      break;
    }
  }
} catch {
  // dotenv yoksa sessizce devam
}

/**
 * Uygulama ortam değişkenleri için Zod şeması.
 * .env dosyası yüklenirken AppConfigModule bunu kullanır.
 * Eksik veya geçersiz değer varsa uygulama boot aşamasında çöker (fail-fast).
 */
export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL zorunludur'),

  // API
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PREFIX: z.string().default('/api'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET en az 16 karakter olmalı'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET en az 16 karakter olmalı'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(604800),

  // S3 / File Upload
  S3_ENDPOINT: z.string().url().or(z.literal('')),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('turizm-pazaryeri-uploads'),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_USE_PATH_STYLE: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  S3_PRESIGN_EXPIRES_SECONDS: z.coerce.number().int().positive().default(600),
  S3_LOCAL_FS_PATH: z.string().default('/home/z/my-project/download/uploads'),
  S3_PUBLIC_BASE_URL: z.string().default('http://localhost:3000/uploads'),

  // Password Reset
  PASSWORD_RESET_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  PASSWORD_RESET_BASE_URL: z
    .string()
    .url()
    .default('http://localhost:3001/reset-password'),

  // Rate Limit
  RATE_LIMIT_LOGIN_PER_MINUTE: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_REGISTER_PER_MINUTE: z.coerce.number().int().positive().default(3),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Process.env'i doğrular ve tip-güvenli şekilde döner.
 * Geçersizse uygulama hata fırlatır.
 */
export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ortam değişkeni doğrulaması başarısız:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
