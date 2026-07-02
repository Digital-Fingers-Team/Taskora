import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  OrgRole,
  executeConnectorSchema,
  type ExecuteConnectorInput,
} from "@taskora/shared";
import { ConnectorsService } from "./connectors.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/connectors")
export class ConnectorsController {
  constructor(private readonly connectors: ConnectorsService) {}

  /** سجلّ الموصّلات المتاحة + إجراءاتها. متاح لكل الأعضاء. */
  @RequireRole(OrgRole.Operator)
  @Get()
  list() {
    return this.connectors.listConnectors();
  }

  /** تنفيذ إجراء على أداة حقيقية باستخدام بيانات اعتماد المنظمة. */
  @RequireRole(OrgRole.Member)
  @Post("execute")
  execute(
    @Param("orgId") orgId: string,
    @Body(new ZodValidationPipe(executeConnectorSchema)) body: ExecuteConnectorInput,
  ) {
    return this.connectors.execute(orgId, body);
  }
}
