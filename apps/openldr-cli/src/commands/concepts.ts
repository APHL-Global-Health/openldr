import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray, emitRow, emitText } from "../output.js";
import { CliError } from "../errors.js";
import { requestGateway } from "../clients/gateway.js";

interface CodingSystem {
  id: string;
  system_code: string;
  system_name: string;
}

interface Concept {
  id: string;
  system_id?: string;
  concept_code?: string;
  display_name?: string;
  concept_class?: string;
  [key: string]: unknown;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

async function resolveSystemId(
  cfg: import("../config.js").LoadedConfig,
  systemCode: string,
): Promise<string> {
  const res = await requestGateway<ApiEnvelope<CodingSystem>>(cfg, {
    path: `/entity-services/api/v1/concepts/systems/code/${encodeURIComponent(systemCode)}`,
    expectStatus: [200, 404],
  });
  if (res.status === 404 || !res.data.data) {
    throw new CliError("NOT_FOUND", `Coding system not found: ${systemCode}`, { systemCode });
  }
  return res.data.data.id;
}

export function registerConceptsCommand(program: Command): void {
  const concepts = program
    .command("concepts")
    .description("Search the openldr_external terminology tables (via entity-services API)");

  concepts
    .command("search <term>")
    .description("Fuzzy search on concept display_name")
    .option("--system <code>", "limit to one coding system (e.g. LOINC, WHONET_ORG)")
    .option("--limit <n>", "max rows", "20")
    .action(async (term: string, opts: { system?: string; limit: string }) => {
      const cmd = concepts.commands.find((c) => c.name() === "search")!;
      const rt = loadRuntime(cmd);
      const query: Record<string, string | number | undefined> = {
        q: term,
        limit: opts.limit,
      };
      if (opts.system) {
        query.system_id = await resolveSystemId(rt.config, opts.system);
      }
      const res = await requestGateway<ApiEnvelope<Concept[]>>(rt.config, {
        path: "/entity-services/api/v1/concepts/concepts/search",
        query,
      });
      emitArray((res.data.data ?? []) as unknown as Record<string, unknown>[], rt.output);
    });

  concepts
    .command("systems")
    .description("List coding systems registered in openldr_external")
    .action(async () => {
      const cmd = concepts.commands.find((c) => c.name() === "systems")!;
      const rt = loadRuntime(cmd);
      const res = await requestGateway<ApiEnvelope<CodingSystem[]>>(rt.config, {
        path: "/entity-services/api/v1/concepts/systems",
      });
      emitArray((res.data.data ?? []) as unknown as Record<string, unknown>[], rt.output);
    });

  concepts
    .command("get <id>")
    .description("Concept detail by UUID (use `concepts search` to find the id)")
    .action(async (id: string) => {
      const cmd = concepts.commands.find((c) => c.name() === "get")!;
      const rt = loadRuntime(cmd);
      const res = await requestGateway<ApiEnvelope<Concept>>(rt.config, {
        path: `/entity-services/api/v1/concepts/concepts/${encodeURIComponent(id)}`,
        expectStatus: [200, 404],
      });
      if (res.status === 404 || !res.data.data) {
        throw new CliError("NOT_FOUND", `Concept not found: ${id}`, { id });
      }
      emitRow(res.data.data as unknown as Record<string, unknown>, rt.output);
    });

  concepts
    .command("mappings <id>")
    .description("Cross-walks (from-mappings and to-mappings) for a concept id")
    .action(async (id: string) => {
      const cmd = concepts.commands.find((c) => c.name() === "mappings")!;
      const rt = loadRuntime(cmd);
      const res = await requestGateway<ApiEnvelope<{ from: unknown[]; to: unknown[] }>>(rt.config, {
        path: `/entity-services/api/v1/concepts/concepts/${encodeURIComponent(id)}/mappings`,
      });
      emitText(JSON.stringify(res.data.data ?? { from: [], to: [] }, null, 2));
    });
}
