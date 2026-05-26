#!/usr/bin/env node
import { Command, Option } from "commander";
import { formatError } from "./errors.js";
import { maybeEmitJsonHelp } from "./help.js";
import { closeAllPools } from "./clients/postgres.js";
import { disconnectAll as disconnectKafka } from "./clients/kafka.js";
import { closeS3 } from "./clients/s3.js";
import { closeSearch } from "./clients/search.js";

import { registerPingCommand } from "./commands/ping.js";
import { registerHealthCommand } from "./commands/health.js";
import { registerServicesCommand } from "./commands/services.js";
import { registerConfigCommand } from "./commands/config-show.js";
import { registerTablesCommand } from "./commands/tables.js";
import { registerSchemaCommand } from "./commands/schema.js";
import { registerErrorsCommand } from "./commands/errors-cmd.js";
import { registerRunsCommand } from "./commands/runs.js";
import { registerQueueCommand } from "./commands/queue.js";
import { registerDbCommand } from "./commands/db.js";
import { registerS3Command } from "./commands/s3.js";
import { registerSearchCommand } from "./commands/search.js";
import { registerIngestCommand } from "./commands/ingest.js";
import { registerAuthCommand } from "./commands/auth.js";
import { registerPluginsCommand } from "./commands/plugins.js";
import { registerConceptsCommand } from "./commands/concepts.js";

const program = new Command();

program
  .name("openldr")
  .description(
    "Operator CLI for the OpenLDR v2 platform. JSON on stdout, structured errors on stderr, deterministic exit codes. AI-friendly by default.",
  )
  .version("openldr-cli 1.0.0", "-v, --version", "display version")
  .option("--env-file <path>", "path to a .env file to load (default: ./.env)")
  .addOption(
    new Option("--output <fmt>", "output format").choices(["ndjson", "json", "pretty", "table"]),
  )
  .option("--no-color", "disable ANSI colors")
  .option("--quiet", "suppress informational output on stderr")
  .addOption(
    new Option("--log-level <lvl>", "log verbosity")
      .choices(["error", "warn", "info", "debug"])
      .default("info"),
  )
  .option("--gateway-url <url>", "override the HTTPS gateway base URL")
  .option("--insecure-tls", "disable TLS certificate verification (local self-signed certs)")
  .option("--fields <list>", "comma-separated field projection for table/json output")
  .showHelpAfterError(true);

registerPingCommand(program);
registerHealthCommand(program);
registerServicesCommand(program);
registerConfigCommand(program);
registerTablesCommand(program);
registerSchemaCommand(program);
registerErrorsCommand(program);
registerRunsCommand(program);
registerQueueCommand(program);
registerDbCommand(program);
registerS3Command(program);
registerSearchCommand(program);
registerIngestCommand(program);
registerAuthCommand(program);
registerPluginsCommand(program);
registerConceptsCommand(program);

async function cleanup(): Promise<void> {
  await Promise.allSettled([closeAllPools(), disconnectKafka(), closeSearch()]);
  closeS3();
}

async function main(): Promise<void> {
  if (maybeEmitJsonHelp(program, process.argv)) return;
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const { json, exitCode } = formatError(err);
    process.stderr.write(json + "\n");
    process.exitCode = exitCode;
  } finally {
    await cleanup();
  }
}

void main();
