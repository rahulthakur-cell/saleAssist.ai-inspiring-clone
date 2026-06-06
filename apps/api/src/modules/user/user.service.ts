import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { name?: string; avatar?: string; phone?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
      },
    });
  }

  async getUserTenants(userId: string) {
    const memberships = await this.prisma.tenantUser.findMany({
      where: { userId, isActive: true },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            plan: true,
            status: true,
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.tenant,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }
}
