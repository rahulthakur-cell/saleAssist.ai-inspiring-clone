import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  async listMembers(tenantId: string) {
    const members = await this.prisma.tenantUser.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            lastLoginAt: true,
          },
        },
        customRole: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      avatar: m.user.avatar,
      role: m.role,
      customRole: m.customRole,
      isActive: m.isActive,
      isAvailable: m.isAvailable,
      lastLoginAt: m.user.lastLoginAt,
      joinedAt: m.joinedAt,
    }));
  }

  async inviteMember(tenantId: string, invitedByUserId: string, email: string, role: string) {
    // Check if already a member
    const existing = await this.prisma.tenantUser.findFirst({
      where: {
        tenantId,
        user: { email: email.toLowerCase() },
      },
    });
    if (existing) throw new ConflictException('User is already a member');

    // Check for existing pending invite
    const existingInvite = await this.prisma.invitation.findFirst({
      where: {
        tenantId,
        email: email.toLowerCase(),
        status: 'PENDING',
      },
    });
    if (existingInvite) throw new ConflictException('Invitation already pending');

    // Check tenant agent limits
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const memberCount = await this.prisma.tenantUser.count({
      where: { tenantId, isActive: true },
    });
    if (tenant && memberCount >= tenant.maxAgents) {
      throw new ForbiddenException('Maximum team members reached. Please upgrade your plan.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return this.prisma.invitation.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        role: role as any,
        token,
        invitedByUserId,
        expiresAt,
      },
    });
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { tenant: true },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'PENDING') throw new BadRequestException('Invitation is no longer valid');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation has expired');

    // Get or verify user email matches
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) {
      throw new ForbiddenException('Invitation email does not match your account');
    }

    // Create membership and update invitation
    await this.prisma.$transaction([
      this.prisma.tenantUser.create({
        data: {
          tenantId: invitation.tenantId,
          userId,
          role: invitation.role,
          isActive: true,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      }),
    ]);

    return { message: `Joined ${invitation.tenant.name} successfully` };
  }

  async removeMember(tenantId: string, membershipId: string) {
    const membership = await this.prisma.tenantUser.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.tenantId !== tenantId) {
      throw new NotFoundException('Member not found');
    }

    if (membership.role === 'TENANT_OWNER') {
      throw new ForbiddenException('Cannot remove the organization owner');
    }

    return this.prisma.tenantUser.update({
      where: { id: membershipId },
      data: { isActive: false },
    });
  }

  async updateMemberRole(tenantId: string, membershipId: string, role: string, customRoleId?: string) {
    const membership = await this.prisma.tenantUser.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.tenantId !== tenantId) {
      throw new NotFoundException('Member not found');
    }

    return this.prisma.tenantUser.update({
      where: { id: membershipId },
      data: {
        role: role as any,
        customRoleId: customRoleId || null,
      },
    });
  }

  async listInvitations(tenantId: string) {
    return this.prisma.invitation.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvitation(tenantId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.tenantId !== tenantId) {
      throw new NotFoundException('Invitation not found');
    }

    return this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });
  }
}
