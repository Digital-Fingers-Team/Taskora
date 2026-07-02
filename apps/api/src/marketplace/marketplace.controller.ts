import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { OrgRole, type AuthUser } from "@taskora/shared";
import { MarketplaceService } from "./marketplace.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { OrgRolesGuard } from "../organizations/org-roles.guard";
import { RequireRole } from "../organizations/require-role.decorator";

/** تصفّح السوق — أي مستخدم مسجّل دخوله، عبر كل المنظمات. */
@UseGuards(JwtAuthGuard)
@Controller("marketplace/cards")
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get()
  browse(@Query("vertical") vertical?: string) {
    return this.marketplace.browse(vertical);
  }

  @Get(":cardId")
  getOne(@Param("cardId") cardId: string) {
    return this.marketplace.getOne(cardId);
  }
}

/** شراء/تفعيل كارت من السوق لمنظمة المشتري — Admin بس. */
@UseGuards(JwtAuthGuard, OrgRolesGuard)
@Controller("organizations/:orgId/marketplace")
export class OrgMarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @RequireRole(OrgRole.Admin)
  @Post("purchase/:cardId")
  purchase(
    @Param("orgId") orgId: string,
    @Param("cardId") cardId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.marketplace.purchase(orgId, user.id, cardId);
  }
}
