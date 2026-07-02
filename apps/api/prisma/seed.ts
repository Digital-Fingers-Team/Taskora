import { PrismaClient, OrgRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const owner = await prisma.user.upsert({
    where: { email: "owner@taskora.dev" },
    update: {},
    create: { email: "owner@taskora.dev", name: "Owner Baraa", passwordHash },
  });

  const operator = await prisma.user.upsert({
    where: { email: "operator@taskora.dev" },
    update: {},
    create: { email: "operator@taskora.dev", name: "Operator One", passwordHash },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "acme" },
    update: {},
    create: { name: "Acme Inc", slug: "acme" },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
    update: { role: OrgRole.OWNER },
    create: { userId: owner.id, organizationId: org.id, role: OrgRole.OWNER },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: operator.id, organizationId: org.id } },
    update: { role: OrgRole.OPERATOR },
    create: { userId: operator.id, organizationId: org.id, role: OrgRole.OPERATOR },
  });

  // eslint-disable-next-line no-console
  console.log("✅ Seed done:\n  owner@taskora.dev / operator@taskora.dev  (password123)");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
