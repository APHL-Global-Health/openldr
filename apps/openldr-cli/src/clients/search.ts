import { Client } from "@opensearch-project/opensearch";
import type { LoadedConfig } from "../config.js";

let client: Client | undefined;

export function getSearch(cfg: LoadedConfig): Client {
  if (client) return client;
  client = new Client({
    node: cfg.search.url,
    ssl: { rejectUnauthorized: !cfg.insecureTls },
  });
  return client;
}

export async function closeSearch(): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch {
      // best effort
    }
    client = undefined;
  }
}
