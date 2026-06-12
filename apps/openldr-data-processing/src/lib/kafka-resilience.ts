import { logger } from "./logger";

/**
 * Shared Kafka resilience config + helpers for the stage consumers
 * (validation / mapper / storage / outpost).
 *
 * Background: each consumer is a long-lived KafkaJS consumer. When the broker
 * (openldr-kafka1) restarts or is unreachable long enough to exhaust the retry
 * budget, KafkaJS emits a `crash` event with `restart: false` and the consumer
 * stops permanently — the pipeline then silently stalls (messages pile up at
 * `ingest:queued`, `lab_requests` stops growing) until someone manually runs
 * `docker restart openldr-data-processing`. These helpers make the consumers
 * self-heal instead.
 */

/** Client-level connection retry. Rides out brief broker blips before a crash;
 *  capped retries so a hard outage still surfaces a crash that
 *  `restartOnFailure` then recovers from. */
export const KAFKA_CLIENT_RETRY = {
  initialRetryTime: 1000,
  retries: 8,
};

/** Consumer-level crash policy. Returning `true` tells KafkaJS to restart the
 *  consumer after a crash instead of stopping — so when the broker comes back
 *  the consumer rejoins its group and drains the backlog on its own. */
export const CONSUMER_RETRY = {
  restartOnFailure: async (_error: Error): Promise<boolean> => true,
};

export interface RestartOpts {
  /** Stage name for logs, e.g. "validation". */
  name: string;
  /** Backoff before re-running start(). Default 5000ms. */
  delayMs?: number;
  /** Injectable scheduler (defaults to setTimeout) — lets tests drive timing. */
  scheduler?: (fn: () => void, ms: number) => void;
}

/**
 * Re-run a consumer's `start()` after a backoff. Used in each consumer's
 * init `catch` so that a connect/subscribe failure (e.g. the broker isn't up
 * yet at boot) retries instead of logging-and-abandoning the consumer.
 */
export function scheduleRestart(start: () => unknown, opts: RestartOpts): void {
  const delayMs = opts.delayMs ?? 5000;
  const schedule = opts.scheduler ?? ((fn, ms) => { setTimeout(fn, ms); });
  logger.warn({ name: opts.name, delayMs }, "Kafka consumer down — scheduling restart");
  schedule(() => { void start(); }, delayMs);
}
