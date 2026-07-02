import { z } from "zod";
import { orgRoleSchema, OrgRole } from "./roles";

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "الـ slug حروف صغيرة وأرقام وشرطات بس")
    .optional(),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: orgRoleSchema.default(OrgRole.Member),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: orgRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const organizationViewSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
});
export type OrganizationView = z.infer<typeof organizationViewSchema>;

export const memberViewSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: orgRoleSchema,
  joinedAt: z.string(),
});
export type MemberView = z.infer<typeof memberViewSchema>;
