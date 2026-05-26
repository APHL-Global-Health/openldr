import { createContext, useContext } from "react";

import {
  ExtensionHost,
  ExtensionLoader,
  type AppState,
} from "@/types/extensions";

export const ExtCtx = createContext<{
  state: AppState;
  dispatch: React.Dispatch<{ type: string; payload?: unknown }>;
  host: ExtensionHost;
  loader: ExtensionLoader;
} | null>(null);
export const useExtensions = () => useContext(ExtCtx)!;
