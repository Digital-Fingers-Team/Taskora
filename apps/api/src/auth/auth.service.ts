import { Injectable, ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import {
  type RegisterInput,
  type LoginInput,
  type AuthResponse,
  type JwtPayload,
} from "@taskora/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException("الإيميل ده مستخدم بالفعل");

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash },
      select: { id: true, email: true, name: true },
    });

    return this.buildResponse(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new UnauthorizedException("الإيميل أو كلمة السر غلط");

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("الإيميل أو كلمة السر غلط");

    return this.buildResponse({ id: user.id, email: user.email, name: user.name });
  }

  private async buildResponse(user: {
    id: string;
    email: string;
    name: string;
  }): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id },
      include: { organization: { select: { id: true, name: true } } },
    });

    return {
      accessToken,
      user,
      memberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role,
      })),
    };
  }
}
