import type {
  AuthResponse,
  AuthUser,
  LoginInput,
  RegisterInput,
  CreateOrganizationInput,
  CardView,
  CardListItem,
  CreateCardInput,
  UpdateCardInput,
  MemberView,
  TaskView,
  TaskListItem,
  CreateTaskInput,
  AssignTaskInput,
  SubmitTaskInput,
  ReviewTaskInput,
  AddExecutionLogInput,
  ExecutionLogView,
  BillingSummary,
  TransactionView,
  UpdatePlanInput,
  OperatorProfile,
  SuggestedOperator,
  AiJobView,
  ChatMessageView,
  CardVersionView,
  CardVersionListItem,
  VersionDiff,
  VersionMetrics,
  NotificationView,
  MarkNotificationsReadInput,
  ApiKeyView,
  ApiKeyCreated,
  CreateApiKeyInput,
  WebhookEndpointView,
  WebhookDeliveryView,
  CreateWebhookInput,
  UpdateWebhookInput,
  UpdateCardVisibilityInput,
  RunCardSimulationInput,
  CardSimulationView,
  MarketplaceCardListItem,
  MarketplaceCardView,
  PurchaseCardResult,
  CreateQualificationTestInput,
  QualificationTestView,
  QualificationTestForAttempt,
  SubmitQualificationAttemptInput,
  QualificationAttemptResult,
} from "@taskora/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "taskora_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  register: (input: RegisterInput) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (input: LoginInput) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  me: () => request<AuthUser>("/auth/me"),

  listOrganizations: () =>
    request<
      Array<{ id: string; name: string; slug: string; role: string; createdAt: string }>
    >("/organizations"),

  createOrganization: (input: CreateOrganizationInput) =>
    request<{ id: string; name: string; slug: string }>("/organizations", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listCards: (orgId: string) =>
    request<CardListItem[]>(`/organizations/${orgId}/cards`),

  getCard: (orgId: string, cardId: string) =>
    request<CardView>(`/organizations/${orgId}/cards/${cardId}`),

  createCard: (orgId: string, input: CreateCardInput) =>
    request<CardView>(`/organizations/${orgId}/cards`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateCard: (orgId: string, cardId: string, input: UpdateCardInput) =>
    request<CardView>(`/organizations/${orgId}/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteCard: (orgId: string, cardId: string) =>
    request<{ removed: true }>(`/organizations/${orgId}/cards/${cardId}`, {
      method: "DELETE",
    }),

  listMembers: (orgId: string) => request<MemberView[]>(`/organizations/${orgId}/members`),

  listTasks: (orgId: string, mine = false) =>
    request<TaskListItem[]>(`/organizations/${orgId}/tasks${mine ? "?mine=true" : ""}`),

  getTask: (orgId: string, taskId: string) =>
    request<TaskView>(`/organizations/${orgId}/tasks/${taskId}`),

  createTask: (orgId: string, input: CreateTaskInput) =>
    request<TaskView>(`/organizations/${orgId}/tasks`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  assignTask: (orgId: string, taskId: string, input: AssignTaskInput) =>
    request<TaskView>(`/organizations/${orgId}/tasks/${taskId}/assign`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  startTask: (orgId: string, taskId: string) =>
    request<TaskView>(`/organizations/${orgId}/tasks/${taskId}/start`, { method: "PATCH" }),

  addTaskLog: (orgId: string, taskId: string, input: AddExecutionLogInput) =>
    request<ExecutionLogView>(`/organizations/${orgId}/tasks/${taskId}/logs`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  submitTask: (orgId: string, taskId: string, input: SubmitTaskInput) =>
    request<TaskView>(`/organizations/${orgId}/tasks/${taskId}/submit`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  reviewTask: (orgId: string, taskId: string, input: ReviewTaskInput) =>
    request<TaskView>(`/organizations/${orgId}/tasks/${taskId}/review`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  getBillingSummary: (orgId: string) =>
    request<BillingSummary>(`/organizations/${orgId}/billing/summary`),

  listTransactions: (orgId: string) =>
    request<TransactionView[]>(`/organizations/${orgId}/billing/transactions`),

  listMyEarnings: (orgId: string) =>
    request<TransactionView[]>(`/organizations/${orgId}/billing/my-earnings`),

  payTransaction: (orgId: string, transactionId: string) =>
    request<TransactionView>(`/organizations/${orgId}/billing/transactions/${transactionId}/pay`, {
      method: "PATCH",
    }),

  payoutTransaction: (orgId: string, transactionId: string) =>
    request<TransactionView>(
      `/organizations/${orgId}/billing/transactions/${transactionId}/payout`,
      { method: "PATCH" },
    ),

  updatePlan: (orgId: string, input: UpdatePlanInput) =>
    request<{ id: string; plan: string }>(`/organizations/${orgId}/billing/plan`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  getOperatorProfile: (orgId: string, userId: string) =>
    request<OperatorProfile>(`/organizations/${orgId}/members/${userId}/profile`),

  // --- تطوّر الكروت (المرحلة 6) ---
  listCardVersions: (orgId: string, cardId: string) =>
    request<CardVersionListItem[]>(`/organizations/${orgId}/cards/${cardId}/versions`),

  getCardVersion: (orgId: string, cardId: string, version: number) =>
    request<CardVersionView>(`/organizations/${orgId}/cards/${cardId}/versions/${version}`),

  getCardVersionMetrics: (orgId: string, cardId: string) =>
    request<VersionMetrics[]>(`/organizations/${orgId}/cards/${cardId}/versions/metrics`),

  getCardVersionDiff: (orgId: string, cardId: string, from: number, to: number) =>
    request<VersionDiff>(
      `/organizations/${orgId}/cards/${cardId}/versions/diff?from=${from}&to=${to}`,
    ),

  suggestCardImprovement: (orgId: string, cardId: string, focus?: string) =>
    request<CardVersionView>(`/organizations/${orgId}/cards/${cardId}/versions/suggest`, {
      method: "POST",
      body: JSON.stringify({ focus }),
    }),

  publishCardVersion: (orgId: string, cardId: string, version: number) =>
    request<CardVersionView>(
      `/organizations/${orgId}/cards/${cardId}/versions/${version}/publish`,
      { method: "POST" },
    ),

  rollbackCardVersion: (orgId: string, cardId: string, version: number) =>
    request<CardVersionView>(
      `/organizations/${orgId}/cards/${cardId}/versions/${version}/rollback`,
      { method: "POST" },
    ),

  getSuggestedOperators: (orgId: string, cardId: string) =>
    request<SuggestedOperator[]>(`/organizations/${orgId}/cards/${cardId}/suggested-operators`),

  generateCard: (orgId: string, prompt: string) =>
    request<{ jobId: string }>(`/organizations/${orgId}/ai/generate-card`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),

  getGenerateCardStatus: (orgId: string, jobId: string) =>
    request<AiJobView>(`/organizations/${orgId}/ai/generate-card/${jobId}`),

  listChat: (orgId: string, taskId: string) =>
    request<ChatMessageView[]>(`/organizations/${orgId}/tasks/${taskId}/chat`),

  sendChatMessage: (orgId: string, taskId: string, message: string) =>
    request<ChatMessageView>(`/organizations/${orgId}/tasks/${taskId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  // --- الإشعارات (المرحلة 7) ---
  listNotifications: (orgId: string) =>
    request<NotificationView[]>(`/organizations/${orgId}/notifications`),

  getUnreadCount: (orgId: string) =>
    request<{ count: number }>(`/organizations/${orgId}/notifications/unread-count`),

  markNotificationsRead: (orgId: string, input: MarkNotificationsReadInput) =>
    request<{ updated: number }>(`/organizations/${orgId}/notifications/read`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // --- مفاتيح API (المرحلة 7) ---
  listApiKeys: (orgId: string) =>
    request<ApiKeyView[]>(`/organizations/${orgId}/api-keys`),

  createApiKey: (orgId: string, input: CreateApiKeyInput) =>
    request<ApiKeyCreated>(`/organizations/${orgId}/api-keys`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  revokeApiKey: (orgId: string, id: string) =>
    request<ApiKeyView>(`/organizations/${orgId}/api-keys/${id}`, { method: "DELETE" }),

  // --- Webhooks (المرحلة 7) ---
  listWebhooks: (orgId: string) =>
    request<WebhookEndpointView[]>(`/organizations/${orgId}/webhooks`),

  createWebhook: (orgId: string, input: CreateWebhookInput) =>
    request<WebhookEndpointView>(`/organizations/${orgId}/webhooks`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateWebhook: (orgId: string, id: string, input: UpdateWebhookInput) =>
    request<WebhookEndpointView>(`/organizations/${orgId}/webhooks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteWebhook: (orgId: string, id: string) =>
    request<{ removed: true }>(`/organizations/${orgId}/webhooks/${id}`, { method: "DELETE" }),

  listWebhookDeliveries: (orgId: string, id: string) =>
    request<WebhookDeliveryView[]>(`/organizations/${orgId}/webhooks/${id}/deliveries`),

  // --- Phase 9 (السوق والجودة) ---
  updateCardVisibility: (orgId: string, cardId: string, input: UpdateCardVisibilityInput) =>
    request<CardView>(`/organizations/${orgId}/cards/${cardId}/visibility`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  runCardSimulation: (orgId: string, cardId: string, input: RunCardSimulationInput) =>
    request<CardSimulationView>(`/organizations/${orgId}/cards/${cardId}/simulations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listCardSimulations: (orgId: string, cardId: string) =>
    request<CardSimulationView[]>(`/organizations/${orgId}/cards/${cardId}/simulations`),

  getCardSimulation: (orgId: string, cardId: string, id: string) =>
    request<CardSimulationView>(`/organizations/${orgId}/cards/${cardId}/simulations/${id}`),

  browseMarketplace: (vertical?: string) =>
    request<MarketplaceCardListItem[]>(
      `/marketplace/cards${vertical ? `?vertical=${encodeURIComponent(vertical)}` : ""}`,
    ),

  getMarketplaceCard: (cardId: string) =>
    request<MarketplaceCardView>(`/marketplace/cards/${cardId}`),

  purchaseMarketplaceCard: (orgId: string, cardId: string) =>
    request<PurchaseCardResult>(`/organizations/${orgId}/marketplace/purchase/${cardId}`, {
      method: "POST",
    }),

  createQualificationTest: (orgId: string, input: CreateQualificationTestInput) =>
    request<QualificationTestView>(`/organizations/${orgId}/qualification-tests`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listQualificationTests: (orgId: string) =>
    request<QualificationTestForAttempt[]>(`/organizations/${orgId}/qualification-tests`),

  getQualificationTestFull: (orgId: string, id: string) =>
    request<QualificationTestView>(`/organizations/${orgId}/qualification-tests/${id}/full`),

  getQualificationTest: (orgId: string, id: string) =>
    request<QualificationTestForAttempt>(`/organizations/${orgId}/qualification-tests/${id}`),

  attemptQualificationTest: (orgId: string, id: string, input: SubmitQualificationAttemptInput) =>
    request<QualificationAttemptResult>(`/organizations/${orgId}/qualification-tests/${id}/attempts`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listMyQualificationAttempts: (orgId: string) =>
    request<QualificationAttemptResult[]>(`/organizations/${orgId}/qualification-tests/my-attempts`),
};
