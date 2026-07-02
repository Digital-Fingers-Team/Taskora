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
  createOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  type CreateOrganizationInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
  type AuthUser,
} from "@taskora/shared";
import { OrganizationsService } from "./organizations.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "./org-roles.guard";
import { RequireRole } from "./require-role.decorator";

@UseGuards(JwtAuthGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orgs.listForUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createOrganizationSchema)) body: CreateOrganizationInput,
  ) {
    return this.orgs.create(user.id, body);
  }

  // ----- عمليات داخل منظمة محددة (:orgId) — محميّة بالأدوار -----

  @UseGuards(OrgRolesGuard)
  @RequireRole(OrgRole.Member)
  @Get(":orgId/members")
  listMembers(@Param("orgId") orgId: string) {
    return this.orgs.listMembers(orgId);
  }

  @UseGuards(OrgRolesGuard)
  @RequireRole(OrgRole.Admin)
  @Post(":orgId/members")
  addMember(
    @Param("orgId") orgId: string,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
  ) {
    return this.orgs.addMember(orgId, body);
  }

  @UseGuards(OrgRolesGuard)
  @RequireRole(OrgRole.Admin)
  @Patch(":orgId/members/:userId")
  updateMemberRole(
    @Param("orgId") orgId: string,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(updateMemberRoleSchema)) body: UpdateMemberRoleInput,
  ) {
    return this.orgs.updateMemberRole(orgId, userId, body);
  }

  @UseGuards(OrgRolesGuard)
  @RequireRole(OrgRole.Admin)
  @Delete(":orgId/members/:userId")
  removeMember(@Param("orgId") orgId: string, @Param("userId") userId: string) {
    return this.orgs.removeMember(orgId, userId);
  }
}
