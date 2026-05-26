import type { Command } from "commander";
import { createReadStream, createWriteStream } from "node:fs";
import { stat as fsStat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  ListBucketsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getS3, closeS3 } from "../clients/s3.js";
import {
  execInContainer,
  streamInContainer,
  copyFromContainer,
  copyToContainer,
} from "../clients/docker-exec.js";
import { loadRuntime } from "../runtime.js";
import { emitArray, emitRow, emitText } from "../output.js";
import { CliError } from "../errors.js";

function splitKey(spec: string): { bucket: string; key: string } {
  const idx = spec.indexOf("/");
  if (idx === -1) throw new CliError("USAGE", `expected <bucket>/<key>, got: ${spec}`);
  return { bucket: spec.slice(0, idx), key: spec.slice(idx + 1) };
}

function wrapS3Error(err: unknown, gatewayUrl: string, context: Record<string, unknown> = {}): CliError {
  if (err instanceof CliError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH/.test(msg)) {
    return new CliError(
      "S3_OP_FAILED",
      `Object storage unreachable: ${msg}. ` +
        `MinIO's S3 API cannot be proxied through the HTTPS gateway (nginx path rewriting breaks SigV4). Either ` +
        `(a) re-run with --internal (uses \`docker exec mc\` inside openldr-minio), ` +
        `(b) publish MINIO_API_PORT (default 9000) on the host in docker-compose.yml, or ` +
        `(c) for ad-hoc browsing use the MinIO console UI at ${gatewayUrl}/minio-console/.`,
      context,
    );
  }
  if (/NotFound|NoSuchKey|NoSuchBucket/.test(msg)) {
    return new CliError("NOT_FOUND", msg, context);
  }
  return new CliError("S3_OP_FAILED", msg, context);
}

interface McContext {
  container: string;
  envPrefix: Record<string, string>;
  alias: string;
}

function mcCtx(cfg: import("../config.js").LoadedConfig): McContext {
  const alias = "openldr";
  return {
    container: cfg.s3.container,
    envPrefix: { [`MC_HOST_${alias}`]: `http://${cfg.s3.accessKey}:${cfg.s3.secretKey}@localhost:9000` },
    alias,
  };
}

async function mcRun(
  ctx: McContext,
  subargs: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return await execInContainer(ctx.container, ["mc", "--json", ...subargs], { env: ctx.envPrefix });
}

function parseMcJsonLines(stdout: string): Record<string, unknown>[] {
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return { raw: line };
      }
    });
}

export function registerS3Command(program: Command): void {
  const s3 = program.command("s3").description("Object storage inspection (currently backed by MinIO)");

  s3
    .command("buckets")
    .description("List buckets")
    .option("--internal", "list via `docker exec mc ls` inside openldr-minio", false)
    .action(async (opts: { internal?: boolean }) => {
      const cmd = s3.commands.find((c) => c.name() === "buckets")!;
      const rt = loadRuntime(cmd);
      if (opts.internal) {
        const ctx = mcCtx(rt.config);
        const r = await mcRun(ctx, ["ls", ctx.alias]);
        if (r.exitCode !== 0) throw new CliError("S3_OP_FAILED", r.stderr.trim() || "mc ls failed");
        emitArray(parseMcJsonLines(r.stdout), rt.output);
        return;
      }
      try {
        const out = await getS3(rt.config).send(new ListBucketsCommand({}));
        const rows = (out.Buckets ?? []).map((b) => ({
          name: b.Name,
          created_at: b.CreationDate?.toISOString(),
        }));
        emitArray(rows as unknown as Record<string, unknown>[], rt.output);
      } catch (err) {
        throw wrapS3Error(err, rt.config.gateway.url);
      } finally {
        closeS3();
      }
    });

  s3
    .command("ls <bucket>")
    .description("List objects in a bucket")
    .option("--prefix <p>", "key prefix filter")
    .option("--limit <n>", "max keys", "100")
    .option("--internal", "list via `docker exec mc` inside openldr-minio", false)
    .action(
      async (
        bucket: string,
        opts: { prefix?: string; limit: string; internal?: boolean },
      ) => {
        const cmd = s3.commands.find((c) => c.name() === "ls")!;
        const rt = loadRuntime(cmd);
        const limit = parseInt(opts.limit, 10) || 100;
        if (opts.internal) {
          const ctx = mcCtx(rt.config);
          const path = `${ctx.alias}/${bucket}${opts.prefix ? "/" + opts.prefix : ""}`;
          const r = await mcRun(ctx, ["ls", "--recursive", path]);
          if (r.exitCode !== 0) throw new CliError("S3_OP_FAILED", r.stderr.trim(), { bucket });
          emitArray(parseMcJsonLines(r.stdout).slice(0, limit), rt.output);
          return;
        }
        try {
          const out = await getS3(rt.config).send(
            new ListObjectsV2Command({ Bucket: bucket, Prefix: opts.prefix, MaxKeys: limit }),
          );
          const rows = (out.Contents ?? []).map((o) => ({
            key: o.Key,
            size: o.Size,
            last_modified: o.LastModified?.toISOString(),
            etag: o.ETag,
          }));
          emitArray(rows as unknown as Record<string, unknown>[], rt.output);
        } catch (err) {
          throw wrapS3Error(err, rt.config.gateway.url, { bucket });
        } finally {
          closeS3();
        }
      },
    );

  s3
    .command("cat <spec>")
    .description("Stream object body to stdout (<bucket>/<key>)")
    .option("--internal", "stream via `docker exec mc cat` inside openldr-minio", false)
    .action(async (spec: string, opts: { internal?: boolean }) => {
      const cmd = s3.commands.find((c) => c.name() === "cat")!;
      const rt = loadRuntime(cmd);
      const { bucket, key } = splitKey(spec);
      if (opts.internal) {
        const ctx = mcCtx(rt.config);
        const child = streamInContainer(ctx.container, ["mc", "cat", `${ctx.alias}/${bucket}/${key}`], {
          env: ctx.envPrefix,
        });
        await new Promise<void>((resolveP, rejectP) => {
          child.stdout.pipe(process.stdout);
          let stderr = "";
          child.stderr.on("data", (c) => (stderr += c.toString("utf8")));
          child.on("error", rejectP);
          child.on("close", (code) => {
            if (code === 0) resolveP();
            else rejectP(new CliError("S3_OP_FAILED", stderr.trim() || `mc cat exited ${code}`, { bucket, key }));
          });
        });
        return;
      }
      try {
        const out = await getS3(rt.config).send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!out.Body) throw new CliError("NOT_FOUND", `Empty body for ${spec}`, { bucket, key });
        await pipeline(out.Body as Readable, process.stdout);
      } catch (err) {
        throw wrapS3Error(err, rt.config.gateway.url, { bucket, key });
      } finally {
        closeS3();
      }
    });

  s3
    .command("stat <spec>")
    .description("Object metadata (size, content-type, last-modified)")
    .option("--internal", "stat via `docker exec mc stat` inside openldr-minio", false)
    .action(async (spec: string, opts: { internal?: boolean }) => {
      const cmd = s3.commands.find((c) => c.name() === "stat")!;
      const rt = loadRuntime(cmd);
      const { bucket, key } = splitKey(spec);
      if (opts.internal) {
        const ctx = mcCtx(rt.config);
        const r = await mcRun(ctx, ["stat", `${ctx.alias}/${bucket}/${key}`]);
        if (r.exitCode !== 0) {
          if (/Object does not exist/i.test(r.stderr) || /NoSuchKey/.test(r.stderr)) {
            throw new CliError("NOT_FOUND", `Object not found: ${spec}`, { bucket, key });
          }
          throw new CliError("S3_OP_FAILED", r.stderr.trim(), { bucket, key });
        }
        emitArray(parseMcJsonLines(r.stdout), rt.output);
        return;
      }
      try {
        const out = await getS3(rt.config).send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        emitRow(
          {
            bucket, key,
            size: out.ContentLength,
            content_type: out.ContentType,
            etag: out.ETag,
            last_modified: out.LastModified?.toISOString(),
            metadata: out.Metadata,
          },
          rt.output,
        );
      } catch (err) {
        throw wrapS3Error(err, rt.config.gateway.url, { bucket, key });
      } finally {
        closeS3();
      }
    });

  s3
    .command("download <spec>")
    .description("Binary-safe download to a file")
    .requiredOption("--out <path>", "local file path")
    .option("--internal", "download via `docker cp` (uses tmp file inside the container)", false)
    .action(async (spec: string, opts: { out: string; internal?: boolean }) => {
      const cmd = s3.commands.find((c) => c.name() === "download")!;
      const rt = loadRuntime(cmd);
      const { bucket, key } = splitKey(spec);
      if (opts.internal) {
        const ctx = mcCtx(rt.config);
        const tmp = `/tmp/openldr-cli-dl-${process.pid}-${Date.now()}`;
        const r = await mcRun(ctx, ["cp", `${ctx.alias}/${bucket}/${key}`, tmp]);
        if (r.exitCode !== 0) throw new CliError("S3_OP_FAILED", r.stderr.trim(), { bucket, key });
        await copyFromContainer(ctx.container, tmp, opts.out);
        await execInContainer(ctx.container, ["rm", "-f", tmp]);
        emitText(JSON.stringify({ bucket, key, out: opts.out }));
        return;
      }
      try {
        const out = await getS3(rt.config).send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!out.Body) throw new CliError("NOT_FOUND", `Empty body for ${spec}`, { bucket, key });
        await pipeline(out.Body as Readable, createWriteStream(opts.out));
        emitText(JSON.stringify({ bucket, key, out: opts.out }));
      } catch (err) {
        throw wrapS3Error(err, rt.config.gateway.url, { bucket, key });
      } finally {
        closeS3();
      }
    });

  s3
    .command("upload <bucket>")
    .description("Hand-upload a local file to a bucket (write-gated)")
    .requiredOption("--file <path>", "local file path")
    .option("--key <k>", "object key (default: basename of --file)")
    .option("--content-type <ct>", "MIME type")
    .option("--confirm", "actually upload", false)
    .option("--internal", "upload via `docker cp` + `mc cp`", false)
    .action(
      async (
        bucket: string,
        opts: {
          file: string;
          key?: string;
          contentType?: string;
          confirm?: boolean;
          internal?: boolean;
        },
      ) => {
        const cmd = s3.commands.find((c) => c.name() === "upload")!;
        const rt = loadRuntime(cmd);
        if (!opts.confirm) {
          throw new CliError("WRITE_NOT_CONFIRMED", `Upload is mutating. Re-run with --confirm.`, { bucket, file: opts.file });
        }
        const key = opts.key ?? opts.file.split("/").pop()!;
        const size = (await fsStat(opts.file)).size;
        if (opts.internal) {
          const ctx = mcCtx(rt.config);
          const tmp = `/tmp/openldr-cli-up-${process.pid}-${Date.now()}`;
          await copyToContainer(opts.file, ctx.container, tmp);
          const r = await mcRun(ctx, ["cp", tmp, `${ctx.alias}/${bucket}/${key}`]);
          await execInContainer(ctx.container, ["rm", "-f", tmp]);
          if (r.exitCode !== 0) throw new CliError("S3_OP_FAILED", r.stderr.trim(), { bucket, key });
          emitText(JSON.stringify({ bucket, key, size, via: "internal" }));
          return;
        }
        try {
          await getS3(rt.config).send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: createReadStream(opts.file),
              ContentLength: size,
              ContentType: opts.contentType,
            }),
          );
          emitText(JSON.stringify({ bucket, key, size }));
        } catch (err) {
          throw wrapS3Error(err, rt.config.gateway.url, { bucket, key });
        } finally {
          closeS3();
        }
      },
    );
}
