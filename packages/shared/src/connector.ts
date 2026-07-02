import { z } from "zod";
import { credentialProviderSchema } from "./credential";

/**
 * موصّلات الأدوات (المرحلة 8) — بدل ما الكارت يقول "افتح Google Sheets"،
 * بينفّذ فعليًا: `Connector → Action → params`. كل connector بيعرّف actions
 * منظّمة، وكل action بيعرّف الحقول المطلوبة.
 */

/** تعريف حقل مطلوب في action. */
export const connectorFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  required: z.boolean().default(true),
});
export type ConnectorField = z.infer<typeof connectorFieldSchema>;

export const connectorActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  fields: z.array(connectorFieldSchema),
});
export type ConnectorAction = z.infer<typeof connectorActionSchema>;

export const connectorDefSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** مزوّد بيانات الاعتماد اللي الـ connector بيحتاجه. */
  provider: credentialProviderSchema,
  actions: z.array(connectorActionSchema),
});
export type ConnectorDef = z.infer<typeof connectorDefSchema>;

/** طلب تنفيذ action على connector. */
export const executeConnectorSchema = z.object({
  connectorId: z.string(),
  actionId: z.string(),
  /** بيانات الاعتماد المستخدمة (لازم تكون بتاعة نفس الـ provider). */
  credentialId: z.string().uuid(),
  params: z.record(z.unknown()).default({}),
});
export type ExecuteConnectorInput = z.infer<typeof executeConnectorSchema>;

export const connectorResultSchema = z.object({
  ok: z.boolean(),
  /** المخرج المُهيكل من الأداة. */
  output: z.unknown(),
  error: z.string().optional(),
});
export type ConnectorResult = z.infer<typeof connectorResultSchema>;
