import type { Command } from "commander";
import { readFile } from "node:fs/promises";
import { getAdmin, newConsumer, newProducer, disconnectAll } from "../clients/kafka.js";
import { execInContainer, streamInContainer } from "../clients/docker-exec.js";
import { loadRuntime, emitMetaIfNotQuiet } from "../runtime.js";
import { emitArray, emitRow, emitText } from "../output.js";
import { CliError } from "../errors.js";


export function registerQueueCommand(program: Command): void {
  const queue = program.command("queue").description("Inspect the message queue (currently backed by Kafka)");

  queue
    .command("topics")
    .description("List topics")
    .option("--internal", "run inside the openldr-kafka1 container via `docker exec kafka-topics`", false)
    .action(async (opts: { internal?: boolean }) => {
      const cmd = queue.commands.find((c) => c.name() === "topics")!;
      const rt = loadRuntime(cmd);
      if (opts.internal) {
        const r = await execInContainer(rt.config.kafka.container /* host = container name */, [
          "kafka-topics",
          "--bootstrap-server",
          rt.config.kafka.internalBootstrap,
          "--list",
        ]);
        if (r.exitCode !== 0) {
          throw new CliError("QUEUE_OP_FAILED", r.stderr.trim() || "kafka-topics failed");
        }
        const rows = r.stdout.split("\n").map((s) => s.trim()).filter(Boolean).map((topic) => ({ topic }));
        emitArray(rows as unknown as Record<string, unknown>[], rt.output);
        return;
      }
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
    .description("Consumer-group offset lag")
    .option("--group <g>", "limit to one consumer group")
    .option("--internal", "run inside the openldr-kafka1 container", false)
    .action(async (opts: { group?: string; internal?: boolean }) => {
      const cmd = queue.commands.find((c) => c.name() === "offsets")!;
      const rt = loadRuntime(cmd);
      const container = rt.config.kafka.container;
      if (opts.internal) {
        if (opts.group) {
          const r = await execInContainer(container, [
            "kafka-consumer-groups",
            "--bootstrap-server",
            rt.config.kafka.internalBootstrap,
            "--describe",
            "--group",
            opts.group,
          ]);
          if (r.exitCode !== 0) {
            throw new CliError("QUEUE_OP_FAILED", r.stderr.trim());
          }
          emitText(r.stdout);
          return;
        }
        const r = await execInContainer(container, [
          "kafka-consumer-groups",
          "--bootstrap-server",
          rt.config.kafka.internalBootstrap,
          "--list",
        ]);
        if (r.exitCode !== 0) throw new CliError("QUEUE_OP_FAILED", r.stderr.trim());
        const rows = r.stdout.split("\n").map((s) => s.trim()).filter(Boolean).map((groupId) => ({ groupId }));
        emitArray(rows as unknown as Record<string, unknown>[], rt.output);
        return;
      }
      const admin = await getAdmin(rt.config);
      try {
        const { groups } = await admin.listGroups();
        const filtered = opts.group ? groups.filter((g) => g.groupId === opts.group) : groups;
        const rows: Record<string, unknown>[] = [];
        for (const g of filtered) {
          const offsets = await admin.fetchOffsets({ groupId: g.groupId });
          for (const t of offsets) {
            for (const p of t.partitions) {
              rows.push({ groupId: g.groupId, topic: t.topic, partition: p.partition, offset: p.offset, metadata: p.metadata });
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
    .description("Stream messages from a topic to stdout (NDJSON)")
    .option("--from-beginning", "start from the earliest available offset", false)
    .option("--limit <n>", "stop after N messages", "20")
    .option("--group <g>", "explicit consumer group id (ignored with --internal)")
    .option("--internal", "run inside the openldr-kafka1 container via `docker exec kafka-console-consumer`", false)
    .action(async (topic: string, opts: { fromBeginning?: boolean; limit: string; group?: string; internal?: boolean }) => {
      const cmd = queue.commands.find((c) => c.name() === "tail")!;
      const rt = loadRuntime(cmd);
      const limit = parseInt(opts.limit, 10) || 20;
      const container = rt.config.kafka.container;
      if (opts.internal) {
        const args = [
          "kafka-console-consumer",
          "--bootstrap-server",
          rt.config.kafka.internalBootstrap,
          "--topic",
          topic,
          "--max-messages",
          String(limit),
          "--property",
          "print.timestamp=true",
          "--property",
          "print.partition=true",
          "--property",
          "print.offset=true",
          "--property",
          "print.key=true",
          "--property",
          "key.separator=\t",
        ];
        if (opts.fromBeginning) args.push("--from-beginning");
        const child = streamInContainer(container, args);
        let received = 0;
        await new Promise<void>((resolveP, rejectP) => {
          let buf = "";
          child.stdout.on("data", (c) => {
            buf += c.toString("utf8");
            let nl = buf.indexOf("\n");
            while (nl !== -1) {
              const line = buf.slice(0, nl);
              buf = buf.slice(nl + 1);
              if (line.length > 0) {
                const fields = line.split("\t");
                const row: Record<string, unknown> = {};
                for (const f of fields) {
                  const eq = f.indexOf(":");
                  if (eq > 0) {
                    const k = f.slice(0, eq).trim().toLowerCase();
                    const v = f.slice(eq + 1).trim();
                    if (["createtime", "partition", "offset"].includes(k)) row[k] = v;
                  }
                }
                row.topic = topic;
                // Last field is the value (or key\tvalue). Heuristic: take after last \t that wasn't a meta tag.
                row.raw = line;
                emitRow(row, rt.output);
                received++;
              }
              nl = buf.indexOf("\n");
            }
          });
          child.stderr.on("data", () => { /* kafka-console-consumer is noisy; drop */ });
          child.on("error", rejectP);
          child.on("close", () => resolveP());
        });
        emitMetaIfNotQuiet(rt, { tailed: received, topic });
        return;
      }
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
        throw new CliError("QUEUE_OP_FAILED", `tail failed: ${err instanceof Error ? err.message : String(err)}`, { topic });
      } finally {
        try { await consumer.disconnect(); } catch { /* ignore */ }
        await disconnectAll();
      }
    });

  queue
    .command("dlq")
    .description("Surface dead-letter messages (topics ending in -dead-letter)")
    .option("--topic <t>", "specific DLQ topic")
    .option("--limit <n>", "max messages per topic", "10")
    .option("--summary", "summary only (no message bodies)", false)
    .option("--internal", "run inside the openldr-kafka1 container", false)
    .action(async (opts: { topic?: string; limit: string; summary?: boolean; internal?: boolean }) => {
      const cmd = queue.commands.find((c) => c.name() === "dlq")!;
      const rt = loadRuntime(cmd);
      const container = rt.config.kafka.container;
      const limit = parseInt(opts.limit, 10) || 10;
      if (opts.internal) {
        // List topics, filter dead-letter ones
        const lsr = await execInContainer(container, [
          "kafka-topics",
          "--bootstrap-server",
          rt.config.kafka.internalBootstrap,
          "--list",
        ]);
        if (lsr.exitCode !== 0) throw new CliError("QUEUE_OP_FAILED", lsr.stderr.trim());
        const all = lsr.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
        const dlqs = opts.topic ? [opts.topic] : all.filter((t) => t.endsWith("-dead-letter"));
        if (opts.summary) {
          const rows: Record<string, unknown>[] = [];
          for (const t of dlqs) {
            const dr = await execInContainer(container, [
              "kafka-run-class",
              "kafka.tools.GetOffsetShell",
              "--broker-list",
              rt.config.kafka.internalBootstrap,
              "--topic",
              t,
            ]);
            const total = dr.stdout
              .split("\n")
              .map((s) => parseInt(s.split(":").pop() ?? "0", 10))
              .filter((n) => Number.isFinite(n))
              .reduce((a, b) => a + b, 0);
            rows.push({ topic: t, message_count: total });
          }
          emitArray(rows, rt.output);
          return;
        }
        for (const t of dlqs) {
          const child = streamInContainer(container, [
            "kafka-console-consumer",
            "--bootstrap-server",
            rt.config.kafka.internalBootstrap,
            "--topic",
            t,
            "--from-beginning",
            "--max-messages",
            String(limit),
          ]);
          await new Promise<void>((resolveP, rejectP) => {
            let buf = "";
            child.stdout.on("data", (c) => {
              buf += c.toString("utf8");
              let nl = buf.indexOf("\n");
              while (nl !== -1) {
                const line = buf.slice(0, nl);
                buf = buf.slice(nl + 1);
                if (line) emitRow({ topic: t, value: line }, rt.output);
                nl = buf.indexOf("\n");
              }
            });
            child.stderr.on("data", () => { /* drop noisy logs */ });
            child.on("error", rejectP);
            child.on("close", () => resolveP());
          });
        }
        return;
      }
      // Direct mode (kafkajs)
      const admin = await getAdmin(rt.config);
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
        // omitted streaming for brevity — direct mode falls back to admin offsets only
        emitArray(dlqTopics.map((t) => ({ topic: t })), rt.output);
      } finally {
        await disconnectAll();
      }
    });

  queue
    .command("publish <topic>")
    .description("Hand-publish a payload to a topic (write-gated)")
    .option("--file <path>", "payload file (JSON or raw)")
    .option("--key <k>", "optional message key")
    .option("--confirm", "actually send", false)
    .option("--internal", "publish via `docker exec kafka-console-producer`", false)
    .action(
      async (
        topic: string,
        opts: { file?: string; key?: string; confirm?: boolean; internal?: boolean },
      ) => {
        const cmd = queue.commands.find((c) => c.name() === "publish")!;
        const rt = loadRuntime(cmd);
        if (!opts.file) throw new CliError("MISSING_FLAG", "--file is required");
        if (!opts.confirm) throw new CliError("WRITE_NOT_CONFIRMED", `Re-run with --confirm.`, { topic, file: opts.file });
        const buf = await readFile(opts.file);
        if (opts.internal) {
          const container = rt.config.kafka.container;
          const r = await execInContainer(
            container,
            ["kafka-console-producer", "--bootstrap-server", rt.config.kafka.internalBootstrap, "--topic", topic],
            { input: buf },
          );
          if (r.exitCode !== 0) throw new CliError("QUEUE_OP_FAILED", r.stderr.trim(), { topic });
          emitText(JSON.stringify({ topic, sent: true }));
          return;
        }
        const producer = newProducer(rt.config);
        try {
          await producer.connect();
          const ack = await producer.send({ topic, messages: [{ key: opts.key ?? null, value: buf }] });
          emitText(JSON.stringify({ topic, ack }, null, 2));
        } finally {
          try { await producer.disconnect(); } catch { /* ignore */ }
          await disconnectAll();
        }
      },
    );
}
