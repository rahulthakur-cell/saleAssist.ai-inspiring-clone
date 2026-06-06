import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('User')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.userService.findById(userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() body: { name?: string; avatar?: string; phone?: string },
  ) {
    return this.userService.updateProfile(userId, body);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'List user organizations' })
  async getTenants(@CurrentUser('sub') userId: string) {
    return this.userService.getUserTenants(userId);
  }
}
