import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  OrgRole,
  createKnowledgeSourceSchema,
  type CreateKnowledgeSourceInput,
  type AuthUser,
} from "@taskora/shared";
import { KnowledgeService } from "./knowledge.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

/** قاعدة معرفة الكارت — مصادر تغذّي الـ RAG أثناء التنفيذ. */
@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/cards/:cardId/knowledge")
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @RequireRole(OrgRole.Operator)
  @Get()
  list(@Param("orgId") orgId: string, @Param("cardId") cardId: string) {
    return this.knowledge.list(orgId, cardId);
  }

  @RequireRole(OrgRole.Member)
  @Post()
  create(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createKnowledgeSourceSchema)) body: CreateKnowledgeSourceInput,
  ) {
    return this.knowledge.create(orgId, cardId, user.id, body);
  }

  @RequireRole(OrgRole.Member)
  @Delete(":id")
  remove(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @Param("id") id: string,
  ) {
    return this.knowledge.remove(orgId, cardId, id);
  }
}
