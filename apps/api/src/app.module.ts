import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { TeamModule } from './modules/team/team.module';
import { HealthModule } from './modules/health/health.module';
import { VideoCallModule } from './modules/video-call/video-call.module';
import { LiveStreamModule } from './modules/live-stream/live-stream.module';
import { StorageModule } from './modules/storage/storage.module';
import { ShoppableVideoModule } from './modules/shoppable-video/shoppable-video.module';
import { VideoFaqModule } from './modules/video-faq/video-faq.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import { WidgetModule } from './modules/widget/widget.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BillingModule } from './modules/billing/billing.module';
import { SearchModule } from './modules/search/search.module';
import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';

@Module({
  imports: [
    // ─── Config ─────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // ─── Rate Limiting ──────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 200,
      },
    ]),

    // ─── Queue (BullMQ) ──────────────────────────────────
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: Number(configService.get('REDIS_PORT', 6379)),
        },
      }),
    }),

    // ─── Infrastructure ─────────────────────────────────
    PrismaModule,
    RedisModule,

    // ─── Feature Modules ────────────────────────────────
    AuthModule,
    TenantModule,
    UserModule,
    RbacModule,
    TeamModule,
    HealthModule,
    VideoCallModule,
    LiveStreamModule,
    StorageModule,
    ShoppableVideoModule,
    VideoFaqModule,
    AiChatModule,
    WidgetModule,
    AnalyticsModule,
    BillingModule,
    SearchModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantResolverMiddleware)
      .exclude(
        'api/v1/auth/register',
        'api/v1/auth/login',
        'api/v1/auth/refresh',
        'api/v1/auth/forgot-password',
        'api/v1/auth/reset-password',
        'api/v1/health(.*)',
        'api/docs(.*)',
      )
      .forRoutes('*');
  }
}
