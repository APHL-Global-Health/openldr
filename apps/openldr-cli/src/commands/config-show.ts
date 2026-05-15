import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { redactConfig } from "../config.js";
import { emitText } from "../output.js";

export function registerConfigCommand(program: Command): void {
  const cfg = program
    .command("config")
    .description("Configuration inspection");

  cfg
    .command("show")
    .description("Dump loaded config with secrets redacted")
    .option("--reveal-secrets", "show secret values instead of ***", false)
    .action((opts: { revealSecrets?: boolean }) => {
      const cmd = cfg.commands.find((c) => c.name() === "show")!;
      const rt = loadRuntime(cmd);
      const payload = opts.revealSecrets ? rt.config : redactConfig(rt.config);
      emitText(JSON.stringify(payload, null, 2));
    });
}
