import { useExtensions } from "@/hooks/misc/useExtensions";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

export function IframeView({ extId }: { extId: string }) {
  const { state, host } = useExtensions();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ext = state.extensions.find((e) => e.id === extId);

  useEffect(() => {
    if (iframeRef.current) {
      host.registerIframe(extId, iframeRef.current);
      return () => host.unregisterIframe(extId);
    }
  }, [extId, host]);

  if (!ext?.payload)
    return (
      <div className="flex-1 bg-red-500 flex items-center justify-center">
        <Loader2 className="h-4 w-4 text-[#2d3652] animate-spin" />
      </div>
    );

  return (
    <iframe
      ref={iframeRef}
      srcDoc={ext.payload}
      sandbox="allow-scripts allow-downloads allow-same-origin"
      className="flex-1 w-full h-full border-0 block"
      title={ext.name}
    />
  );
}
