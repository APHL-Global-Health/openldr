import type { Command } from "commander";
import { loadRuntime } from "../runtime.js";
import { emitArray } from "../output.js";
import { ERROR_CODES } from "../errors.js";

export function registerErrorsCommand(program: Command): void {
  program
    .command("errors")
    .description("Print the error-code/exit-code table for scripting reference")
    .action(() => {
      const cmd = program.commands.find((c) => c.name() === "errors")!;
      const rt = loadRuntime(cmd);
      const rows = Object.values(ERROR_CODES).map((e) => ({
        code: e.code,
        exit: e.exit,
        description: e.description,
      }));
      emitArray(rows as unknown as Record<string, unknown>[], rt.output);
    });
}
