import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleRestart, CONSUMER_RETRY } from "./kafka-resilience.js";

test("scheduleRestart re-invokes start() via the injected scheduler with the given delay", () => {
  const calls: Array<{ ms: number }> = [];
  let captured: (() => void) | null = null;
  let started = 0;
  scheduleRestart(() => { started += 1; }, {
    name: "validation",
    delayMs: 1234,
    scheduler: (fn, ms) => { calls.push({ ms }); captured = fn; },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.ms, 1234);
  assert.equal(started, 0); // not until the timer fires
  captured!();
  assert.equal(started, 1); // boot retried
});

test("scheduleRestart defaults to a 5s backoff", () => {
  let ms = -1;
  scheduleRestart(() => {}, { name: "x", scheduler: (_fn, m) => { ms = m; } });
  assert.equal(ms, 5000);
});

test("CONSUMER_RETRY.restartOnFailure always asks KafkaJS to restart the consumer", async () => {
  assert.equal(await CONSUMER_RETRY.restartOnFailure(new Error("broker down")), true);
});
