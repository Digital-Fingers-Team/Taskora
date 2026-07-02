# Taskora

نظام تشغيل للأعمال المتكررة: AI بينفّذ، خبير بشري بيراجع، وكل تنفيذ بيغذّي المنصة.

الـ stack **كله TypeScript** من الـ DB schema لحد الـ UI — لغة واحدة عبر المونوريبو.

## البنية (Monorepo — Turborepo + pnpm)

```
apps/
  api/    → NestJS + Prisma + PostgreSQL + Redis   (@taskora/api)
  web/    → Next.js 14 (App Router) + Tailwind + next-intl (ar/en)  (@taskora/web)
packages/
  shared/ → Types + Zod schemas مشتركة بين api و web   (@taskora/shared)
```

## المرحلة الحالية: 0 — الأساس (Foundation)

الموجود دلوقتي:
- Monorepo بـ 3 packages.
- Auth (register / login / JWT) مبني على **Organizations / Members / Roles** من اليوم الأول.
- أدوار: `OWNER / ADMIN / MEMBER / OPERATOR` بـ RBAC بسيط (هرمي بالـ rank).
- منظمات multi-tenant: مستخدم واحد ممكن يكون في أكتر من منظمة بأدوار مختلفة.
- i18n عربي/إنجليزي (RTL/LTR) من الأول.

> لسه مفيش كروت ولا مهام — ده مظبوط، دي "الأرض" اللي المرحلة 1 (الكارت كـ Blueprint) هتتبنى عليها.

## التشغيل

### 1) المتطلبات
- Node ≥ 20، pnpm، Docker (للـ Postgres + Redis).

### 2) الإعداد
```bash
pnpm install
cp .env.example .env        # عدّل JWT_SECRET
pnpm infra:up               # يشغّل Postgres (pgvector) + Redis
pnpm db:generate            # Prisma client
pnpm db:migrate             # ينشئ الجداول
pnpm db:seed                # بيانات تجريبية (اختياري)
```

بيانات الـ seed: `owner@taskora.dev` / `operator@taskora.dev` — الباسورد `password123`.

### 3) التشغيل
```bash
pnpm dev                    # يشغّل api (:4000) + web (:3000) مع بعض
```

- الواجهة: http://localhost:3000 (بيحوّل لـ /ar تلقائيًا)
- الـ API: http://localhost:4000/api/health

## الـ API (المرحلة 0)

| Method | Path | الدور المطلوب |
|--------|------|----------------|
| POST | `/api/auth/register` | — |
| POST | `/api/auth/login` | — |
| GET | `/api/auth/me` | مسجّل دخول |
| GET | `/api/organizations` | مسجّل دخول |
| POST | `/api/organizations` | مسجّل دخول (يبقى Owner) |
| GET | `/api/organizations/:orgId/members` | MEMBER+ |
| POST | `/api/organizations/:orgId/members` | ADMIN+ |
| PATCH | `/api/organizations/:orgId/members/:userId` | ADMIN+ |
| DELETE | `/api/organizations/:orgId/members/:userId` | ADMIN+ |
