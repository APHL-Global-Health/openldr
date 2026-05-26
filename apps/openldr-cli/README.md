# @openldr/cli

Operator CLI for the OpenLDR v2 platform. JSON on stdout, structured errors on stderr, deterministic exit codes. AI-friendly by default.

See [OPENLDR_CLI.md](./OPENLDR_CLI.md) for the full command reference. Point any Claude / LLM session at that file to operate the platform autonomously.

## Quick start

```bash
pnpm install
pnpm --filter @openldr/cli dev --help
pnpm --filter @openldr/cli dev ping
pnpm --filter @openldr/cli dev --help --json | jq .subcommands
```

## Layout

```
src/
├── index.ts        # commander root + subcommand registration
├── config.ts       # zod-validated env loader
├── output.ts       # ndjson | json | pretty serializers
├── errors.ts       # CliError + exit-code map
├── help.ts         # --help --json schema emitter
├── runtime.ts      # lazy service client factory
├── clients/        # vendor-specific client wrappers
└── commands/       # vendor-neutral command surface
```

## License

Apache-2.0
