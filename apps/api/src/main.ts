import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { env } from './env';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import express from 'express';
import path from 'path';

async function bootstrap() {
  // Env validation — fail-fast
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });

  // Trust first proxy (rate limit için)
  const expressInstance = app.getHttpAdapter().getInstance();
  if (typeof expressInstance.set === 'function') {
    expressInstance.set('trust proxy', 1);
  }

  // CORS
  app.enableCors({
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Helmet (güvenlik header'ları)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Cookies
  app.use(cookieParser());

  // Static uploads (sandbox modu — local disk)
  app.use(
    '/uploads',
    express.static(path.resolve(env.S3_LOCAL_FS_PATH), {
      fallthrough: true,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );

  // Global validation pipe — DTO class-validator dekoratörlerini işler
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // API prefix
  app.setGlobalPrefix(env.API_PREFIX.replace(/^\//, ''));

  await app.listen(env.PORT);
  logger.log(`🚀 API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
  logger.log(`   Environment: ${env.NODE_ENV}`);
  logger.log(`   CORS origin: ${env.CORS_ORIGIN}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
