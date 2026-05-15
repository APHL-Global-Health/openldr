import { Client } from "@opensearch-project/opensearch";
import type { LoadedConfig } from "../config.js";

let client: Client | undefined;

function resolveNode(cfg: LoadedConfig): string {
  // Raw OpenSearch (port 9200) is not exposed to the host. Use the gateway
  // `/opensearch/` proxy path. The opensearch client treats this as the root,
  // so `cat.indices` etc. become GETs to `${gateway}/opensearch/_cat/indices`.
  return `${cfg.gateway.url.replace(/\/+$/, "")}/opensearch`;
}

export function getSearch(cfg: LoadedConfig): Client {
  if (client) return client;
  client = new Client({
    node: resolveNode(cfg),
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
