import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { OrgRole, type AuthUser } from "@taskora/shared";
import { AgentOrchestratorService } from "./agent-orchestrator.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/tasks/:taskId/agent-run")
export class AgentOrchestratorController {
  constructor(private readonly orchestrator: AgentOrchestratorService) {}

  @RequireRole(OrgRole.Operator)
  @Post()
  run(
    @Param("orgId") orgId: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orchestrator.run(orgId, taskId, user.id);
  }

  @RequireRole(OrgRole.Operator)
  @Get()
  get(
    @Param("orgId") orgId: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orchestrator.get(orgId, taskId, user.id);
  }
}
