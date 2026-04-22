import type {
  UserExtensionInstall,
  UserExtensionsResponse,
} from "@/types/extensions";

// const ENV = process.env;
const ENV = import.meta.env;
const IsDev = ENV.MODE === "development";

async function request<T>(
  token: string | undefined,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`${ENV.VITE_API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export async function getUserExtensions(
  token: string | undefined,
): Promise<UserExtensionInstall[]> {
  const data = await request<UserExtensionsResponse>(
    token,
    "GET",
    "/api/v1/extensions/user",
  );
  return data.installs;
}

export async function installExtension(
  token: string | undefined,
  extensionId: string,
  approvedPermissions: string[],
  settings: Record<string, unknown> = {},
): Promise<void> {
  await request(token, "POST", `/api/v1/extensions/user/${extensionId}`, {
    approvedPermissions,
    settings,
  });
}

export async function uninstallExtension(
  token: string | undefined,
  extensionId: string,
): Promise<void> {
  await request(token, "DELETE", `/api/v1/extensions/user/${extensionId}`);
}

export async function updateSettings(
  token: string | undefined,
  extensionId: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await request(token, "PATCH", `/api/v1/extensions/user/${extensionId}`, {
    settings,
  });
}
