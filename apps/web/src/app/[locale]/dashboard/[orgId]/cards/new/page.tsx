"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api } from "@/lib/api";
import {
  CardDifficulty,
  CardInputType,
  type CardInputField,
  type CardStepNode,
} from "@taskora/shared";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `step-${Date.now()}-${idCounter}`;
}

export default function NewCardPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [title, setTitle] = useState("");
  const [vertical, setVertical] = useState("");
  const [description, setDescription] = useState("");
  const [reasonForExecution, setReasonForExecution] = useState("");
  const [difficulty, setDifficulty] = useState<CardDifficulty>(CardDifficulty.Beginner);
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [inputsSchema, setInputsSchema] = useState<CardInputField[]>([]);
  const [steps, setSteps] = useState<CardStepNode[]>([
    { id: nextId(), type: "step", title: "", description: "", tool: "", expectedOutput: "" },
  ]);
  const [tools, setTools] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [commonMistakes, setCommonMistakes] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [humanInstructions, setHumanInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addInputField() {
    setInputsSchema((prev) => [
      ...prev,
      { key: "", label: "", type: CardInputType.Text, required: true, options: [], description: "" },
    ]);
  }

  function updateInputField(index: number, patch: Partial<CardInputField>) {
    setInputsSchema((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeInputField(index: number) {
    setInputsSchema((prev) => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { id: nextId(), type: "step", title: "", description: "", tool: "", expectedOutput: "" },
    ]);
  }

  function updateStep(index: number, patch: Partial<CardStepNode>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !vertical.trim() || steps.length === 0) {
      setError(t("cards.form.requiredError"));
      return;
    }
    setSaving(true);
    try {
      const card = await api.createCard(orgId, {
        title,
        vertical,
        description,
        reasonForExecution,
        difficulty,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
        requiredSkills: splitList(requiredSkills),
        inputsSchema,
        steps,
        tools: splitList(tools),
        expectedOutput,
        commonMistakes: splitList(commonMistakes),
        aiInstructions,
        humanInstructions,
        priceAmount: priceAmount ? Number(priceAmount) : undefined,
      });
      router.replace(`/dashboard/${orgId}/cards/${card.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand";
  const labelCls = "mb-1 block text-sm font-medium text-gray-700";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/dashboard/${orgId}/cards`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        &larr; {t("cards.title")}
      </Link>
      <h1 className="mb-8 mt-2 text-2xl font-bold">{t("cards.create")}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-8">
        {/* Metadata */}
        <section className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{t("cards.form.metadata")}</h2>
          <div>
            <label className={labelCls}>{t("cards.form.title")}</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t("cards.form.vertical")}</label>
            <input
              className={inputCls}
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>{t("cards.form.description")}</label>
            <textarea
              className={inputCls}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>{t("cards.form.reason")}</label>
            <textarea
              className={inputCls}
              rows={2}
              value={reasonForExecution}
              onChange={(e) => setReasonForExecution(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className={labelCls}>{t("cards.form.difficulty")}</label>
              <select
                className={inputCls}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as CardDifficulty)}
              >
                <option value={CardDifficulty.Beginner}>
                  {t("cards.difficulty.BEGINNER")}
                </option>
                <option value={CardDifficulty.Intermediate}>
                  {t("cards.difficulty.INTERMEDIATE")}
                </option>
                <option value={CardDifficulty.Advanced}>
                  {t("cards.difficulty.ADVANCED")}
                </option>
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>{t("cards.form.estimatedMinutes")}</label>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("cards.form.requiredSkills")}</label>
            <input
              className={inputCls}
              placeholder={t("cards.form.commaHint")}
              value={requiredSkills}
              onChange={(e) => setRequiredSkills(e.target.value)}
            />
          </div>
        </section>

        {/* Inputs schema */}
        <section className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("cards.form.inputsSchema")}</h2>
            <button type="button" onClick={addInputField} className="text-sm text-brand">
              + {t("cards.form.addInput")}
            </button>
          </div>
          {inputsSchema.map((field, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 border-b pb-3">
              <input
                className={`${inputCls} w-32`}
                placeholder={t("cards.form.inputKey")}
                value={field.key}
                onChange={(e) => updateInputField(i, { key: e.target.value })}
              />
              <input
                className={`${inputCls} w-40`}
                placeholder={t("cards.form.inputLabel")}
                value={field.label}
                onChange={(e) => updateInputField(i, { label: e.target.value })}
              />
              <select
                className={`${inputCls} w-32`}
                value={field.type}
                onChange={(e) =>
                  updateInputField(i, { type: e.target.value as CardInputField["type"] })
                }
              >
                {Object.values(CardInputType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateInputField(i, { required: e.target.checked })}
                />
                {t("cards.form.required")}
              </label>
              <button
                type="button"
                onClick={() => removeInputField(i)}
                className="text-sm text-red-600"
              >
                {t("cards.form.remove")}
              </button>
            </div>
          ))}
          {inputsSchema.length === 0 && (
            <p className="text-sm text-gray-400">{t("cards.form.noInputs")}</p>
          )}
        </section>

        {/* Steps */}
        <section className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("cards.form.steps")}</h2>
            <button type="button" onClick={addStep} className="text-sm text-brand">
              + {t("cards.form.addStep")}
            </button>
          </div>
          {steps.map((step, i) => (
            <div key={step.id} className="flex flex-col gap-2 border-b pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  {t("cards.form.step")} {i + 1}
                </span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="text-sm text-red-600"
                  >
                    {t("cards.form.remove")}
                  </button>
                )}
              </div>
              <input
                className={inputCls}
                placeholder={t("cards.form.stepTitle")}
                value={step.title}
                onChange={(e) => updateStep(i, { title: e.target.value })}
              />
              <textarea
                className={inputCls}
                rows={2}
                placeholder={t("cards.form.stepDescription")}
                value={step.description}
                onChange={(e) => updateStep(i, { description: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder={t("cards.form.stepTool")}
                  value={step.tool}
                  onChange={(e) => updateStep(i, { tool: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder={t("cards.form.stepExpectedOutput")}
                  value={step.expectedOutput}
                  onChange={(e) => updateStep(i, { expectedOutput: e.target.value })}
                />
              </div>
            </div>
          ))}
        </section>

        {/* Tools + output + mistakes */}
        <section className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{t("cards.form.executionDetails")}</h2>
          <div>
            <label className={labelCls}>{t("cards.form.priceAmount")}</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputCls}
              placeholder={t("cards.form.priceAmountHint")}
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>{t("cards.form.tools")}</label>
            <input
              className={inputCls}
              placeholder={t("cards.form.commaHint")}
              value={tools}
              onChange={(e) => setTools(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>{t("cards.form.expectedOutput")}</label>
            <textarea
              className={inputCls}
              rows={2}
              value={expectedOutput}
              onChange={(e) => setExpectedOutput(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>{t("cards.form.commonMistakes")}</label>
            <input
              className={inputCls}
              placeholder={t("cards.form.commaHint")}
              value={commonMistakes}
              onChange={(e) => setCommonMistakes(e.target.value)}
            />
          </div>
        </section>

        {/* Instructions */}
        <section className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{t("cards.form.instructions")}</h2>
          <div>
            <label className={labelCls}>{t("cards.form.aiInstructions")}</label>
            <textarea
              className={inputCls}
              rows={3}
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>{t("cards.form.humanInstructions")}</label>
            <textarea
              className={inputCls}
              rows={3}
              value={humanInstructions}
              onChange={(e) => setHumanInstructions(e.target.value)}
            />
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          disabled={saving}
          className="self-start rounded-lg bg-brand px-6 py-2 font-medium text-brand-fg disabled:opacity-50"
        >
          {saving ? t("common.loading") : t("cards.form.save")}
        </button>
      </form>
    </main>
  );
}
