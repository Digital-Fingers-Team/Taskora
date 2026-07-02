import { SetMetadata } from "@nestjs/common";
import type { OrgRole } from "@taskora/shared";

export const REQUIRE_ROLE_KEY = "requireRole";

/**
 * الحد الأدنى للدور المطلوب للوصول لهذا الـ endpoint داخل المنظمة.
 * بيشتغل مع OrgRolesGuard اللي بيقرا :orgId من الـ params.
 */
export const RequireRole = (role: OrgRole) => SetMetadata(REQUIRE_ROLE_KEY, role);
