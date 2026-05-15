import type { Command } from "commander";
import { readFile } from "node:fs/promises";
import { getAdmin, newConsumer, newProducer, disconnectAll } from "../clients/kafka.js";
import { loadRuntime, emitMetaIfNotQuiet } from "../runtime.js";
import { emitArray, emitRow, emitText } from "../output.js";
import { CliError } from "../errors.js";

export function registerQueueCommand(program: Command): void {
  const queue = program.command("queue").description("Inspect the message queue (currently backed by Kafka)");

  queue
    .command("topics")
    .description("List topics with partition count and config metadata")
    .action(async () => {
      const cmd = queue.commands.find((c) => c.name() === "topics")!;
      const rt = loadRuntime(cmd);
      const admin = await getAdmin(rt.config);
      try {
        const metadata = await admin.fetchTopicMetadata();
        const rows = metadata.topics.map((t) => ({
          topic: t.name,
          partitions: t.partitions.length,
          replicas: t.partitions[0]?.replicas.length ?? 0,
        }));
        emitArray(rows as unknown as Record<string, unknown>[], rt.output);
      } finally {
        await disconnectAll();
      }
    });

  queue
    .command("offsets")
    .description("Per-consumer-group offset lag")
    .option("--group <g>", "limit to one consumer group")
    .action(async (opts: { group?: string }) => {
      const cmd = queue.commands.find((c) => c.name() === "offsets")!;
      const rt = loadRuntime(cmd);
      const admin = await getAdmin(rt.config);
      try {
        const { groups } = await admin.listGroups();
        const filtered = opts.group ? groups.filter((g) => g.groupId === opts.group) : groups;
        const rows: Record<string, unknown>[] = [];
        for (const g of filtered) {
          const offsets = await admin.fetchOffsets({ groupId: g.groupId });
          for (const t of offsets) {
            for (const p of t.partitions) {
              rows.push({
                groupId: g.groupId,
                topic: t.topic,
                partition: p.partition,
                offset: p.offset,
                metadata: p.metadata,
              });
            }
          }
        }
        emitArray(rows, rt.output);
      } finally {
        await disconnectAll();
      }
    });

  queue
    .command("tail <topic>")
    .description("Stream messages from a topic to stdout (NDJSON by default)")
    .option("--from-beginning", "start from the earliest available offset", false)
    .option("--limit <n>", "stop after N messages", "20")
    .option("--group <g>", "explicit consumer group id (default: ephemeral random)")
    .action(async (topic: string, opts: { fromBeginning?: boolean; limit: string; group?: string }) => {
      const cmd = queue.commands.find((c) => c.name() === "tail")!;
      const rt = loadRuntime(cmd);
      const limit = parseInt(opts.limit, 10) || 20;
      const groupId = opts.group ?? `openldr-cli-tail-${process.pid}-${Date.now()}`;
      const consumer = newConsumer(rt.config, groupId);
      try {
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: opts.fromBeginning ?? false });
        let received = 0;
        await new Promise<void>((resolveP, rejectP) => {
          consumer
            .run({
              eachMessage: async ({ partition, message }) => {
                const value = message.value === null ? null : message.value.toString("utf8");
                let parsed: unknown = value;
                if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
                  try { parsed = JSON.parse(value); } catch { /* keep as string */ }
                }
                emitRow(
                  {
                    topic,
                    partition,
                    offset: message.offset,
                    key: message.key === null ? null : message.key.toString("utf8"),
                    timestamp: message.timestamp,
                    value: parsed,
                  },
                  rt.output,
                );
                received++;
                if (received >= limit) resolveP();
              },
            })
            .catch(rejectP);
        });
        emitMetaIfNotQuiet(rt, { tailed: received });
      } catch (err) {
        throw new CliError(
          "QUEUE_OP_FAILED",
          `tail failed: ${err instanceof Error ? err.message : String(err)}`,
          { topic },
        );
      } finally {
        try { await consumer.disconnect(); } catch { /* ignore */ }
        await disconnectAll();
      }
    });

  queue
    .command("dlq")
    .description("Surface dead-letter messages (topics ending in -dead-letter)")
    .option("--topic <t>", "specific DLQ topic (default: scan all *-dead-letter topics)")
    .option("--limit <n>", "max messages per topic", "10")
    .option("--summary", "summary only (no message bodies)", false)
    .action(async (opts: { topic?: string; limit: string; summary?: boolean }) => {
      const cmd = queue.commands.find((c) => c.name() === "dlq")!;
      const rt = loadRuntime(cmd);
      const admin = await getAdmin(rt.config);
      const limit = parseInt(opts.limit, 10) || 10;
      try {
        const md = await admin.fetchTopicMetadata();
        const dlqTopics = opts.topic
          ? [opts.topic]
          : md.topics.map((t) => t.name).filter((n) => n.endsWith("-dead-letter"));
        if (opts.summary) {
          const rows: Record<string, unknown>[] = [];
          for (const t of dlqTopics) {
            const offsets = await admin.fetchTopicOffsets(t);
            const total = offsets.reduce((acc, p) => acc + (parseInt(p.high, 10) - parseInt(p.low, 10)), 0);
            rows.push({ topic: t, partitions: offsets.length, message_count: total });
          }
          emitArray(rows, rt.output);
          return;
        }
        for (const t of dlqTopics) {
          const groupId = `openldr-cli-dlq-${process.pid}-${Date.now()}`;
          const consumer = newConsumer(rt.config, groupId);
          await consumer.connect();
          await consumer.subscribe({ topic: t, fromBeginning: true });
          let n = 0;
          await new Promise<void>((resolveP) => {
            const timeoutId = setTimeout(() => resolveP(), 5_000);
            consumer
              .run({
                eachMessage: async ({ partition, message }) => {
                  if (n >= limit) {
                    clearTimeout(timeoutId);
                    resolveP();
                    return;
                  }
                  const value = message.value === null ? null : message.value.toString("utf8");
                  let parsed: unknown = value;
                  if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
                    try { parsed = JSON.parse(value); } catch { /* keep as string */ }
                  }
                  emitRow(
                    {
                      topic: t,
                      partition,
                      offset: message.offset,
                      key: message.key === null ? null : message.key.toString("utf8"),
                      value: parsed,
                    },
                    rt.output,
                  );
                  n++;
                },
              })
              .catch(() => resolveP());
          });
          try { await consumer.disconnect(); } catch { /* ignore */ }
        }
      } finally {
        await disconnectAll();
      }
    });

  queue
    .command("publish <topic>")
    .description("Hand-publish a payload from a file to a topic (write-gated)")
    .option("--file <path>", "path to payload file (JSON or raw)")
    .option("--key <k>", "optional message key")
    .option("--confirm", "actually send", false)
    .action(async (topic: string, opts: { file?: string; key?: string; confirm?: boolean }) => {
      const cmd = queue.commands.find((c) => c.name() === "publish")!;
      const rt = loadRuntime(cmd);
      if (!opts.file) throw new CliError("MISSING_FLAG", "--file is required");
      if (!opts.confirm) {
        throw new CliError("WRITE_NOT_CONFIRMED", `Publish is a mutating op. Re-run with --confirm.`, { topic, file: opts.file });
      }
      const buf = await readFile(opts.file);
      const producer = newProducer(rt.config);
      try {
        await producer.connect();
        const ack = await producer.send({
          topic,
          messages: [{ key: opts.key ?? null, value: buf }],
        });
        emitText(JSON.stringify({ topic, ack }, null, 2));
      } finally {
        try { await producer.disconnect(); } catch { /* ignore */ }
        await disconnectAll();
      }
    });
}
