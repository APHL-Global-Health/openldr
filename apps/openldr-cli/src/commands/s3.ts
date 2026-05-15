import type { Command } from "commander";
import { createReadStream } from "node:fs";
import { createWriteStream } from "node:fs";
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
import { loadRuntime } from "../runtime.js";
import { emitArray, emitRow, emitText } from "../output.js";
import { CliError } from "../errors.js";

function splitKey(spec: string): { bucket: string; key: string } {
  const idx = spec.indexOf("/");
  if (idx === -1) throw new CliError("USAGE", `expected <bucket>/<key>, got: ${spec}`);
  return { bucket: spec.slice(0, idx), key: spec.slice(idx + 1) };
}

export function registerS3Command(program: Command): void {
  const s3 = program.command("s3").description("Object storage inspection (currently backed by MinIO)");

  s3
    .command("buckets")
    .description("List buckets")
    .action(async () => {
      const cmd = s3.commands.find((c) => c.name() === "buckets")!;
      const rt = loadRuntime(cmd);
      try {
        const out = await getS3(rt.config).send(new ListBucketsCommand({}));
        const rows = (out.Buckets ?? []).map((b) => ({
          name: b.Name,
          created_at: b.CreationDate?.toISOString(),
        }));
        emitArray(rows as unknown as Record<string, unknown>[], rt.output);
      } finally {
        closeS3();
      }
    });

  s3
    .command("ls <bucket>")
    .description("List objects in a bucket")
    .option("--prefix <p>", "key prefix filter")
    .option("--limit <n>", "max keys", "100")
    .action(async (bucket: string, opts: { prefix?: string; limit: string }) => {
      const cmd = s3.commands.find((c) => c.name() === "ls")!;
      const rt = loadRuntime(cmd);
      try {
        const out = await getS3(rt.config).send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: opts.prefix,
            MaxKeys: parseInt(opts.limit, 10) || 100,
          }),
        );
        const rows = (out.Contents ?? []).map((o) => ({
          key: o.Key,
          size: o.Size,
          last_modified: o.LastModified?.toISOString(),
          etag: o.ETag,
        }));
        emitArray(rows as unknown as Record<string, unknown>[], rt.output);
      } finally {
        closeS3();
      }
    });

  s3
    .command("cat <spec>")
    .description("Stream object body to stdout (<bucket>/<key>)")
    .action(async (spec: string) => {
      const cmd = s3.commands.find((c) => c.name() === "cat")!;
      const rt = loadRuntime(cmd);
      const { bucket, key } = splitKey(spec);
      try {
        const out = await getS3(rt.config).send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!out.Body) throw new CliError("NOT_FOUND", `Empty body for ${spec}`);
        await pipeline(out.Body as Readable, process.stdout);
      } catch (err) {
        if (err instanceof CliError) throw err;
        throw new CliError(
          "S3_OP_FAILED",
          `cat failed: ${err instanceof Error ? err.message : String(err)}`,
          { bucket, key },
        );
      } finally {
        closeS3();
      }
    });

  s3
    .command("stat <spec>")
    .description("Object metadata (size, content-type, last-modified)")
    .action(async (spec: string) => {
      const cmd = s3.commands.find((c) => c.name() === "stat")!;
      const rt = loadRuntime(cmd);
      const { bucket, key } = splitKey(spec);
      try {
        const out = await getS3(rt.config).send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        emitRow(
          {
            bucket,
            key,
            size: out.ContentLength,
            content_type: out.ContentType,
            etag: out.ETag,
            last_modified: out.LastModified?.toISOString(),
            metadata: out.Metadata,
          },
          rt.output,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/NotFound|NoSuchKey/.test(msg)) throw new CliError("NOT_FOUND", `Object not found: ${spec}`, { bucket, key });
        throw new CliError("S3_OP_FAILED", msg, { bucket, key });
      } finally {
        closeS3();
      }
    });

  s3
    .command("download <spec>")
    .description("Binary-safe download to a file")
    .requiredOption("--out <path>", "local file path")
    .action(async (spec: string, opts: { out: string }) => {
      const cmd = s3.commands.find((c) => c.name() === "download")!;
      const rt = loadRuntime(cmd);
      const { bucket, key } = splitKey(spec);
      try {
        const out = await getS3(rt.config).send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!out.Body) throw new CliError("NOT_FOUND", `Empty body for ${spec}`);
        await pipeline(out.Body as Readable, createWriteStream(opts.out));
        emitText(JSON.stringify({ bucket, key, out: opts.out }));
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
    .action(async (bucket: string, opts: { file: string; key?: string; contentType?: string; confirm?: boolean }) => {
      const cmd = s3.commands.find((c) => c.name() === "upload")!;
      const rt = loadRuntime(cmd);
      if (!opts.confirm) {
        throw new CliError("WRITE_NOT_CONFIRMED", `Upload is mutating. Re-run with --confirm.`, { bucket, file: opts.file });
      }
      const key = opts.key ?? opts.file.split("/").pop()!;
      const size = (await fsStat(opts.file)).size;
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
      } finally {
        closeS3();
      }
    });
}
