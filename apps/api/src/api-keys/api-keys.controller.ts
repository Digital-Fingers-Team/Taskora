import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  OrgRole,
  createApiKeySchema,
  type CreateApiKeyInput,
  type AuthUser,
} from "@taskora/shared";
import { ApiKeysService } from "./api-keys.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

/** إدارة مفاتيح الـ API (بتصريح JWT، للأدمن). */
@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/api-keys")
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @RequireRole(OrgRole.Admin)
  @Get()
  list(@Param("orgId") orgId: string) {
    return this.apiKeys.list(orgId);
  }

  @RequireRole(OrgRole.Admin)
  @Post()
  create(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeyInput,
  ) {
    return this.apiKeys.create(orgId, user.id, body);
  }

  @RequireRole(OrgRole.Admin)
  @Delete(":id")
  revoke(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.apiKeys.revoke(orgId, user.id, id);
  }
}
