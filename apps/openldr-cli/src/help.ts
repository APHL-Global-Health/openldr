import type { Command, Option } from "commander";

interface JsonOption {
  flags: string;
  description: string;
  defaultValue?: unknown;
  required: boolean;
  optional: boolean;
}

interface JsonCommand {
  name: string;
  description: string;
  usage: string;
  options: JsonOption[];
  arguments: Array<{ name: string; description: string; required: boolean }>;
  subcommands: JsonCommand[];
}

function optionToJson(option: Option): JsonOption {
  return {
    flags: option.flags,
    description: option.description,
    defaultValue: option.defaultValue,
    required: option.required,
    optional: option.optional,
  };
}

export function commandToJson(cmd: Command): JsonCommand {
  return {
    name: cmd.name(),
    description: cmd.description(),
    usage: cmd.usage(),
    options: cmd.options.map(optionToJson),
    arguments: cmd.registeredArguments.map((arg) => ({
      name: arg.name(),
      description: arg.description,
      required: arg.required,
    })),
    subcommands: cmd.commands.map(commandToJson),
  };
}

export function maybeEmitJsonHelp(rootCmd: Command, argv: string[]): boolean {
  if (!argv.includes("--help") && !argv.includes("-h")) return false;
  if (!argv.includes("--json")) return false;

  let target: Command = rootCmd;
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("-")) continue;
    const sub = target.commands.find((c) => c.name() === arg);
    if (sub === undefined) break;
    target = sub;
  }

  process.stdout.write(JSON.stringify(commandToJson(target), null, 2) + "\n");
  return true;
}
