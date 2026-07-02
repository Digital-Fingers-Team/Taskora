"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { api, getToken } from "@/lib/api";
import type { AuthUser, ChatMessageView, MemberView, TaskView } from "@taskora/shared";
import { ChatRole, ReviewDecision, TaskStatus } from "@taskora/shared";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  IN_REVIEW: "bg-purple-100 text-purple-700",
  REVISION_REQUESTED: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function TaskDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const taskId = params.taskId as string;

  const [task, setTask] = useState<TaskView | null>(null);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [assignTo, setAssignTo] = useState("");
  const [logEvent, setLogEvent] = useState("note");
  const [logMessage, setLogMessage] = useState("");
  const [outputText, setOutputText] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [rating, setRating] = useState("5");
  const [chat, setChat] = useState<ChatMessageView[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setTask(await api.getTask(orgId, taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void (async () => {
      const [meRes, membersRes] = await Promise.all([api.me(), api.listMembers(orgId)]);
      setMe(meRes);
      setMembers(membersRes);
    })();
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, taskId]);

  useEffect(() => {
    if (task?.status === TaskStatus.InProgress) {
      void api.listChat(orgId, taskId).then(setChat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, taskId, task?.status]);

  async function sendChat() {
    if (!chatInput.trim()) return;
    setChatBusy(true);
    setChatError(null);
    const userMsg = chatInput;
    setChatInput("");
    setChat((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, taskId, role: ChatRole.User, content: userMsg, createdAt: new Date().toISOString() },
    ]);
    try {
      const reply = await api.sendChatMessage(orgId, taskId, userMsg);
      setChat((prev) => [...prev, reply]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "error");
    } finally {
      setChatBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !task) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-gray-500">{error ?? t("common.loading")}</p>
      </main>
    );
  }

  const isOperator = me?.id === task.operatorId;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/dashboard/${orgId}/tasks`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        &larr; {t("tasks.title")}
      </Link>

      <div className="mb-8 mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{task.card?.title}</h1>
          <p className="text-sm text-gray-500">{task.card?.vertical}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
          {t(`tasks.status.${task.status}`)}
        </span>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-6">
        {Object.keys(task.inputs).length > 0 && (
          <Section title={t("tasks.detail.inputs")}>
            <ul className="text-sm text-gray-700">
              {Object.entries(task.inputs).map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium">{k}:</span> {String(v)}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Assign — Draft only */}
        {task.status === TaskStatus.Draft && (
          <Section title={t("tasks.detail.assign")}>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
              >
                <option value="">{t("tasks.form.selectCard")}</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !assignTo}
                onClick={() => run(() => api.assignTask(orgId, taskId, { operatorId: assignTo }))}
                className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-50"
              >
                {t("tasks.detail.assignButton")}
              </button>
            </div>
          </Section>
        )}

        {/* Operator workspace — Assigned / RevisionRequested / InProgress */}
        {isOperator &&
          (task.status === TaskStatus.Assigned || task.status === TaskStatus.RevisionRequested) && (
            <Section title={t("tasks.detail.workspace")}>
              <button
                disabled={busy}
                onClick={() => run(() => api.startTask(orgId, taskId))}
                className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-50"
              >
                {t("tasks.detail.start")}
              </button>
            </Section>
          )}

        {isOperator && task.status === TaskStatus.InProgress && (
          <Section title={t("tasks.detail.workspace")}>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <select
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  value={logEvent}
                  onChange={(e) => setLogEvent(e.target.value)}
                >
                  <option value="note">{t("tasks.detail.logNote")}</option>
                  <option value="stuck">{t("tasks.detail.logStuck")}</option>
                </select>
                <input
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                  placeholder={t("tasks.detail.logMessagePlaceholder")}
                  value={logMessage}
                  onChange={(e) => setLogMessage(e.target.value)}
                />
                <button
                  disabled={busy || !logMessage.trim()}
                  onClick={() =>
                    run(async () => {
                      await api.addTaskLog(orgId, taskId, { event: logEvent, message: logMessage });
                      setLogMessage("");
                    })
                  }
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                >
                  {t("tasks.detail.addLog")}
                </button>
              </div>

              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2"
                rows={4}
                placeholder={t("tasks.detail.outputPlaceholder")}
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)}
              />
              <button
                disabled={busy || !outputText.trim()}
                onClick={() =>
                  run(() => api.submitTask(orgId, taskId, { output: { result: outputText } }))
                }
                className="self-start rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-50"
              >
                {t("tasks.detail.submit")}
              </button>
            </div>
          </Section>
        )}

        {isOperator && task.status === TaskStatus.InProgress && (
          <Section title={t("tasks.detail.chat")}>
            <div className="flex flex-col gap-3">
              <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {chat.length === 0 && (
                  <p className="text-sm text-gray-400">{t("tasks.detail.chatEmpty")}</p>
                )}
                {chat.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.role === ChatRole.User
                        ? "self-end bg-brand text-brand-fg"
                        : "self-start bg-gray-100 text-gray-700"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
              </div>
              {chatError && <p className="text-sm text-red-600">{chatError}</p>}
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                  placeholder={t("tasks.detail.chatPlaceholder")}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                />
                <button
                  disabled={chatBusy || !chatInput.trim()}
                  onClick={sendChat}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
                >
                  {t("tasks.detail.chatSend")}
                </button>
              </div>
            </div>
          </Section>
        )}

        {task.executionLogs && task.executionLogs.length > 0 && (
          <Section title={t("tasks.detail.executionLog")}>
            <ul className="flex flex-col gap-2 text-sm">
              {task.executionLogs.map((log) => (
                <li key={log.id} className="border-b pb-2 text-gray-600">
                  <span className="font-medium">{log.event}</span>
                  {log.message && <span> — {log.message}</span>}
                  <span className="ms-2 text-gray-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {task.output && (
          <Section title={t("tasks.detail.output")}>
            <pre className="whitespace-pre-wrap text-sm text-gray-700">
              {JSON.stringify(task.output, null, 2)}
            </pre>
          </Section>
        )}

        {/* Review — company reviews InReview tasks */}
        {task.status === TaskStatus.InReview && (
          <Section title={t("tasks.detail.review")}>
            <div className="flex flex-col gap-3">
              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2"
                rows={3}
                placeholder={t("tasks.detail.reviewNotePlaceholder")}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <label className="text-sm">{t("tasks.detail.rating")}</label>
                <select
                  className="rounded-lg border border-gray-300 px-2 py-1"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      api.reviewTask(orgId, taskId, {
                        decision: ReviewDecision.Approve,
                        note: reviewNote,
                        rating: Number(rating),
                      }),
                    )
                  }
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white"
                >
                  {t("tasks.detail.approve")}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      api.reviewTask(orgId, taskId, {
                        decision: ReviewDecision.RequestRevision,
                        note: reviewNote,
                      }),
                    )
                  }
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white"
                >
                  {t("tasks.detail.requestRevision")}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      api.reviewTask(orgId, taskId, {
                        decision: ReviewDecision.Reject,
                        note: reviewNote,
                      }),
                    )
                  }
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
                >
                  {t("tasks.detail.reject")}
                </button>
              </div>
            </div>
          </Section>
        )}

        {(task.reviewNote || task.rating) && (
          <Section title={t("tasks.detail.reviewResult")}>
            {task.rating && (
              <p className="text-sm text-gray-700">
                {t("tasks.detail.rating")}: {task.rating}/5
              </p>
            )}
            {task.reviewNote && <p className="text-sm text-gray-700">{task.reviewNote}</p>}
          </Section>
        )}
      </div>
    </main>
  );
}
