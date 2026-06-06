import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AuthTokens, JwtPayload } from '@saleassist/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redis: RedisService,
  ) {}

  // ─── Register ─────────────────────────────────────────

  async register(data: {
    email: string;
    password: string;
    name: string;
    tenantName: string;
    tenantSlug?: string;
  }) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Generate slug from tenant name if not provided
    const slug =
      data.tenantSlug ||
      data.tenantName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    // Check slug uniqueness
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (existingTenant) {
      throw new ConflictException('Organization slug already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    // Create user + tenant + membership in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          name: data.name,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: data.tenantName,
          slug,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
        },
      });

      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'TENANT_OWNER',
          isActive: true,
        },
      });

      // Create default widget config
      await tx.widgetConfig.create({
        data: {
          tenantId: tenant.id,
          name: 'Default Widget',
        },
      });

      return { user, tenant };
    });

    // Generate tokens
    const tokens = await this.generateTokens(result.user.id, result.user.email, result.tenant.id);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
      tokens,
    };
  }

  // ─── Login ────────────────────────────────────────────

  async login(email: string, password: string, tenantSlug?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        tenants: {
          include: {
            tenant: true,
          },
          where: { isActive: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Determine tenant
    let tenantUser = user.tenants[0]; // Default: first tenant

    if (tenantSlug) {
      tenantUser =
        user.tenants.find((tu) => tu.tenant.slug === tenantSlug) || tenantUser;
    }

    if (!tenantUser) {
      throw new UnauthorizedException('No organization found for this account');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        ...(!this.isBcryptHash(user.passwordHash)
          ? { passwordHash: await bcrypt.hash(password, this.SALT_ROUNDS) }
          : {}),
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      tenantUser.tenantId,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isSuperAdmin: user.isSuperAdmin,
        currentTenant: {
          id: tenantUser.tenant.id,
          name: tenantUser.tenant.name,
          slug: tenantUser.tenant.slug,
          plan: tenantUser.tenant.plan,
          role: tenantUser.role,
        },
      },
      tokens,
    };
  }

  // ─── Token Management ─────────────────────────────────

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Get user's current tenant
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: storedToken.userId, isActive: true },
    });

    return this.generateTokens(
      storedToken.userId,
      storedToken.user.email,
      tenantUser?.tenantId,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string, tenantId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenants: {
          include: { tenant: true },
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const currentTenantUser = tenantId
      ? user.tenants.find((tu) => tu.tenantId === tenantId)
      : user.tenants[0];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      isSuperAdmin: user.isSuperAdmin,
      currentTenant: currentTenantUser
        ? {
            id: currentTenantUser.tenant.id,
            name: currentTenantUser.tenant.name,
            slug: currentTenantUser.tenant.slug,
            plan: currentTenantUser.tenant.plan,
            role: currentTenantUser.role,
          }
        : undefined,
      tenants: user.tenants.map((tu) => ({
        id: tu.tenant.id,
        name: tu.tenant.name,
        slug: tu.tenant.slug,
        role: tu.role,
      })),
    };
  }

  // ─── Private Helpers ──────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    tenantId?: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      tenantId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(userId),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    if (this.isBcryptHash(passwordHash)) {
      return bcrypt.compare(password, passwordHash);
    }

    const [salt, storedHash] = passwordHash.split(':');
    if (!salt || !storedHash) {
      return false;
    }

    return new Promise((resolve) => {
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) {
          resolve(false);
          return;
        }

        const storedBuffer = Buffer.from(storedHash, 'hex');
        if (storedBuffer.length !== derivedKey.length) {
          resolve(false);
          return;
        }

        resolve(crypto.timingSafeEqual(storedBuffer, derivedKey));
      });
    });
  }

  private isBcryptHash(passwordHash: string): boolean {
    return /^\$2[aby]\$/.test(passwordHash);
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    return token;
  }
}
