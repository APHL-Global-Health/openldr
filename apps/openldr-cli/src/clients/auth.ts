import type { LoadedConfig } from "../config.js";
import { CliError } from "../errors.js";

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
}

function tokenUrl(cfg: LoadedConfig): string {
  return `${cfg.auth.baseUrl}/realms/${cfg.auth.realm}/protocol/openid-connect/token`;
}

export async function getClientCredentialsToken(cfg: LoadedConfig): Promise<string> {
  if (cfg.auth.clientSecret.length === 0) {
    throw new CliError(
      "CONFIG_MISSING",
      "KEYCLOAK_CLIENT_SECRET is empty. Set it in environments/.env.openldr-keycloak or pass via env.",
    );
  }
  const cacheKey = `cc:${cfg.auth.clientId}`;
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > now + 5_000) return cached.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.auth.clientId,
    client_secret: cfg.auth.clientSecret,
  });

  let res: Response;
  try {
    res = await fetch(tokenUrl(cfg), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (err) {
    throw new CliError(
      "AUTH_FAILED",
      `Token endpoint unreachable: ${err instanceof Error ? err.message : String(err)}`,
      { url: tokenUrl(cfg) },
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CliError("AUTH_FAILED", `Token endpoint returned ${res.status}`, {
      url: tokenUrl(cfg),
      status: res.status,
      body: text.slice(0, 500),
    });
  }

  const json = (await res.json()) as TokenResponse;
  if (typeof json.access_token !== "string" || json.access_token.length === 0) {
    throw new CliError("AUTH_FAILED", "Token response missing access_token", { json });
  }
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 60;
  tokenCache.set(cacheKey, { token: json.access_token, expiresAt: now + expiresIn * 1_000 });
  return json.access_token;
}

export async function getAdminToken(cfg: LoadedConfig): Promise<string> {
  if (!cfg.auth.adminUser || !cfg.auth.adminPassword) {
    throw new CliError(
      "CONFIG_MISSING",
      "KEYCLOAK_ADMIN_USER / KEYCLOAK_ADMIN_PASSWORD not configured (required for admin-realm operations)",
    );
  }
  const cacheKey = `admin:${cfg.auth.adminUser}`;
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > now + 5_000) return cached.token;

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: "admin-cli",
    username: cfg.auth.adminUser,
    password: cfg.auth.adminPassword,
  });

  const adminTokenUrl = `${cfg.auth.baseUrl}/realms/master/protocol/openid-connect/token`;
  const res = await fetch(adminTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CliError("AUTH_FAILED", `Admin token request returned ${res.status}`, {
      url: adminTokenUrl,
      status: res.status,
      body: text.slice(0, 500),
    });
  }
  const json = (await res.json()) as TokenResponse;
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 60;
  tokenCache.set(cacheKey, { token: json.access_token, expiresAt: now + expiresIn * 1_000 });
  return json.access_token;
}
