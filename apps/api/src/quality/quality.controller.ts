import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  OrgRole,
  createQualificationTestSchema,
  submitQualificationAttemptSchema,
  type CreateQualificationTestInput,
  type SubmitQualificationAttemptInput,
  type AuthUser,
} from "@taskora/shared";
import { QualityService } from "./quality.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/qualification-tests")
export class QualityController {
  constructor(private readonly quality: QualityService) {}

  // مسارات ثابتة الأول عشان محدش يتلخبط مع :id.
  @RequireRole(OrgRole.Member)
  @Get("my-attempts")
  listMyAttempts(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser) {
    return this.quality.listMyAttempts(orgId, user.id);
  }

  @RequireRole(OrgRole.Admin)
  @Post()
  create(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createQualificationTestSchema)) body: CreateQualificationTestInput,
  ) {
    return this.quality.createTest(orgId, user.id, body);
  }

  @RequireRole(OrgRole.Member)
  @Get()
  list(@Param("orgId") orgId: string) {
    return this.quality.listTests(orgId);
  }

  @RequireRole(OrgRole.Admin)
  @Get(":id/full")
  getFull(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.quality.getTestFull(orgId, id);
  }

  @RequireRole(OrgRole.Member)
  @Get(":id")
  getForAttempt(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.quality.getTestForAttempt(orgId, id);
  }

  @RequireRole(OrgRole.Member)
  @Post(":id/attempts")
  attempt(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(submitQualificationAttemptSchema)) body: SubmitQualificationAttemptInput,
  ) {
    return this.quality.attempt(orgId, id, user.id, body);
  }
}
