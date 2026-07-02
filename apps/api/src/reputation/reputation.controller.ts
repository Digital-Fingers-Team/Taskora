import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { OrgRole } from "@taskora/shared";
import { ReputationService } from "./reputation.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId")
export class ReputationController {
  constructor(private readonly reputation: ReputationService) {}

  @RequireRole(OrgRole.Member)
  @Get("members/:userId/profile")
  getProfile(@Param("orgId") orgId: string, @Param("userId") userId: string) {
    return this.reputation.getProfile(orgId, userId);
  }

  @RequireRole(OrgRole.Member)
  @Get("cards/:cardId/suggested-operators")
  suggestOperators(@Param("orgId") orgId: string, @Param("cardId") cardId: string) {
    return this.reputation.suggestOperators(orgId, cardId);
  }
}
