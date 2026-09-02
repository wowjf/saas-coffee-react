import { t } from "../shared/system-texts";
const AUTH_TOKEN_KEY = "cafe_auth_token";

export class ApiRequestError extends Error {
  status?: number;
  code?: string;
  data?: unknown;
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export type UploadImageScope = "avatar" | "category" | "product" | "campaign";

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = options.token ?? getAuthToken();
  const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!headers.has("Content-Type") && options.body && !isFormDataBody) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  const payload = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String(payload.message)
        : t("istek-basarisiz-oldu");
    const error = new ApiRequestError(message);
    error.status = response.status;
    error.data = payload;

    if (typeof payload === "object" && payload && "code" in payload) {
      error.code = String(payload.code);
    }

    throw error;
  }

  return payload as T;
}

export async function uploadImage(scope: UploadImageScope, file: File) {
  const formData = new FormData();
  formData.append("scope", scope);
  formData.append("image", file);

  return apiRequest<{ url: string }>("/api/uploads/image", {
    method: "POST",
    body: formData,
  });
}
