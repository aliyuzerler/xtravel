import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { env } from '../env';

/**
 * S3 / S3-uyumlu presigned URL servisi — stub implementation.
 *
 * Faz-1 kararı: Sandbox'ta gerçek S3 (AWS / Cloudflare R2 / MinIO) yok.
 * Bu yüzden local dosya sistemine yazar:
 *   - presignUpload() → { uploadUrl, publicUrl, key } döner
 *   - uploadUrl, publicUrl ile aynı: POST/PUT yapmaya gerek yok, dosyayı
 *     doğrudan local diske yazacak bir "stub upload" endpoint'i çağırırız.
 *
 * Üretim için değişiklik (Faz 5):
 *   - AWS S3 SDK ile getSignedUrl(PUT) üret
 *   - uploadUrl gerçek S3 PUT URL'i olur, client dosyayı S3'e yazar
 *
 * Bu implementasyon auth flow'unu test etmemize izin verir; S3'e geçişte
 * yalnızca bu servis değiştirilir, controller ve DTO'lar sabit kalır.
 */

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface PresignResult {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  method: 'PUT';
  expiresInSeconds: number;
  headers?: Record<string, string>;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  /**
   * Yükleme için presigned URL üretir. Sandbox'ta bu yalnızca "kabul edilebilir
   * bir dosya" için anahtar döner; gerçek upload /api/uploads/receive ile yapılır.
   */
  async presign(params: {
    filename: string;
    contentType: string;
    size?: number;
    folder?: string;
  }): Promise<PresignResult> {
    const { filename, contentType, size, folder } = params;

    if (!ALLOWED_TYPES.has(contentType)) {
      throw new Error(`Desteklenmeyen dosya tipi: ${contentType}`);
    }
    if (size !== undefined && size > MAX_BYTES) {
      throw new Error(`Dosya boyutu 5MB sınırını aşıyor (${size} bytes)`);
    }

    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const id = randomUUID();
    const folderSegment = folder && /^[a-z0-9-_]{1,40}$/i.test(folder) ? folder : 'uploads';
    const key = `${folderSegment}/${id}.${ext}`;

    // Sandbox: upload URL, /api/uploads/receive endpoint'ine işaret eder
    const uploadUrl = `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/../api/uploads/receive?key=${encodeURIComponent(
      key,
    )}&contentType=${encodeURIComponent(contentType)}`;
    const publicUrl = `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;

    this.logger.log(`Presigned: ${key} (type=${contentType}, size=${size ?? 'unknown'})`);

    return {
      key,
      uploadUrl,
      publicUrl,
      method: 'PUT',
      expiresInSeconds: env.S3_PRESIGN_EXPIRES_SECONDS,
      headers: {
        'Content-Type': contentType,
      },
    };
  }

  /**
   * Stub S3 receive: dosyayı local diske yazar.
   * Bu metod yalnızca sandbox içindir; üretimde gerçek S3 PUT request'i
   * bu endpoint'i atlayarak doğrudan S3'e gider.
   */
  async receive(key: string, contentType: string, body: Buffer): Promise<{ key: string; publicUrl: string; size: number }> {
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new Error('Desteklenmeyen dosya tipi');
    }
    if (body.byteLength > MAX_BYTES) {
      throw new Error('Dosya 5MB sınırını aşıyor');
    }
    if (!/^[a-z0-9-_]+\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(key)) {
      throw new Error('Geçersiz anahtar');
    }

    const localPath = path.join(env.S3_LOCAL_FS_PATH, key);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, body);

    const publicUrl = `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
    this.logger.log(`Received: ${key} (${body.byteLength} bytes)`);
    return { key, publicUrl, size: body.byteLength };
  }
}
