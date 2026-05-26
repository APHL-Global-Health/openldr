import type { LoadedConfig } from "../config.js";
import { CliError } from "../errors.js";
import { getClientCredentialsToken } from "./auth.js";

export interface GatewayRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: "client_credentials" | "none";
  baseUrl?: string;
  timeoutMs?: number;
  expectStatus?: number[];
}

export interface GatewayResponse<T> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function buildUrl(base: string, path: string, query?: GatewayRequestOptions["query"]): string {
  const url = joinUrl(base, path);
  if (!query || Object.keys(query).length === 0) return url;
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    search.set(k, String(v));
  }
  const qs = search.toString();
  return qs.length === 0 ? url : `${url}?${qs}`;
}

export async function requestGateway<T = unknown>(
  cfg: LoadedConfig,
  opts: GatewayRequestOptions,
): Promise<GatewayResponse<T>> {
  const method = opts.method ?? "GET";
  const base = opts.baseUrl ?? cfg.gateway.url;
  const url = buildUrl(base, opts.path, opts.query);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...opts.headers,
  };
  if ((opts.auth ?? "client_credentials") === "client_credentials") {
    const token = await getClientCredentialsToken(cfg);
    headers.Authorization = `Bearer ${token}`;
  }
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers:
        opts.body !== undefined && typeof opts.body !== "string"
          ? { ...headers, "Content-Type": "application/json" }
          : headers,
      body:
        opts.body === undefined
          ? undefined
          : typeof opts.body === "string"
            ? opts.body
            : JSON.stringify(opts.body),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new CliError("TIMEOUT", `Gateway request timed out: ${method} ${url}`, { url });
    }
    throw new CliError(
      "GATEWAY_5XX",
      `Gateway request failed: ${err instanceof Error ? err.message : String(err)}`,
      { url },
    );
  } finally {
    clearTimeout(timeout);
  }

  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => (responseHeaders[k] = v));

  const contentType = res.headers.get("content-type") ?? "";
  let data: unknown;
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => undefined);
  } else {
    data = await res.text();
  }

  const allowed = opts.expectStatus ?? [200, 201, 202, 204];
  if (!allowed.includes(res.status)) {
    if (res.status >= 500) {
      throw new CliError("GATEWAY_5XX", `Gateway returned ${res.status} for ${method} ${url}`, {
        url,
        status: res.status,
        body: data,
      });
    }
    if (res.status === 401 || res.status === 403) {
      throw new CliError("AUTH_FAILED", `Authentication failed (${res.status}) for ${method} ${url}`, {
        url,
        status: res.status,
        body: data,
      });
    }
    if (res.status === 404) {
      throw new CliError("NOT_FOUND", `Resource not found: ${method} ${url}`, {
        url,
        status: res.status,
        body: data,
      });
    }
    throw new CliError("GATEWAY_4XX", `Gateway returned ${res.status} for ${method} ${url}`, {
      url,
      status: res.status,
      body: data,
    });
  }

  return { status: res.status, data: data as T, headers: responseHeaders };
}
