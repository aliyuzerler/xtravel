import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Health check servisi.
 * GET /api/health → uygulama durumu (DB, memory, uptime).
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startedAt = Date.now();

  constructor(private prisma: PrismaService) {}

  async check(): Promise<{
    status: 'ok' | 'degraded' | 'down';
    uptime: number;
    timestamp: string;
    services: Record<string, any>;
  }> {
    const services: Record<string, any> = {};
    let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';

    // 1. Database
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      services.database = {
        status: latency < 1000 ? 'ok' : 'degraded',
        latency,
      };
      if (services.database.status !== 'ok') overallStatus = 'degraded';
    } catch (e) {
      services.database = { status: 'down', error: (e as Error).message };
      overallStatus = 'down';
    }

    // 2. Memory (Node.js process)
    const mem = process.memoryUsage();
    services.memory = {
      status: 'ok',
      rss: `${Math.round(mem.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
      external: `${Math.round(mem.external / 1024 / 1024)} MB`,
    };

    // 3. Cron status (son çalışma zamanı — bir sonraki iterasyonda eklenebilir)

    return {
      status: overallStatus,
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      services,
    };
  }

  /**
   * Liveness probe — uygulama ayakta mı?
   * K8s liveness probe için: 200 → alive, 503 → restarting.
   */
  async liveness(): Promise<{ status: string }> {
    return { status: 'alive' };
  }

  /**
   * Readiness probe — uygulama istek kabul etmeye hazır mı?
   * DB bağlantısı kontrolü.
   */
  async readiness(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'connected' };
    } catch (e) {
      return { status: 'not_ready', database: 'disconnected' };
    }
  }
}
