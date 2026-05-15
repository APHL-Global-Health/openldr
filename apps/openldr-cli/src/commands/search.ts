import type { Command } from "commander";
import { getSearch, closeSearch } from "../clients/search.js";
import { loadRuntime } from "../runtime.js";
import { emitArray, emitText } from "../output.js";
import { CliError } from "../errors.js";

export function registerSearchCommand(program: Command): void {
  const search = program.command("search").description("Search backend inspection (currently backed by OpenSearch)");

  search
    .command("indices")
    .description("List indices with doc count and size")
    .action(async () => {
      const cmd = search.commands.find((c) => c.name() === "indices")!;
      const rt = loadRuntime(cmd);
      try {
        const res = await getSearch(rt.config).cat.indices({ format: "json", bytes: "b" });
        emitArray(res.body as unknown as Record<string, unknown>[], rt.output);
      } catch (err) {
        throw new CliError(
          "SEARCH_OP_FAILED",
          `indices failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        await closeSearch();
      }
    });

  search
    .command("query <index>")
    .description("Run a query against an index")
    .option("-q, --q <lucene>", "lucene query string (uses q parameter)")
    .option("-b, --body <json>", "raw JSON request body (e.g. '{\"query\":{\"match_all\":{}}}')")
    .option("--size <n>", "max hits", "10")
    .action(async (index: string, opts: { q?: string; body?: string; size: string }) => {
      const cmd = search.commands.find((c) => c.name() === "query")!;
      const rt = loadRuntime(cmd);
      const size = parseInt(opts.size, 10) || 10;
      try {
        const bodyJson = opts.body
          ? (JSON.parse(opts.body) as Record<string, unknown>)
          : opts.q
            ? { query: { query_string: { query: opts.q } } }
            : { query: { match_all: {} } };
        const res = await getSearch(rt.config).search({
          index,
          size,
          body: bodyJson,
        });
        emitText(JSON.stringify(res.body, null, 2));
      } catch (err) {
        throw new CliError(
          "SEARCH_OP_FAILED",
          `query failed: ${err instanceof Error ? err.message : String(err)}`,
          { index },
        );
      } finally {
        await closeSearch();
      }
    });

  search
    .command("get <spec>")
    .description("Fetch a single document (<index>/<id>)")
    .action(async (spec: string) => {
      const cmd = search.commands.find((c) => c.name() === "get")!;
      const rt = loadRuntime(cmd);
      const slash = spec.indexOf("/");
      if (slash === -1) throw new CliError("USAGE", `expected <index>/<id>, got: ${spec}`);
      const index = spec.slice(0, slash);
      const id = spec.slice(slash + 1);
      try {
        const res = await getSearch(rt.config).get({ index, id });
        emitText(JSON.stringify(res.body, null, 2));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/not[_ ]found|404/i.test(msg)) throw new CliError("NOT_FOUND", `Document not found: ${spec}`);
        throw new CliError("SEARCH_OP_FAILED", msg, { spec });
      } finally {
        await closeSearch();
      }
    });

  search
    .command("mapping <index>")
    .description("Print the index mapping")
    .action(async (index: string) => {
      const cmd = search.commands.find((c) => c.name() === "mapping")!;
      const rt = loadRuntime(cmd);
      try {
        const res = await getSearch(rt.config).indices.getMapping({ index });
        emitText(JSON.stringify(res.body, null, 2));
      } catch (err) {
        throw new CliError(
          "SEARCH_OP_FAILED",
          `mapping failed: ${err instanceof Error ? err.message : String(err)}`,
          { index },
        );
      } finally {
        await closeSearch();
      }
    });
}
