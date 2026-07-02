import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  OrgRole,
  createCredentialSchema,
  type CreateCredentialInput,
  type AuthUser,
} from "@taskora/shared";
import { CredentialsService } from "./credentials.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

/** إدارة بيانات الاعتماد المشفّرة (بتصريح JWT، للأدمن). */
@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/credentials")
export class CredentialsController {
  constructor(private readonly credentials: CredentialsService) {}

  @RequireRole(OrgRole.Admin)
  @Get()
  list(@Param("orgId") orgId: string) {
    return this.credentials.list(orgId);
  }

  @RequireRole(OrgRole.Admin)
  @Post()
  create(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCredentialSchema)) body: CreateCredentialInput,
  ) {
    return this.credentials.create(orgId, user.id, body);
  }

  @RequireRole(OrgRole.Admin)
  @Delete(":id")
  remove(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.credentials.remove(orgId, user.id, id);
  }
}
