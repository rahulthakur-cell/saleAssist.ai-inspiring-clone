import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { CurrentUser, TenantId, RequirePermissions } from '../../common/decorators';

@ApiTags('Team')
@Controller('team')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('members')
  @RequirePermissions('team:view')
  @ApiOperation({ summary: 'List team members' })
  async listMembers(@TenantId() tenantId: string) {
    return this.teamService.listMembers(tenantId);
  }

  @Post('invite')
  @RequirePermissions('team:manage')
  @ApiOperation({ summary: 'Send team invitation' })
  async inviteMember(
    @TenantId() tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { email: string; role: string },
  ) {
    return this.teamService.inviteMember(tenantId, userId, body.email, body.role);
  }

  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Accept team invitation' })
  async acceptInvitation(
    @Param('token') token: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.teamService.acceptInvitation(token, userId);
  }

  @Delete('members/:id')
  @RequirePermissions('team:manage')
  @ApiOperation({ summary: 'Remove team member' })
  async removeMember(
    @TenantId() tenantId: string,
    @Param('id') membershipId: string,
  ) {
    return this.teamService.removeMember(tenantId, membershipId);
  }

  @Patch('members/:id/role')
  @RequirePermissions('team:manage')
  @ApiOperation({ summary: 'Update member role' })
  async updateRole(
    @TenantId() tenantId: string,
    @Param('id') membershipId: string,
    @Body() body: { role: string; customRoleId?: string },
  ) {
    return this.teamService.updateMemberRole(tenantId, membershipId, body.role, body.customRoleId);
  }

  @Get('invitations')
  @RequirePermissions('team:manage')
  @ApiOperation({ summary: 'List pending invitations' })
  async listInvitations(@TenantId() tenantId: string) {
    return this.teamService.listInvitations(tenantId);
  }

  @Delete('invitations/:id')
  @RequirePermissions('team:manage')
  @ApiOperation({ summary: 'Revoke invitation' })
  async revokeInvitation(
    @TenantId() tenantId: string,
    @Param('id') invitationId: string,
  ) {
    return this.teamService.revokeInvitation(tenantId, invitationId);
  }
}
