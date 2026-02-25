# openldr-ext-lab-monitor

Background lab surveillance worker for OpenLDR. **No UI** — runs silently in a Web Worker.

On a configurable interval it queries `openldr_external.lab_requests` and `lab_results`, fires notifications when thresholds are breached, and emits events other extensions can subscribe to.

## What it monitors

| Check                              | Default threshold | Alert level            |
| ---------------------------------- | ----------------- | ---------------------- |
| Pending requests overdue           | > 24 hours        | warning / error (≥10)  |
| Abnormal result rate (24h rolling) | > 30%             | warning / error (>50%) |

## Commands (visible in command palette)

| Command                                   | Action                             |
| ----------------------------------------- | ---------------------------------- |
| `Lab Monitor: Run surveillance check now` | Immediate check                    |
| `Lab Monitor: Show last summary`          | Notification with last check stats |
| `Lab Monitor: Clear all alerts`           | Reset stored alerts                |
| `Lab Monitor: Pause / Resume monitoring`  | Toggle the schedule                |

## Events emitted (other extensions can subscribe)

```ts
// Fired when a threshold is breached
openldr.events.on("monitor.alert", (payload) => {
  // { kind: 'overdue_requests' | 'high_abnormal_rate', message, count, checkedAt }
});

// Fired after every successful check
openldr.events.on("monitor.summary", (payload) => {
  // { pendingOverdue, totalPending, abnormalCount, totalResults, abnormalRate, checkedAt }
});

// Also emits 'data.refresh' so patients/lab-results extensions reload automatically
```

## Config hot-update (no reinstall needed)

Another extension can send a config change at runtime:

```ts
openldr.events.emit("monitor.configUpdate", {
  intervalMs: 2 * 60 * 1000, // check every 2 minutes
  pendingThresholdHrs: 12, // flag after 12h
  abnormalRateThreshold: 0.2, // alert at 20%
});
```

Settings are persisted to `user_extensions.settings` via `openldr.storage`.

## Development

```bash
npm install
npm run build    # one-shot → dist/index.js
npm run dev      # watch mode
npm run pack     # → dist/extension.zip
```

## Key difference from iframe extensions

Workers have **no DOM**. They communicate entirely through:

- `openldr.ui.*` — host dispatches notifications/status bar updates to the React UI
- `openldr.events.*` — cross-extension event bus
- `openldr.data.*` — direct HTTP calls to `api/v1/query/engine`
- `openldr.storage.*` — persisted settings via `/data/storage/*`

The `activate(openldr)` function is called once by the host bootstrap when the worker starts.
