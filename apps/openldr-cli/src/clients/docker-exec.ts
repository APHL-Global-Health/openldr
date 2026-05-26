import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { CliError } from "../errors.js";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecOptions {
  /** Extra env vars to pass via `docker exec -e KEY=VALUE`. */
  env?: Record<string, string>;
  /** Stdin payload (string or Buffer). */
  input?: string | Buffer;
  /** Working directory inside the container. */
  cwd?: string;
  /** Optional user to run as (`docker exec -u <user>`). */
  user?: string;
}

let dockerAvailable: boolean | undefined;

export function checkDockerAvailable(): void {
  if (dockerAvailable === true) return;
  if (dockerAvailable === false) {
    throw new CliError(
      "CONFIG_MISSING",
      "`docker` CLI not found on PATH or not responsive. --internal mode requires Docker to shell into containers.",
    );
  }
  const r = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    timeout: 5_000,
  });
  if (r.status === 0) {
    dockerAvailable = true;
    return;
  }
  dockerAvailable = false;
  throw new CliError(
    "CONFIG_MISSING",
    `Docker is not available: ${r.stderr || r.error?.message || "unknown error"}`,
  );
}

export function containerIsRunning(name: string): boolean {
  const r = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", name], {
    encoding: "utf8",
    timeout: 5_000,
  });
  return r.status === 0 && r.stdout.trim() === "true";
}

function buildArgs(container: string, cmd: string[], opts: ExecOptions): string[] {
  const args: string[] = ["exec"];
  if (opts.user) args.push("-u", opts.user);
  if (opts.cwd) args.push("-w", opts.cwd);
  for (const [k, v] of Object.entries(opts.env ?? {})) {
    args.push("-e", `${k}=${v}`);
  }
  if (opts.input !== undefined) args.push("-i");
  args.push(container, ...cmd);
  return args;
}

export async function execInContainer(
  container: string,
  cmd: string[],
  opts: ExecOptions = {},
): Promise<ExecResult> {
  checkDockerAvailable();
  if (!containerIsRunning(container)) {
    throw new CliError(
      "NOT_FOUND",
      `Container '${container}' is not running. Start the stack with \`pnpm docker:start\` first.`,
      { container },
    );
  }
  return await new Promise<ExecResult>((resolveP, rejectP) => {
    const args = buildArgs(container, cmd, opts);
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c) => (stderr += c.toString("utf8")));
    child.on("error", rejectP);
    child.on("close", (code) => {
      resolveP({ stdout, stderr, exitCode: code ?? 0 });
    });
    if (opts.input !== undefined) {
      child.stdin.write(opts.input);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

export function streamInContainer(
  container: string,
  cmd: string[],
  opts: ExecOptions = {},
): ChildProcessWithoutNullStreams {
  checkDockerAvailable();
  if (!containerIsRunning(container)) {
    throw new CliError(
      "NOT_FOUND",
      `Container '${container}' is not running.`,
      { container },
    );
  }
  return spawn("docker", buildArgs(container, cmd, opts), { stdio: ["pipe", "pipe", "pipe"] });
}

/** Run `docker cp <container>:<path> <out>`. */
export async function copyFromContainer(container: string, srcPath: string, outPath: string): Promise<void> {
  checkDockerAvailable();
  return await new Promise<void>((resolveP, rejectP) => {
    const child = spawn("docker", ["cp", `${container}:${srcPath}`, outPath], { stdio: "inherit" });
    child.on("error", rejectP);
    child.on("close", (code) => {
      if (code === 0) resolveP();
      else rejectP(new CliError("S3_OP_FAILED", `docker cp exited ${code}`, { container, srcPath, outPath }));
    });
  });
}

/** Run `docker cp <local> <container>:<path>`. */
export async function copyToContainer(localPath: string, container: string, destPath: string): Promise<void> {
  checkDockerAvailable();
  return await new Promise<void>((resolveP, rejectP) => {
    const child = spawn("docker", ["cp", localPath, `${container}:${destPath}`], { stdio: "inherit" });
    child.on("error", rejectP);
    child.on("close", (code) => {
      if (code === 0) resolveP();
      else rejectP(new CliError("S3_OP_FAILED", `docker cp exited ${code}`, { localPath, container, destPath }));
    });
  });
}

export function parsePsqlJson<T = unknown>(stdout: string): T {
  const trimmed = stdout.trim();
  if (trimmed === "" || trimmed === "null") return [] as unknown as T;
  try {
    return JSON.parse(trimmed) as T;
  } catch (err) {
    throw new CliError(
      "DB_QUERY_FAILED",
      `Could not parse psql output as JSON: ${err instanceof Error ? err.message : String(err)}`,
      { sample: trimmed.slice(0, 500) },
    );
  }
}
