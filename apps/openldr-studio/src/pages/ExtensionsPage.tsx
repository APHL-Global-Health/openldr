import { ContentLayout } from "@/components/admin-panel/content-layout";
import { cn } from "@/lib/utils";
import { ExtensionListPanel } from "@/components/extensions/extensions-listview";
import ExtensionInfoPage from "./ExtensionInfoPage";
import { useExtensions } from "@/hooks/misc/useExtensions";
import {
  AlertTriangle,
  Check,
  Command,
  Loader2,
  RefreshCw,
  Terminal,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import * as api from "@/lib/restClients/extensionRestClient";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRef, useState } from "react";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import type { ExtensionState, ParsedBundle } from "@/types/extensions";
import { injectBridge } from "@/lib/extensions";

const ENV = import.meta.env;

function ExtensionsPage() {
  const client = useKeycloakClient();
  const { state, host, loader, dispatch } = useExtensions();
  const [isDialogOpened, setIsDialogOpened] = useState<boolean>(false);

  const [step, setStep] = useState<
    "drop" | "preview" | "uploading" | "done" | "error"
  >("drop");
  const [bundle, setBundle] = useState<ParsedBundle | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = client.user !== null; // TODO: check actual admin role from token

  async function parseZip(file: File) {
    const JSZip = (await import("jszip")).default;
    let zip: InstanceType<typeof JSZip>;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      setErrorMsg(
        "Invalid ZIP file — make sure you upload a valid .zip bundle",
      );
      setStep("error");
      return;
    }

    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) {
      setErrorMsg("manifest.json not found in ZIP root");
      setStep("error");
      return;
    }

    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(await manifestFile.async("string"));
    } catch {
      setErrorMsg("manifest.json is not valid JSON");
      setStep("error");
      return;
    }

    const kind = manifest.kind as string;
    const payloadFilename = kind === "worker" ? "index.js" : "index.html";
    const payloadFile = zip.file(payloadFilename);

    if (!payloadFile) {
      setErrorMsg(
        `${payloadFilename} not found in ZIP (required for kind: ${kind})`,
      );
      setStep("error");
      return;
    }

    const payloadBytes = await payloadFile.async("uint8array");

    setBundle({
      manifest,
      payloadSize: payloadBytes.length,
      payloadFile: payloadFilename,
      file,
    });
    setStep("preview");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".zip")) parseZip(file);
    else {
      setErrorMsg("Please drop a .zip file");
      setStep("error");
    }
  }

  async function handleUpload() {
    if (!bundle) return;
    setStep("uploading");
    setProgress(0);

    const formData = new FormData();
    formData.append("bundle", bundle.file);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${state.apiBase}/api/v1/extensions`);
      xhr.setRequestHeader("Authorization", `Bearer ${client.kc.token ?? ""}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          setProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status === 201) {
          setProgress(100);
          resolve();
        } else {
          try {
            const body = JSON.parse(xhr.responseText);
            reject(new Error(body.error || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(formData);
    })
      .then(() => {
        loader
          .fetchRegistry()
          .then((reg) => {
            dispatch({ type: "REGISTRY_LOADED", payload: reg.extensions });

            api
              .getUserExtensions(client.kc.token)
              .then((installs) => {
                if (installs.length === 0) return;

                for (const install of installs) {
                  const ext = state.extensions.find(
                    (e) => e.id === install.extensionId,
                  );
                  if (!ext) continue;

                  // Inject the manifest as an ExtensionState to pass to the install hook
                  const extState: ExtensionState = {
                    ...ext,
                    state: "inactive",
                    error: null,
                    enabled: true,
                  };

                  const autoLoad = async () => {
                    dispatch({
                      type: "EXT_STATE",
                      payload: { extId: ext.id, state: "fetching" },
                    });
                    try {
                      const codeResp =
                        await loader.fetchAndVerifyPayload(extState);
                      if (ext.kind === "worker") {
                        await host.loadWorkerExtension(
                          extState,
                          codeResp.payload,
                        );
                      } else {
                        const html = injectBridge(
                          codeResp.payload,
                          ext.id,
                          ENV.VITE_API_BASE_URL,
                          client.kc.token!,
                        );
                        dispatch({
                          type: "EXT_STATE",
                          payload: { extId: ext.id, payload: html },
                        });
                        host.loadIframeExtension(extState);
                      }
                    } catch (err: unknown) {
                      const msg =
                        err instanceof Error ? err.message : "Unknown error";
                      dispatch({
                        type: "EXT_STATE",
                        payload: { extId: ext.id, state: "error", error: msg },
                      });
                    }
                  };

                  autoLoad();
                }
              })
              .catch((err) => {
                console.warn(
                  "[App] Failed to fetch user extensions:",
                  err.message,
                );
              });
          })
          .catch(() => {})
          .finally(() => {
            setStep("done");

            setTimeout(() => reset(), 1800);
          });
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStep("error");
      });
  }

  function reset() {
    setStep("drop");
    setBundle(null);
    setProgress(0);
    setErrorMsg("");
    setIsDialogOpened(false);
  }

  const manifest = bundle?.manifest;
  const perms = (manifest?.permissions as string[] | undefined) ?? [];

  const permColour = (p: string) => {
    if (p.startsWith("data.")) return " border-[#f59e0b]/30 bg-[#f59e0b]/5";
    if (p.startsWith("ui.")) return "border-[#2dd4bf]/30 bg-[#2dd4bf]/5";
    if (p.startsWith("storage.")) return "border-[#a78bfa]/30 bg-[#a78bfa]/5";
    return " border-border bg-[#0d0f16]";
  };

  const activeCount = state.extensions.filter(
    (e) => e.state === "active",
  ).length;

  const navComponents = () => {
    return (
      <div className="flex min-h-13 max-h-13 w-full items-center px-2 py-2">
        Extensions
        <div className="flex-1" />
        {activeCount > 0 && (
          <div className="flex justify-center items-center px-2">
            <Separator orientation="vertical" className="mx-2 min-h-6" />
            <span className="text-[10px]hidden md:block">
              {activeCount} active
            </span>
          </div>
        )}
        <Separator orientation="vertical" className="mx-2 min-h-6" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              disabled={!isAdmin}
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsDialogOpened(true);
              }}
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upload</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-2 min-h-6" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (host) host.invokeCommand("__refresh");
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Broadcast data.refresh</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-2 min-h-6" />
      </div>
    );
  };

  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-row min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        <ExtensionListPanel />
        <ExtensionInfoPage />
      </div>

      <Dialog
        open={isDialogOpened}
        onOpenChange={(val) => {
          if (!val) reset();
        }}
      >
        <DialogContent className="p-0 m-0 rounded-sm min-w-[70%] min-h-[60%]">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <Upload className="h-4 w-4 " />
              <span className="font-medium ">Publish Extension</span>
              {/* <span className="text-[10px] text-[#2d3652] ml-auto">
                ZIP bundle format
              </span> */}
            </div>

            <div className="flex-1 p-6">
              <div className="mx-auto flex flex-col gap-4 h-full">
                {/* Step indicator */}
                <div className="flex items-center gap-2">
                  {(["drop", "preview", "uploading", "done"] as const).map(
                    (s, i) => (
                      <div key={s} className="flex w-full items-center gap-2">
                        <div
                          className={cn(
                            "h-5 w-5 rounded-full text-[12px] flex items-center justify-center font-bold border transition-colors",
                            step === s
                              ? "border-primary bg-primary/40 "
                              : ["done"].includes(step) ||
                                  (step === "uploading" && i < 2) ||
                                  (step === "preview" && i < 1)
                                ? "border-green-500 bg-green-900"
                                : "border-foreground",
                          )}
                        >
                          {i + 1}
                        </div>
                        <div className="relative flex items-center w-[90%]">
                          <div className="w-full h-px bg-foreground absolute" />
                          <span
                            className={cn(
                              "text-[14px] bg-background pl-1 pr-2 z-1",
                              step === s ? "text-primary " : "",
                            )}
                          >
                            {s === "drop"
                              ? "Select"
                              : s === "preview"
                                ? "Review"
                                : s === "uploading"
                                  ? "Upload"
                                  : "Done"}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>

                {/* Step: Drop */}
                {step === "drop" && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={cn(
                      "h-full border-2 border-dashed rounded-sm p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
                      dragging
                        ? "border-[#f59e0b] bg-[#f59e0b]/5"
                        : "border-border hover:border-primary bg-card hover:bg-primary/20",
                    )}
                  >
                    <Upload className="h-10 w-10 " />
                    <div className="text-center">
                      <p className="text-[13px]  font-medium">
                        Drop your extension ZIP here
                      </p>
                      <p className="text-[11px]  mt-1">
                        or click to browse · max 5MB
                      </p>
                    </div>
                    {/* <div className="text-[10px] text-center leading-relaxed">
                      Expected: manifest.json + index.js (worker) or index.html
                      (iframe)
                    </div> */}
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) parseZip(f);
                      }}
                    />
                  </div>
                )}

                {/* Step: Preview */}
                {step === "preview" && manifest && (
                  <div className="flex flex-col h-full rounded-sm border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                      <span className="text-2xl leading-none">
                        {manifest.icon as string}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold">
                          {manifest.name as string}
                        </p>
                        <p className="text-[12px]">
                          v{manifest.version as string} ·{" "}
                          {manifest.kind as string} ·{" "}
                          {manifest.author as string}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[14px] px-2 py-0.5 rounded border",
                          manifest.kind === "worker"
                            ? "border-border bg-secondary"
                            : "border-border bg-secondary",
                        )}
                      >
                        {manifest.kind as string}
                      </span>
                    </div>

                    <div className="px-4 py-3 border-b border-border flex-1">
                      <p className="text-[16px] leading-relaxed">
                        {manifest.description as string}
                      </p>
                    </div>

                    <div className="px-4 py-3 border-b border-border flex flex-col gap-1.5">
                      <p className="text-[12px] uppercase tracking-wider">
                        Permissions
                      </p>
                      {perms.length === 0 ? (
                        <p className="text-[10px]">none</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {perms.map((p) => (
                            <span
                              key={p}
                              className={cn(
                                "text-[14px] px-1.5 py-0.5 rounded border",
                                permColour(p),
                              )}
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3 grid grid-cols-2 gap-2 text-[14px] ">
                      <div>
                        ID: <span>{manifest.id as string}</span>
                      </div>
                      <div>
                        Payload:{" "}
                        <span>
                          {bundle.payloadFile} (
                          {(bundle.payloadSize / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 px-4 py-3 border-t border-border">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleUpload}
                        className="flex-1 gap-2"
                      >
                        {/* <Upload className="h-3 w-3" />  */}
                        Publish
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={reset}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step: Uploading */}
                {step === "uploading" && (
                  <div className="rounded-sm border border-border bg-card p-6 justify-center flex h-full flex-col gap-4">
                    <div className="justify-center flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4  animate-spin shrink-0" />
                        <p className="text-[14px]">Uploading</p>
                      </div>
                      <div className="h-1.5 rounded-none bg-primary/30 border border-primary overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-primary to-primary rounded-none transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[14px] text-right">{progress}%</p>
                    </div>
                  </div>
                )}

                {/* Step: Done */}
                {step === "done" && (
                  <div className="h-full rounded-sm border border-[#34d399]/30 bg-[#34d399]/5 p-6 flex flex-col items-center justify-center gap-3">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#34d399]/10 border border-[#34d399]/30 flex items-center justify-center">
                        <Check className="h-5 w-5 text-[#34d399]" />
                      </div>
                      <p className="text-[13px] font-medium text-[#34d399]">
                        Published successfully
                      </p>
                      {/* <p className="text-[10px]">Returning to extensions list…</p> */}
                    </div>
                  </div>
                )}

                {/* Step: Error */}
                {step === "error" && (
                  <div className="h-full rounded-sm border border-[#f87171]/30 bg-[#f87171]/5 p-5 items-center justify-center flex flex-col gap-3">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        {/* <AlertTriangle className="h-4 w-4 text-[#f87171] shrink-0" /> */}
                        <p className="font-medium text-[#f87171]">
                          Publish failed
                        </p>
                      </div>
                      <p className="text-[11px] text-[#f87171]/70 leading-relaxed">
                        {errorMsg}
                      </p>
                      <div className="w-full flex items-center justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={reset}
                          className="self-start gap-2"
                        >
                          {/* <RefreshCw className="h-3 w-3" />  */}
                          Try again
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bundle format docs */}
                {step === "drop" && (
                  <div className="rounded-sm border border-border bg-card py-4 flex flex-col gap-2">
                    <p className="text-[10px] px-4 pb-2 font-bold border-b uppercase tracking-wider">
                      ZIP bundle structure
                    </p>
                    <pre className="text-[10px] px-4  leading-relaxed">{`extension.zip
├── manifest.json    ← required
├── index.js         ← worker extensions
│   OR index.html    ← iframe extensions
└── README.md        ← optional`}</pre>
                    <p className="text-[10px] px-4  mt-1">
                      See SDK docs for manifest.json schema and openldr.data API
                      reference.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ContentLayout>
  );
}

export default ExtensionsPage;
