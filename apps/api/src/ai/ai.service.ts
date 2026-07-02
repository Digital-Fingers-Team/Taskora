import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  createCardSchema,
  improvementSuggestionSchema,
  type CreateCardInput,
  type CardBlueprint,
  type ImprovementSuggestion,
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
