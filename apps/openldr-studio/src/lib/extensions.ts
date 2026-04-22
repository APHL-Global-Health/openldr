import workerBootstrapRaw from "@/bootstrap/worker-bootstrap.txt?raw";
import iframeBridgeRaw from "@/bootstrap/iframe-bridge.txt?raw";

export function WORKER_BOOTSTRAP(
  extensionId: string,
  apiBase: string,
  token: string,
): string {
  return workerBootstrapRaw
    .replace(/__EXT_ID__/g, extensionId)
    .replace(/__API_BASE__/g, apiBase)
    .replace(/__TOKEN__/g, token);
}

export function IFRAME_BRIDGE(
  extensionId: string,
  apiBase: string,
  token: string,
): string {
  return iframeBridgeRaw
    .replace(/__EXT_ID__/g, extensionId)
    .replace(/__API_BASE__/g, apiBase)
    .replace(/__TOKEN__/g, token);
}

// Marker used in extension HTML templates — replaced with bridge JS before srcDoc is set.
// Single script block means bridge always runs before the bundle.
const BRIDGE_MARKER = "OPENLDR_BRIDGE_INJECT";

export function injectBridge(
  html: string,
  extensionId: string,
  apiBase: string,
  token: string,
): string {
  return html.replace(
    BRIDGE_MARKER,
    IFRAME_BRIDGE(extensionId, apiBase, token),
  );
}
