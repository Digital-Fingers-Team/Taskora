import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrgRole, roleAtLeast, type AuthUser } from "@taskora/shared";
import { PrismaService } from "../prisma/prisma.service";
import { REQUIRE_ROLE_KEY } from "./require-role.decorator";

/**
 * بيتأكد إن المستخدم الحالي عضو في المنظمة (:orgId) وإن دوره كافٍ.
 * بيحطّ العضوية على request.membership عشان الـ controller يستخدمها.
 */
@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    const orgId: string | undefined = request.params?.orgId;

    if (!user) throw new ForbiddenException("غير مصرّح");
    if (!orgId) throw new ForbiddenException("المنظمة غير محددة");

    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });
    if (!membership) throw new ForbiddenException("إنت مش عضو في المنظمة دي");

    const required =
      this.reflector.getAllAndOverride<OrgRole | undefined>(REQUIRE_ROLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? OrgRole.Member;

    if (!roleAtLeast(membership.role, required)) {
      throw new ForbiddenException("دورك مش كافٍ للعملية دي");
    }

    request.membership = membership;
    return true;
  }
}
