import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { OrgRole } from "@taskora/shared";
import { AuditService } from "./audit.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @RequireRole(OrgRole.Admin)
  @Get()
  list(@Param("orgId") orgId: string) {
    return this.audit.list(orgId);
  }
}
