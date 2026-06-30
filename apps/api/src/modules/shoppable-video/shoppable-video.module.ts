import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ShoppableVideoController } from './shoppable-video.controller';
import { ShoppableVideoService } from './shoppable-video.service';
import { VideoTranscodeProcessor } from './processors/video-transcode.processor';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SearchModule,
    StorageModule,
    BullModule.registerQueue({
      name: 'video-transcode',
    }),
  ],
  controllers: [ShoppableVideoController],
  providers: [ShoppableVideoService, VideoTranscodeProcessor],
  exports: [ShoppableVideoService],
})
export class ShoppableVideoModule {}

