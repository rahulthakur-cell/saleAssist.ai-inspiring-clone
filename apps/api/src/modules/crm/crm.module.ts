import { Module } from '@nestjs/common';
import { CrmService } from './crm.service';
import { CompanyController, DealController, LeadController } from './crm.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyController, DealController, LeadController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
