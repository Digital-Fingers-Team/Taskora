import { z } from "zod";

/**
 * أدوار العضوية داخل الـ Organization.
 * RBAC بسيط بـ enum — الـ granular permissions تيجي في مرحلة 7.
 */
export const OrgRole = {
  Owner: "OWNER",
  Admin: "ADMIN",
  Member: "MEMBER",
  Operator: "OPERATOR",
} as const;

export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export const orgRoleSchema = z.nativeEnum(OrgRole);

/** ترتيب هرمي للأدوار — أرقام أعلى = صلاحيات أوسع. */
export const ROLE_RANK: Record<OrgRole, number> = {
  [OrgRole.Owner]: 40,
  [OrgRole.Admin]: 30,
  [OrgRole.Member]: 20,
  [OrgRole.Operator]: 10,
};

/** هل الدور ده على الأقل بنفس مستوى الدور المطلوب؟ */
export function roleAtLeast(role: OrgRole, required: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
