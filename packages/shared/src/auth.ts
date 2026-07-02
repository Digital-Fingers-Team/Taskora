import { z } from "zod";
import { orgRoleSchema } from "./roles";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "كلمة السر لازم تكون 8 حروف على الأقل"),
  name: z.string().min(2).max(80),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** محتوى الـ JWT payload. */
export const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** العضوية كما تُرجَع للـ client (Organization + Role). */
export const membershipViewSchema = z.object({
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  role: orgRoleSchema,
});
export type MembershipView = z.infer<typeof membershipViewSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
  memberships: z.array(membershipViewSchema),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
