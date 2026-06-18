import { Module } from '@nestjs/common';
import { VideoCallController } from './video-call.controller';
import { VideoCallService } from './video-call.service';
import { LivekitService } from './livekit.service';
import { VideoCallGateway } from './video-call.gateway';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, AnalyticsModule, StorageModule],
  controllers: [VideoCallController],
  providers: [VideoCallService, LivekitService, VideoCallGateway],
  exports: [VideoCallService, LivekitService],
})
export class VideoCallModule {}
