import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  OrgRole,
  markNotificationsReadSchema,
  type MarkNotificationsReadInput,
  type AuthUser,
} from "@taskora/shared";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @RequireRole(OrgRole.Operator)
  @Get()
  list(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id, orgId);
  }

  @RequireRole(OrgRole.Operator)
  @Get("unread-count")
  unreadCount(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id, orgId);
  }

  @RequireRole(OrgRole.Operator)
  @Post("read")
  markRead(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(markNotificationsReadSchema)) body: MarkNotificationsReadInput,
  ) {
    return this.notifications.markRead(user.id, orgId, body);
  }
}
