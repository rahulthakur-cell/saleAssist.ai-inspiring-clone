import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';

@Controller()
export class AppController {
  @Get()
  @Public()
  getSystemStatus() {
    return {
      status: 'success',
      message: 'SaleAssist.ai API server is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
