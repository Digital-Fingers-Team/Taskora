import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  OrgRole,
  type CreateOrganizationInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from "@taskora/shared";
import { PrismaService } from "../prisma/prisma.service";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** المنظمات اللي المستخدم عضو فيها. */
  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      createdAt: m.organization.createdAt.toISOString(),
    }));
  }

  /** إنشاء منظمة + جعل المنشئ Owner. */
  async create(userId: string, input: CreateOrganizationInput) {
    const slug = input.slug ?? slugify(input.name);
    if (!slug) throw new BadRequestException("اسم غير صالح للـ slug");

    const exists = await this.prisma.organization.findUnique({ where: { slug } });
    if (exists) throw new ConflictException("الـ slug ده مستخدم بالفعل");

    return this.prisma.organization.create({
      data: {
        name: input.name,
        slug,
        memberships: { create: { userId, role: OrgRole.Owner } },
      },
      select: { id: true, name: true, slug: true, createdAt: true },
    });
  }

  async listMembers(orgId: string) {
    const members = await this.prisma.membership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * دعوة عضو بالإيميل. لو المستخدم موجود بيتضاف مباشرة (نسخة مبدئية —
   * نظام دعوات بالإيميل الحقيقي بييجي لاحقًا).
   */
  async addMember(orgId: string, input: InviteMemberInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new NotFoundException("المستخدم ده لسه معندوش حساب. لازم يسجّل الأول.");
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });
    if (existing) throw new ConflictException("المستخدم ده عضو بالفعل");

    const membership = await this.prisma.membership.create({
      data: { userId: user.id, organizationId: orgId, role: input.role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    return {
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      joinedAt: membership.createdAt.toISOString(),
    };
  }

  async updateMemberRole(orgId: string, targetUserId: string, input: UpdateMemberRoleInput) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!membership) throw new NotFoundException("العضو ده مش موجود");

    // منع إزالة آخر Owner.
    if (membership.role === OrgRole.Owner && input.role !== OrgRole.Owner) {
      const owners = await this.prisma.membership.count({
        where: { organizationId: orgId, role: OrgRole.Owner },
      });
      if (owners <= 1) throw new BadRequestException("لازم يفضل Owner واحد على الأقل");
    }

    return this.prisma.membership.update({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      data: { role: input.role },
      select: { userId: true, organizationId: true, role: true },
    });
  }

  async removeMember(orgId: string, targetUserId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!membership) throw new NotFoundException("العضو ده مش موجود");

    if (membership.role === OrgRole.Owner) {
      const owners = await this.prisma.membership.count({
        where: { organizationId: orgId, role: OrgRole.Owner },
      });
      if (owners <= 1) throw new BadRequestException("مينفعش تشيل آخر Owner");
    }

    await this.prisma.membership.delete({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    return { removed: true };
  }
}
