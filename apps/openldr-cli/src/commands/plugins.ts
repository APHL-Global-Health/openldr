import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray, emitRow, emitText } from "../output.js";
import { CliError } from "../errors.js";
import { requestGateway } from "../clients/gateway.js";

interface Plugin {
  id?: string;
  name?: string;
  pluginType?: string;
  status?: string;
  version?: string;
  description?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface PluginListResponse {
  ok?: boolean;
  data?: { plugins: Plugin[] | Plugin[][] };
}

function flattenPlugins(resp: PluginListResponse | Plugin[]): Plugin[] {
  if (Array.isArray(resp)) return resp;
  const raw = resp.data?.plugins;
  if (!raw) return [];
  if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
    return (raw as Plugin[][]).flat();
  }
  return raw as Plugin[];
}

export function registerPluginsCommand(program: Command): void {
  const plugins = program.command("plugins").description("Manage data-pipeline plugins (via entity-services API)");

  plugins
    .command("list")
    .description("List plugins, optionally filtered by type")
    .option("--type <t>", "validation | mapping | storage | outpost")
    .option("--status <s>", "filter by status (active | draft | inactive | deprecated)")
    .action(async (opts: { type?: string; status?: string }) => {
      const cmd = plugins.commands.find((c) => c.name() === "list")!;
      const rt = loadRuntime(cmd);
      const res = await requestGateway<PluginListResponse>(rt.config, {
        path: "/data-processing/api/v1/projects/plugins",
        query: { slot: opts.type },
      });
      const rows = flattenPlugins(res.data);
      const filtered = opts.status ? rows.filter((p) => p.status === opts.status) : rows;
      emitArray(filtered as unknown as Record<string, unknown>[], rt.output);
    });

  plugins
    .command("get <id>")
    .description("Plugin detail by id (includes script content from MinIO)")
    .action(async (id: string) => {
      const cmd = plugins.commands.find((c) => c.name() === "get")!;
      const rt = loadRuntime(cmd);
      const res = await requestGateway<Plugin>(rt.config, {
        path: `/entity-services/api/v1/plugin/get-plugin/${encodeURIComponent(id)}`,
      });
      emitRow(res.data as unknown as Record<string, unknown>, rt.output);
    });

  plugins
    .command("enable <id>")
    .description("Set plugin status=active via entity-services update endpoint (write-gated)")
    .option("--confirm", "actually update", false)
    .action(async (id: string, opts: { confirm?: boolean }) => {
      const cmd = plugins.commands.find((c) => c.name() === "enable")!;
      const rt = loadRuntime(cmd);
      if (!opts.confirm) {
        throw new CliError("WRITE_NOT_CONFIRMED", "Re-run with --confirm.", { id });
      }
      const res = await requestGateway<unknown>(rt.config, {
        method: "PUT",
        path: `/entity-services/api/v1/plugin/update-plugin/${encodeURIComponent(id)}`,
        body: { status: "active" },
      });
      emitText(JSON.stringify({ id, status: "active", server: res.data }));
    });

  plugins
    .command("disable <id>")
    .description("Set plugin status=inactive (write-gated)")
    .option("--confirm", "actually update", false)
    .action(async (id: string, opts: { confirm?: boolean }) => {
      const cmd = plugins.commands.find((c) => c.name() === "disable")!;
      const rt = loadRuntime(cmd);
      if (!opts.confirm) {
        throw new CliError("WRITE_NOT_CONFIRMED", "Re-run with --confirm.", { id });
      }
      const res = await requestGateway<unknown>(rt.config, {
        method: "PUT",
        path: `/entity-services/api/v1/plugin/update-plugin/${encodeURIComponent(id)}`,
        body: { status: "inactive" },
      });
      emitText(JSON.stringify({ id, status: "inactive", server: res.data }));
    });

  plugins
    .command("delete <id>")
    .description("Delete a plugin (write-gated)")
    .option("--confirm", "actually delete", false)
    .action(async (id: string, opts: { confirm?: boolean }) => {
      const cmd = plugins.commands.find((c) => c.name() === "delete")!;
      const rt = loadRuntime(cmd);
      if (!opts.confirm) throw new CliError("WRITE_NOT_CONFIRMED", "Re-run with --confirm.", { id });
      await requestGateway(rt.config, {
        method: "DELETE",
        path: `/entity-services/api/v1/plugin/delete-plugin/${encodeURIComponent(id)}`,
      });
      emitText(JSON.stringify({ id, deleted: true }));
    });
}
