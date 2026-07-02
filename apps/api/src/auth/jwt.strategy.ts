import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { jwtPayloadSchema, type AuthUser } from "@taskora/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? "dev-secret",
    });
  }

  async validate(raw: unknown): Promise<AuthUser> {
    const payload = jwtPayloadSchema.safeParse(raw);
    if (!payload.success) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: payload.data.sub },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
