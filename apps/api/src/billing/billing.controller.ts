import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import {
  OrgRole,
  updatePlanSchema,
  type UpdatePlanInput,
  type AuthUser,
} from "@taskora/shared";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @RequireRole(OrgRole.Member)
  @Get("summary")
  summary(@Param("orgId") orgId: string) {
    return this.billing.getSummary(orgId);
  }

  @RequireRole(OrgRole.Member)
  @Get("transactions")
  listTransactions(@Param("orgId") orgId: string) {
    return this.billing.listTransactions(orgId);
  }

  @RequireRole(OrgRole.Operator)
  @Get("my-earnings")
  myEarnings(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser) {
    return this.billing.listMyEarnings(orgId, user.id);
  }

  @RequireRole(OrgRole.Admin)
  @Patch("transactions/:transactionId/pay")
  pay(@Param("orgId") orgId: string, @Param("transactionId") transactionId: string) {
    return this.billing.pay(orgId, transactionId);
  }

  @RequireRole(OrgRole.Admin)
  @Patch("transactions/:transactionId/payout")
  payout(@Param("orgId") orgId: string, @Param("transactionId") transactionId: string) {
    return this.billing.payout(orgId, transactionId);
  }

  @RequireRole(OrgRole.Owner)
  @Patch("plan")
  updatePlan(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updatePlanSchema)) body: UpdatePlanInput,
  ) {
    return this.billing.updatePlan(orgId, user.id, body);
  }
}
