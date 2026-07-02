import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  createCardSchema,
  improvementSuggestionSchema,
  agentPlanSchema,
  agentResearchSchema,
  agentDraftSchema,
  agentQaSchema,
  type CreateCardInput,
  type CardBlueprint,
  type ImprovementSuggestion,
  type AgentPlan,
  type AgentResearch,
  type AgentDraft,
  type AgentQa,
} from "@taskora/shared";

const MODEL = "claude-sonnet-5";

const CARD_GENERATION_SYSTEM_PROMPT = `
أنت مساعد بيحوّل طلب شركة مكتوب بالعامية أو الفصحى لـ Task Blueprint منظّم لمنصة Taskora.
رجّع JSON فقط (من غير أي نص تاني) بالشكل ده:
{
  "title": string, "vertical": string, "description": string, "reasonForExecution": string,
  "difficulty": "BEGINNER"|"INTERMEDIATE"|"ADVANCED", "estimatedMinutes": number,
  "requiredSkills": string[], "inputsSchema": [{"key":string,"label":string,"type":"text"|"number"|"boolean"|"select"|"file"|"url"|"date","required":boolean}],
  "steps": [{"id":string,"type":"step","title":string,"description":string,"tool":string,"expectedOutput":string}],
  "tools": string[], "expectedOutput": string, "commonMistakes": string[],
  "aiInstructions": string, "humanInstructions": string
}
`.trim();

/**
 * طبقة الـ AI (المرحلة 5) — معزولة في module مستقل عشان تتغيّر/تتكبّر
 * من غير ما تلمس باقي النظام. agent واحد كويس، مش أوركسترا وكلاء (ده مرحلة 10).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException(
        "الـ AI مش مفعّل — لازم تضيف ANTHROPIC_API_KEY في الـ .env عشان تستخدم الميزة دي",
      );
    }
    this.client ??= new Anthropic({ apiKey });
    return this.client;
  }

  async generateCardDraft(prompt: string): Promise<CreateCardInput> {
    const client = this.getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: CARD_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.logger.error(`Failed to parse AI card draft: ${text}`);
      throw new InternalServerErrorException("مقدرتش أفهم رد الـ AI، جرّب تاني");
    }

    const parsed = createCardSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error(`AI card draft failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
      throw new InternalServerErrorException("رد الـ AI مكانش مطابق لشكل الكارت المطلوب، جرّب تاني");
    }
    return parsed.data;
  }

  /**
   * حلقة التعلّم (المرحلة 6) — الـ Moat. الـ AI بياخد البنية الحالية للكارت +
   * ملخّص سجلّات التنفيذ (فين الناس بتتلخبط، الأخطاء المتكررة، الوقت) ويقترح
   * نسخة أحسن. النتيجة بترجع كـ Draft للمراجعة البشرية — مش بتتنشر تلقائيًا.
   */
  async suggestCardImprovement(
    current: CardBlueprint,
    executionSummary: string,
    focus?: string,
  ): Promise<ImprovementSuggestion> {
    const client = this.getClient();
    const system = `
أنت محلّل بيطوّر Task Blueprints لمنصة Taskora بناءً على بيانات تنفيذ حقيقية.
هتاخد البنية الحالية للكارت + ملخّص لسجلّات التنفيذ (فين المنفّذين اتلخبطوا،
الأخطاء المتكررة، الوقت المستغرق، ملاحظات المراجعة)، واقترح نسخة محسّنة.
ركّز على تقليل الأخطاء الشائعة، توضيح الخطوات الغامضة، وتحسين التعليمات.
رجّع JSON فقط (من غير أي نص تاني) بالشكل ده:
{
  "changeReason": string,        // جملة واحدة: ليه النسخة دي أحسن
  "changeSummary": string[],     // نقاط قصيرة بالتغييرات
  "blueprint": { ...نفس شكل الكارت الكامل بعد التحسين... }
}
حافظ على نفس شكل حقول البنية (title, vertical, steps[...], inputsSchema[...], إلخ).
`.trim();

    const userContent = [
      `البنية الحالية:\n${JSON.stringify(current, null, 2)}`,
      `ملخّص سجلّات التنفيذ:\n${executionSummary || "لا توجد بيانات كافية بعد."}`,
      focus ? `ركّز على: ${focus}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.logger.error(`Failed to parse AI improvement suggestion: ${text}`);
      throw new InternalServerErrorException("مقدرتش أفهم اقتراح الـ AI، جرّب تاني");
    }

    const parsed = improvementSuggestionSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error(
        `AI improvement failed schema validation: ${JSON.stringify(parsed.error.issues)}`,
      );
      throw new InternalServerErrorException("اقتراح الـ AI مكانش مطابق للشكل المطلوب، جرّب تاني");
    }
    return parsed.data;
  }

  /**
   * محاكاة كارت (المرحلة 9): الـ AI بيعمل dry-run لخطوات وتعليمات الكارت مقابل
   * مدخلات اختبار، ويحكم هل الكارت متسق وقابل للتنفيذ فعليًا. لو مفيش
   * ANTHROPIC_API_KEY، بنرجّع نجاح افتراضي عشان الـ simulation ميكسرش (نفس منطق
   * باقي الميزات اللي بتعتمد على الـ AI في البيئة دي — الفحوصات البنيوية هي الأهم).
   */
  async simulateCard(
    blueprint: CardBlueprint,
    testInputs: Record<string, unknown>,
  ): Promise<{ passed: boolean; notes: string }> {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        passed: true,
        notes: "الـ AI مش مفعّل (مفيش ANTHROPIC_API_KEY) — اتخطّى فحص الـ AI، الفحوصات البنيوية هي المرجع.",
      };
    }

    const client = this.getClient();
    const system = `
أنت مراجع تقني بتعمل dry-run لكارت Task Blueprint في منصة Taskora قبل ما ينزل السوق.
هتاخد بنية الكارت (خطوات، تعليمات، مخرجات متوقعة) + مدخلات اختبار، وتحكم هل
الكارت متسق ومنطقي وقابل للتنفيذ فعليًا بالمدخلات دي، من غير تنفيذ حقيقي.
رجّع JSON فقط (من غير أي نص تاني) بالشكل ده:
{ "passed": boolean, "notes": string }
`.trim();

    const userContent = [
      `بنية الكارت:\n${JSON.stringify(blueprint, null, 2)}`,
      `مدخلات الاختبار:\n${JSON.stringify(testInputs, null, 2)}`,
    ].join("\n\n");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.logger.error(`Failed to parse AI simulation result: ${text}`);
      return { passed: false, notes: "مقدرتش أفهم رد الـ AI على المحاكاة." };
    }

    const parsed = z
      .object({ passed: z.boolean(), notes: z.string() })
      .safeParse(raw);
    if (!parsed.success) {
      this.logger.error(
        `AI simulation result failed schema validation: ${JSON.stringify(parsed.error.issues)}`,
      );
      return { passed: false, notes: "رد الـ AI على المحاكاة مكانش بالشكل المطلوب." };
    }
    return parsed.data;
  }

  // --- أوركسترا الوكلاء (المرحلة 10): Planner → Research → Execute → QA ---
  // 4 مراحل بس، عمدًا — أي agent إضافي = تكلفة + بطء + نقطة فشل.

  async planExecution(
    blueprint: CardBlueprint,
    inputs: Record<string, unknown>,
  ): Promise<AgentPlan> {
    const client = this.getClient();
    const system = `
أنت "Planner" في أوركسترا وكلاء منصة Taskora. هتاخد بنية الكارت (Blueprint) والمدخلات
اللي المستخدم دخّلها، وتحطّ خطة تنفيذ مختصرة قبل أي تنفيذ فعلي.
رجّع JSON فقط (من غير أي نص تاني) بالشكل ده:
{ "approach": string, "steps": string[] }
`.trim();

    const userContent = [
      `بنية الكارت:\n${JSON.stringify(blueprint, null, 2)}`,
      `مدخلات المهمة:\n${JSON.stringify(inputs, null, 2)}`,
    ].join("\n\n");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.logger.error(`Failed to parse AI plan: ${text}`);
      throw new InternalServerErrorException("مقدرتش أفهم رد الـ Planner، جرّب تاني");
    }

    const parsed = agentPlanSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error(`AI plan failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
      throw new InternalServerErrorException("رد الـ Planner مكانش مطابق للشكل المطلوب، جرّب تاني");
    }
    return parsed.data;
  }

  async researchExecution(
    blueprint: CardBlueprint,
    inputs: Record<string, unknown>,
    plan: AgentPlan,
    knowledgeContext: string,
  ): Promise<AgentResearch> {
    const client = this.getClient();
    const system = `
أنت "Researcher" في أوركسترا وكلاء منصة Taskora. هتجمع أي سياق/معلومات لازمة قبل
التنفيذ من قاعدة المعرفة المرفقة (لو فيه) ومن بنية الكارت نفسه وخطة الـ Planner.
لو مفيش قاعدة معرفة مرفقة، وضّح إن مفيش مصادر متاحة واستنتج من بنية الكارت بس.
رجّع JSON فقط (من غير أي نص تاني) بالشكل ده:
{ "findings": string }
`.trim();

    const userContent = [
      `بنية الكارت:\n${JSON.stringify(blueprint, null, 2)}`,
      `مدخلات المهمة:\n${JSON.stringify(inputs, null, 2)}`,
      `خطة الـ Planner:\n${JSON.stringify(plan, null, 2)}`,
      `سياق من قاعدة المعرفة:\n${knowledgeContext || "مفيش مصادر معرفة مرفقة للكارت ده."}`,
    ].join("\n\n");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.logger.error(`Failed to parse AI research: ${text}`);
      throw new InternalServerErrorException("مقدرتش أفهم رد الـ Researcher، جرّب تاني");
    }

    const parsed = agentResearchSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error(
        `AI research failed schema validation: ${JSON.stringify(parsed.error.issues)}`,
      );
      throw new InternalServerErrorException("رد الـ Researcher مكانش مطابق للشكل المطلوب، جرّب تاني");
    }
    return parsed.data;
  }

  async executeDraft(
    blueprint: CardBlueprint,
    inputs: Record<string, unknown>,
    plan: AgentPlan,
    research: AgentResearch,
  ): Promise<AgentDraft> {
    const client = this.getClient();
    const system = `
أنت "Executor" في أوركسترا وكلاء منصة Taskora. بتنفّذ الجزء الميكانيكي (بحث/تجميع/صياغة)
بناءً على خطة الـ Planner ونتائج الـ Researcher، وبتنتج مسودة output تتوافق مع
expectedOutput بتاع الكارت. المسودة دي مش نهائية — الإنسان (المنفّذ) هيراجعها ويعدّلها
قبل ما ترفع فعليًا.
رجّع JSON فقط (من غير أي نص تاني) بالشكل ده:
{ "output": { ... حسب expectedOutput بتاع الكارت ... }, "notes": string }
`.trim();

    const userContent = [
      `بنية الكارت:\n${JSON.stringify(blueprint, null, 2)}`,
      `مدخلات المهمة:\n${JSON.stringify(inputs, null, 2)}`,
      `خطة الـ Planner:\n${JSON.stringify(plan, null, 2)}`,
      `نتائج الـ Researcher:\n${JSON.stringify(research, null, 2)}`,
    ].join("\n\n");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.logger.error(`Failed to parse AI draft: ${text}`);
      throw new InternalServerErrorException("مقدرتش أفهم رد الـ Executor، جرّب تاني");
    }

    const parsed = agentDraftSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error(`AI draft failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
      throw new InternalServerErrorException("رد الـ Executor مكانش مطابق للشكل المطلوب، جرّب تاني");
    }
    return parsed.data;
  }

  async qaReview(blueprint: CardBlueprint, draft: AgentDraft): Promise<AgentQa> {
    const client = this.getClient();
    const system = `
أنت "QA" في أوركسترا وكلاء منصة Taskora. بتحكم هل المسودة دي متسقة مع تعليمات
الكارت والمخرج المتوقّع قبل ما تتحوّل لمراجعة بشرية. حكمك ده إشارة للمنفّذ، مش
بوابة تمنع المراجعة البشرية — المراجعة هتحصل في الحالتين.
رجّع JSON فقط (من غير أي نص تاني) بالشكل ده:
{ "passed": boolean, "notes": string }
`.trim();

    const userContent = [
      `بنية الكارت:\n${JSON.stringify(blueprint, null, 2)}`,
      `المسودة:\n${JSON.stringify(draft, null, 2)}`,
    ].join("\n\n");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.logger.error(`Failed to parse AI QA review: ${text}`);
      throw new InternalServerErrorException("مقدرتش أفهم رد الـ QA، جرّب تاني");
    }

    const parsed = agentQaSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error(`AI QA failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
      throw new InternalServerErrorException("رد الـ QA مكانش مطابق للشكل المطلوب، جرّب تاني");
    }
    return parsed.data;
  }

  async chatReply(
    systemContext: string,
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<string> {
    const client = this.getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: systemContext,
      messages: history,
    });
    return response.content.find((b) => b.type === "text")?.text ?? "";
  }
}
