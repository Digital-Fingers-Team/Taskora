import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  OrgRole,
  createWebhookSchema,
  updateWebhookSchema,
  type CreateWebhookInput,
  type UpdateWebhookInput,
  type AuthUser,
} from "@taskora/shared";
import { WebhooksService } from "./webhooks.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/webhooks")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @RequireRole(OrgRole.Admin)
  @Get()
  list(@Param("orgId") orgId: string) {
    return this.webhooks.list(orgId);
  }

  @RequireRole(OrgRole.Admin)
  @Post()
  create(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createWebhookSchema)) body: CreateWebhookInput,
  ) {
    return this.webhooks.create(orgId, user.id, body);
  }

  @RequireRole(OrgRole.Admin)
  @Patch(":id")
  update(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateWebhookSchema)) body: UpdateWebhookInput,
  ) {
    return this.webhooks.update(orgId, id, body);
  }

  @RequireRole(OrgRole.Admin)
  @Delete(":id")
  remove(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.webhooks.remove(orgId, user.id, id);
  }

  @RequireRole(OrgRole.Admin)
  @Get(":id/deliveries")
  deliveries(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.webhooks.listDeliveries(orgId, id);
  }
}
