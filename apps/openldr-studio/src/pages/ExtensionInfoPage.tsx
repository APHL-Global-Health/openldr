import {
  Download,
  Package,
  Trash2,
  AlertTriangle,
  Eye,
  Loader2,
  Cpu,
  Hash,
  Command,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/extensions/badge";
import { Separator } from "@/components/ui/separator";
import { useExtensions } from "@/hooks/misc/useExtensions";
import { useInstallExtension } from "@/hooks/misc/useInstallExtension";
import { PERM_META } from "@/components/extensions/permission-dialog";
import { useUninstallExtension } from "@/hooks/misc/useUninstallExtension";

function ExtensionInfoPage() {
  const { state, dispatch } = useExtensions();
  const installExtension = useInstallExtension();
  const uninstallExtension = useUninstallExtension();
  const ext = state.extensions.find((e) => e.id === state.selectedExtId);

  if (!ext)
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-12 select-none overflow-auto">
        <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
          <Package className="h-7 w-7 " />
        </div>
        <div>
          <p className="text-sm font-medium ">Select an extension</p>
          <p className="text-[11px]  mt-1">
            Pick one from the list to view details and install
          </p>
        </div>
      </div>
    );

  const isInstalled = ext.state === "active";
  const isBusy = ext.state === "fetching" || ext.state === "activating";
  const hasView = ext.kind === "iframe";
  const publishedAt = new Date(ext.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-1 w-full justify-center overflow-auto">
      <div className="max-w-2xl p-8 space-y-7">
        {/* hero row */}
        <div className="flex items-start gap-5">
          <div className="h-16 w-16 rounded-md bg-[#0d0f16] border border-[#1e2232] flex items-center justify-center text-4xl shrink-0 shadow-inner">
            {ext.icon}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-semibold leading-tight">
                  {ext.name}
                </h1>
                <p className="text-[12px] mt-1">
                  {ext.author} · v{ext.version}
                  {ext.slot && (
                    <>
                      {" "}
                      · <span className="font-mono ">slot:{ext.slot}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {isInstalled && hasView && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      dispatch({ type: "SET_ACTIVITY", payload: ext.id })
                    }
                  >
                    <Eye className="h-3 w-3" /> Open
                  </Button>
                )}
                {isInstalled ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => uninstallExtension(ext.id)}
                  >
                    <Trash2 className="h-3 w-3" /> Uninstall
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isBusy}
                    className="min-w-22.5"
                    onClick={() =>
                      installExtension(ext, () => {
                        if (ext.kind === "iframe")
                          dispatch({ type: "SET_ACTIVITY", payload: ext.id });
                      })
                    }
                  >
                    {isBusy ? (
                      <>
                        {/* <Loader2 className="h-3 w-3 animate-spin" /> */}
                        Installing…
                      </>
                    ) : (
                      <>
                        {/* <Download className="h-3 w-3" /> */}
                        Install
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {isInstalled && (
                <Badge variant="active" className="border border-border p-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
                  Installed
                </Badge>
              )}
              {ext.state === "error" && (
                <Badge variant="error" className="border border-border p-2">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Error
                </Badge>
              )}
              {(ext.state === "fetching" || ext.state === "activating") && (
                <Badge variant="fetching" className="border border-border p-2">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Installing…
                </Badge>
              )}
              <Badge variant="default" className="border border-border p-2">
                {ext.kind === "worker" ? "Background Worker" : "UI Extension"}
              </Badge>
              {ext.kind === "worker" && (
                <Badge variant="default" className="border border-border p-2">
                  <Cpu className="h-2.5 w-2.5" />
                  No UI
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Separator className="bg-[#1e2232]" />

        {/* error banner */}
        {ext.error && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-950/30 border border-red-900/40">
            <AlertTriangle className="h-4 w-4 text-[#f87171] shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-semibold text-[#f87171] mb-1">
                Installation error
              </p>
              <p className="text-[11px] font-mono text-red-300/60 break-all leading-relaxed">
                {ext.error}
              </p>
              <Button
                variant="ghost"
                size="xs"
                className="mt-2"
                onClick={() => installExtension(ext)}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* description */}
        <div>
          <p className="label-caps mb-2">About</p>
          <p className="text-[13px] leading-relaxed">{ext.description}</p>
          <p className="text-[10px]  mt-2 font-mono">Published {publishedAt}</p>
        </div>

        {/* permissions */}
        <div>
          <p className="label-caps mb-3">Permissions requested</p>
          {ext.permissions.length === 0 ? (
            <p className="text-[12px] ">No special permissions required</p>
          ) : (
            <div className="space-y-1">
              {ext.permissions.map((perm) => {
                const meta = PERM_META[perm] || {
                  label: perm,
                  icon: <Hash className="h-3 w-3" />,
                };
                return (
                  <div
                    key={perm}
                    className="flex items-start gap-3 p-2.5 rounded-xs bg-card border border-border"
                  >
                    <span className="mt-0.5 shrink-0">{meta.icon}</span>
                    <div>
                      <p className="text-[11px] font-mono ">{perm}</p>
                      <p className="text-[10px] mt-0.5">{meta.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* commands */}
        {ext.contributes.commands.length > 0 && (
          <div>
            <p className="label-caps mb-3">Commands contributed</p>
            <div className="space-y-1">
              {ext.contributes.commands.map((cmd) => (
                <div
                  key={cmd.id}
                  className="flex items-center gap-3 p-2.5 rounded-xs bg-card border border-border"
                >
                  <Command className="h-3 w-3 shrink-0" />
                  <div>
                    <p className="text-[11px] font-mono">{cmd.id}</p>
                    <p className="text-[10px] ">{cmd.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* technical details */}
        <div>
          <p className="label-caps mb-3">Technical</p>
          <div className="rounded-xs bg-card border border-border overflow-hidden divide-y divide-border font-mono text-[10px]">
            {(
              [
                ["ID", ext.id],
                ["Kind", ext.kind],
                ["Slot", ext.slot || "—"],
                ["Integrity", ext.integrity],
                ["Code URL", ext.codeUrl],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[100px_1fr] gap-3 px-3 py-2"
              >
                <span>{k}</span>
                <span className="break-all">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-h-4 w-full"></div>
      </div>
    </div>
  );
}

export default ExtensionInfoPage;
