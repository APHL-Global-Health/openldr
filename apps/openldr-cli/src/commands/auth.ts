import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitRow, emitArray, emitText } from "../output.js";
import { CliError } from "../errors.js";
import { getClientCredentialsToken, getAdminToken } from "../clients/auth.js";

async function adminFetch<T>(cfg: import("../config.js").LoadedConfig, path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAdminToken(cfg);
  const url = `${cfg.auth.baseUrl}/admin/realms/${cfg.auth.realm}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) throw new CliError("AUTH_FAILED", `${res.status} ${url}`, { body: body.slice(0, 500) });
    if (res.status === 404) throw new CliError("NOT_FOUND", `${res.status} ${url}`, { body: body.slice(0, 500) });
    if (res.status >= 500) throw new CliError("GATEWAY_5XX", `${res.status} ${url}`, { body: body.slice(0, 500) });
    throw new CliError("GATEWAY_4XX", `${res.status} ${url}`, { body: body.slice(0, 500) });
  }
  const ct = res.headers.get("content-type") ?? "";
  if (res.status === 204) return undefined as T;
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export function registerAuthCommand(program: Command): void {
  const auth = program.command("auth").description("Identity provider operations (currently backed by Keycloak)");

  auth
    .command("token")
    .description("Fetch an OAuth2 access token (client_credentials by default)")
    .option("--grant <type>", "client_credentials | admin", "client_credentials")
    .action(async (opts: { grant: string }) => {
      const cmd = auth.commands.find((c) => c.name() === "token")!;
      const rt = loadRuntime(cmd);
      let token: string;
      if (opts.grant === "admin") token = await getAdminToken(rt.config);
      else token = await getClientCredentialsToken(rt.config);
      emitText(JSON.stringify({ grant: opts.grant, access_token: token }));
    });

  const users = auth.command("users").description("User management");

  users
    .command("list")
    .description("List realm users")
    .option("--search <q>", "username/email substring search")
    .option("--limit <n>", "max users", "100")
    .action(async (opts: { search?: string; limit: string }) => {
      const cmd = users.commands.find((c) => c.name() === "list")!;
      const rt = loadRuntime(cmd);
      const params = new URLSearchParams({ max: opts.limit });
      if (opts.search) params.set("search", opts.search);
      const out = await adminFetch<unknown[]>(rt.config, `/users?${params.toString()}`);
      emitArray(out as Record<string, unknown>[], rt.output);
    });

  users
    .command("get <userIdOrUsername>")
    .description("User detail (resolves by id if UUID, otherwise by username)")
    .action(async (key: string) => {
      const cmd = users.commands.find((c) => c.name() === "get")!;
      const rt = loadRuntime(cmd);
      const isUuid = /^[0-9a-f-]{36}$/i.test(key);
      if (isUuid) {
        const u = await adminFetch<Record<string, unknown>>(rt.config, `/users/${key}`);
        emitRow(u, rt.output);
        return;
      }
      const arr = await adminFetch<unknown[]>(rt.config, `/users?username=${encodeURIComponent(key)}`);
      if (!arr || arr.length === 0) throw new CliError("NOT_FOUND", `User not found: ${key}`);
      emitRow(arr[0] as Record<string, unknown>, rt.output);
    });

  users
    .command("create")
    .description("Create a new user (write-gated)")
    .requiredOption("--username <u>", "username")
    .option("--email <e>", "email")
    .option("--password <p>", "initial password (omit to require self-set)")
    .option("--first-name <n>", "first name")
    .option("--last-name <n>", "last name")
    .option("--confirm", "actually create", false)
    .action(
      async (opts: {
        username: string;
        email?: string;
        password?: string;
        firstName?: string;
        lastName?: string;
        confirm?: boolean;
      }) => {
        const cmd = users.commands.find((c) => c.name() === "create")!;
        const rt = loadRuntime(cmd);
        if (!opts.confirm) {
          throw new CliError("WRITE_NOT_CONFIRMED", "Re-run with --confirm to actually create the user.", { username: opts.username });
        }
        const body: Record<string, unknown> = {
          username: opts.username,
          email: opts.email,
          firstName: opts.firstName,
          lastName: opts.lastName,
          enabled: true,
        };
        if (opts.password) {
          body.credentials = [{ type: "password", value: opts.password, temporary: false }];
        }
        await adminFetch(rt.config, `/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        emitText(JSON.stringify({ created: opts.username }));
      },
    );

  const roles = auth.command("roles").description("Role management");

  roles
    .command("list")
    .description("List realm roles")
    .action(async () => {
      const cmd = roles.commands.find((c) => c.name() === "list")!;
      const rt = loadRuntime(cmd);
      const out = await adminFetch<unknown[]>(rt.config, `/roles`);
      emitArray(out as Record<string, unknown>[], rt.output);
    });

  users
    .command("grant <userId>")
    .description("Grant a realm role to a user (write-gated)")
    .requiredOption("--role <r>", "role name")
    .option("--confirm", "actually grant", false)
    .action(async (userId: string, opts: { role: string; confirm?: boolean }) => {
      const cmd = users.commands.find((c) => c.name() === "grant")!;
      const rt = loadRuntime(cmd);
      if (!opts.confirm) throw new CliError("WRITE_NOT_CONFIRMED", "Re-run with --confirm.", { userId, role: opts.role });
      const role = await adminFetch<Record<string, unknown>>(rt.config, `/roles/${encodeURIComponent(opts.role)}`);
      await adminFetch(rt.config, `/users/${userId}/role-mappings/realm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([role]),
      });
      emitText(JSON.stringify({ userId, role: opts.role, granted: true }));
    });
}
