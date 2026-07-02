import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  OrgRole,
  suggestImprovementSchema,
  type SuggestImprovementInput,
} from "@taskora/shared";
import { CardVersionsService } from "./card-versions.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/cards/:cardId/versions")
export class CardVersionsController {
  constructor(private readonly versions: CardVersionsService) {}

  @RequireRole(OrgRole.Member)
  @Get()
  list(@Param("orgId") orgId: string, @Param("cardId") cardId: string) {
    return this.versions.list(orgId, cardId);
  }

  @RequireRole(OrgRole.Member)
  @Get("metrics")
  metrics(@Param("orgId") orgId: string, @Param("cardId") cardId: string) {
    return this.versions.metrics(orgId, cardId);
  }

  @RequireRole(OrgRole.Member)
  @Get("diff")
  diff(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @Query("from", ParseIntPipe) from: number,
    @Query("to", ParseIntPipe) to: number,
  ) {
    return this.versions.diff(orgId, cardId, from, to);
  }

  @RequireRole(OrgRole.Member)
  @Get(":version")
  get(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @Param("version", ParseIntPipe) version: number,
  ) {
    return this.versions.get(orgId, cardId, version);
  }

  /** حلقة التعلّم — إنشاء اقتراح Draft بالـ AI (آمن، لسه محتاج نشر يدوي). */
  @RequireRole(OrgRole.Member)
  @Post("suggest")
  suggest(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @Body(new ZodValidationPipe(suggestImprovementSchema)) body: SuggestImprovementInput,
  ) {
    return this.versions.suggestImprovement(orgId, cardId, body.focus);
  }

  /** النشر بيغيّر البنية اللي المهام الجديدة هتشتغل بيها — Admin بس. */
  @RequireRole(OrgRole.Admin)
  @Post(":version/publish")
  publish(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @Param("version", ParseIntPipe) version: number,
  ) {
    return this.versions.publish(orgId, cardId, version);
  }

  @RequireRole(OrgRole.Admin)
  @Post(":version/rollback")
  rollback(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @Param("version", ParseIntPipe) version: number,
  ) {
    return this.versions.rollback(orgId, cardId, version);
  }
}
