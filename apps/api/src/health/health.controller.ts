import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

/**
 * Health check endpoint'leri — K8s/Docker probes için.
 *
 * GET /api/health         → tam durum (DB, memory, uptime)
 * GET /api/health/live    → liveness probe (uygulama ayakta mı)
 * GET /api/health/ready    → readiness probe (istek kabul etmeye hazır mı)
 *
 * Bu endpoint'ler auth gerektirmez — herkese açıktır.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(@Res() res: Response) {
    const result = await this.healthService.check();
    res.status(result.status === 'ok' ? 200 : result.status === 'degraded' ? 200 : 503).json(result);
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  async liveness() {
    return this.healthService.liveness();
  }

  @Get('ready')
  async readiness(@Res() res: Response) {
    const result = await this.healthService.readiness();
    res.status(result.status === 'ready' ? 200 : 503).json(result);
  }
}
