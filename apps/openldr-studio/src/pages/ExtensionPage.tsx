import { ContentLayout } from "@/components/admin-panel/content-layout";
import { cn } from "@/lib/utils";

import { Separator } from "@/components/ui/separator";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import * as exts from "@openldr/extensions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExtensions } from "@/hooks/misc/useExtensions";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { LoadingSpinner } from "@/components/loading-spinner";
import { IframeView } from "@/components/extensions/iframeview";
import { Badge } from "@/components/extensions/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

function ExtensionPage() {
  const { extId } = useParams();

  const { state, dispatch, host } = useExtensions();
  const ext = state.extensions.find((e) => e.id === extId);

  if (!ext)
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[12px] font-mono text-[#2d3652]">
          Extension not found
        </p>
      </div>
    );

  if (ext.state !== "active")
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <AlertTriangle className="h-8 w-8 text-[#f59e0b]/30" />
        <div>
          <p className="text-sm font-medium text-[#475569]">
            Extension not running
          </p>
          <p className="text-[11px] text-[#2d3652] mt-1">
            Install it from the Extensions panel first
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            dispatch({ type: "SET_ACTIVITY", payload: "extensions" })
          }
        >
          Go to Extensions
        </Button>
      </div>
    );

  const navComponents = () => {
    return <h1 className="font-bold">Extension</h1>;
  };
  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        <div className="flex flex-col w-full  h-full overflow-auto min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]">
          {/* view titlebar */}
          <div className="h-9 shrink-0 flex items-center gap-2.5 px-4 border-b border-[#1e2232] bg-[#080a0f]">
            <span className="text-sm leading-none">{ext.icon}</span>
            <span className="text-[12px] font-medium text-[#94a3b8]">
              {ext.name}
            </span>
            <Badge variant="active" className="text-[9px]">
              v{ext.version}
            </Badge>
            <div className="flex-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => host.invokeCommand("__refresh")}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Broadcast data.refresh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    host.deactivate(ext.id);
                    dispatch({ type: "SET_ACTIVITY", payload: "extensions" });
                  }}
                >
                  <Trash2 className="h-3 w-3 text-[#f87171]/50" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Uninstall</TooltipContent>
            </Tooltip>
          </div>

          {/* content */}
          {extId && ext.kind === "iframe" ? (
            <IframeView extId={extId} />
          ) : (
            <div className="flex-1 overflow-auto p-8">
              <div className="max-w-lg space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-[#0d0f16] border border-[#1e2232] flex items-center justify-center text-3xl">
                    {ext.icon}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#e2e8f0]">
                      {ext.name}
                    </h2>
                    <p className="text-[11px] text-[#475569] mt-0.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
                      Running in background
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#0d0f16] border border-[#1e2232]">
                  <p className="text-[13px] text-[#94a3b8] leading-relaxed">
                    {ext.description}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                  <p className="text-[12px] text-emerald-400/70 leading-relaxed">
                    Background worker — no UI. It runs silently and communicates
                    via IPC. Check the Dev Console to see its messages.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ContentLayout>
  );
}

export default ExtensionPage;
