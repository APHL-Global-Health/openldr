import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray, emitRow } from "../output.js";
import { query } from "../clients/postgres.js";
import { CliError } from "../errors.js";

export function registerConceptsCommand(program: Command): void {
  const concepts = program.command("concepts").description("Search the openldr_external terminology tables");

  concepts
    .command("search <term>")
    .description("Fuzzy GIN-index search against concepts.display_name")
    .option("--system <code>", "limit to one coding system (e.g. LOINC, WHONET_ORG)")
    .option("--class <c>", "concept_class filter (e.g. test, panel, organism, antibiotic)")
    .option("--limit <n>", "max rows", "20")
    .action(async (term: string, opts: { system?: string; class?: string; limit: string }) => {
      const cmd = concepts.commands.find((c) => c.name() === "search")!;
      const rt = loadRuntime(cmd);
      const where: string[] = ["display_name % $1"];
      const params: unknown[] = [term];
      if (opts.system) {
        params.push(opts.system);
        where.push(`system_id = (SELECT id FROM coding_systems WHERE system_code = $${params.length})`);
      }
      if (opts.class) {
        params.push(opts.class);
        where.push(`concept_class = $${params.length}`);
      }
      params.push(parseInt(opts.limit, 10) || 20);
      const sql = `
        SELECT
          c.id, cs.system_code AS system, c.concept_code, c.display_name, c.concept_class, c.datatype,
          similarity(c.display_name, $1) AS sim
        FROM concepts c
        JOIN coding_systems cs ON cs.id = c.system_id
        WHERE ${where.join(" AND ")}
        ORDER BY sim DESC
        LIMIT $${params.length}
      `;
      const result = await query(rt.config, "openldr_external", sql, params);
      emitArray(result.rows as Record<string, unknown>[], rt.output);
    });

  concepts
    .command("get <spec>")
    .description("Fetch one concept by <system>/<code>")
    .action(async (spec: string) => {
      const cmd = concepts.commands.find((c) => c.name() === "get")!;
      const rt = loadRuntime(cmd);
      const slash = spec.indexOf("/");
      if (slash === -1) throw new CliError("USAGE", `expected <system>/<code>, got: ${spec}`);
      const system = spec.slice(0, slash);
      const code = spec.slice(slash + 1);
      const result = await query(
        rt.config,
        "openldr_external",
        `SELECT c.*, cs.system_code AS system
         FROM concepts c JOIN coding_systems cs ON cs.id = c.system_id
         WHERE cs.system_code = $1 AND c.concept_code = $2 LIMIT 1`,
        [system, code],
      );
      if (result.rowCount === 0) throw new CliError("NOT_FOUND", `Concept not found: ${spec}`, { system, code });
      emitRow(result.rows[0] as Record<string, unknown>, rt.output);
    });

  concepts
    .command("mappings <fromCode>")
    .description("List cross-walks for a concept (uses to_system_code / to_concept_code fields)")
    .option("--to-system <s>", "filter on target system_code")
    .option("--limit <n>", "max rows", "50")
    .action(async (fromCode: string, opts: { toSystem?: string; limit: string }) => {
      const cmd = concepts.commands.find((c) => c.name() === "mappings")!;
      const rt = loadRuntime(cmd);
      const params: unknown[] = [fromCode];
      let toClause = "";
      if (opts.toSystem) {
        params.push(opts.toSystem);
        toClause = `AND m.to_system_code = $${params.length}`;
      }
      params.push(parseInt(opts.limit, 10) || 50);
      const sql = `
        SELECT
          fc.concept_code AS from_code,
          fcs.system_code AS from_system,
          m.to_system_code AS to_system,
          m.to_concept_code AS to_code,
          m.to_concept_name AS to_name,
          m.map_type, m.relationship
        FROM concept_mappings m
        JOIN concepts fc ON fc.id = m.from_concept_id
        JOIN coding_systems fcs ON fcs.id = fc.system_id
        WHERE fc.concept_code = $1 ${toClause}
        ORDER BY m.map_type
        LIMIT $${params.length}
      `;
      const result = await query(rt.config, "openldr_external", sql, params);
      emitArray(result.rows as Record<string, unknown>[], rt.output);
    });
}
