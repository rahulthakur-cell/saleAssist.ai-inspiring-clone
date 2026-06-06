import { Module } from '@nestjs/common';
import { LiveStreamController } from './live-stream.controller';
import { LiveStreamService } from './live-stream.service';
import { LiveStreamGateway } from './live-stream.gateway';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { VideoCallModule } from '../video-call/video-call.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, VideoCallModule, AnalyticsModule],
  controllers: [LiveStreamController],
  providers: [LiveStreamService, LiveStreamGateway],
  exports: [LiveStreamService],
})
export class LiveStreamModule {}
