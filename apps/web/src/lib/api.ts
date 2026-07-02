import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  CreateOrganizationInput,
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

  listOrganizations: () =>
    request<
      Array<{ id: string; name: string; slug: string; role: string; createdAt: string }>
    >("/organizations"),

  createOrganization: (input: CreateOrganizationInput) =>
    request<{ id: string; name: string; slug: string }>("/organizations", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
