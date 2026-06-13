import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // ─── Security ───────────────────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // ─── CORS ───────────────────────────────────────────────
  app.enableCors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-API-Key'],
  });

  // ─── API Prefix ─────────────────────────────────────────
  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  // ─── Validation ─────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Socket.IO ──────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ─── Swagger ────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('SaleAssist API')
      .setDescription('SaleAssist.ai Clone — Video Commerce SaaS API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
      .addServer('http://localhost:4000', 'Local Development')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log('📚 Swagger docs: http://localhost:4000/api/docs');
  }

  // ─── Start ──────────────────────────────────────────────
  const port = process.env.PORT || process.env.API_PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 API server running on port ${port}`);
  logger.log(`🔗 API prefix: /api/v1`);
}

bootstrap();
