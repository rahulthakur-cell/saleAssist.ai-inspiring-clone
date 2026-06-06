import { Module } from '@nestjs/common';
import { VideoFaqController } from './video-faq.controller';
import { VideoFaqService } from './video-faq.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

import { SearchModule } from '../search/search.module';

@Module({
  imports: [PrismaModule, AuthModule, SearchModule],
  controllers: [VideoFaqController],
  providers: [VideoFaqService],
  exports: [VideoFaqService],
})
export class VideoFaqModule {}
