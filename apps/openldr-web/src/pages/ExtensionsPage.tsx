import React, { useEffect, useState } from "react";
import JSZip from "jszip";
import { Separator } from "@/components/ui/separator";
import useWindowSize from "@/hooks/misc/useWindowSize";
import { useSideBarContext } from "@/components/sidebar-provider";
import LogoutOptions from "@/components/logout-options";

import {
  Trash2,
  User,
  ListPlus,
  SearchIcon,
  FolderDown,
  FolderUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import ExtensionInfoPage from "@/pages/ExtensionInfoPage";
import { useExtensions } from "@/hooks/misc/useExtensions";

import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

function ExtensionsPage() {
  const windowSize = useWindowSize();
  const sideBarContext = useSideBarContext();
  const isCollapsed = sideBarContext?.isCollapsed ?? false;

  const client = useKeycloakClient();
  const extensionsHook = useExtensions(client.kc.token);

  const [extension, setExtension] = useState<any>(null);
  const [extensions, setExtensions] = useState<any>(extensionsHook.extensions);

  useEffect(() => {
    setExtensions(extensionsHook.extensions);
  }, [extensionsHook.extensions]);

  const loadFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Check if it's a zip file
      if (!file.name.endsWith(".zip")) {
        throw new Error("Please select a .zip file");
      }

      // Read the zip file
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Read manifest.json
      const manifestFile = zip.file("manifest.json");
      if (!manifestFile) {
        throw new Error("manifest.json not found in zip");
      }
      const manifestText = await manifestFile.async("text");
      const _manifest = JSON.parse(manifestText);

      await extensionsHook.publishVersion(file, _manifest);
      await extensionsHook.refresh();

      // console.log("Extension loaded from zip!");
    } catch (error) {
      console.error("Failed to load extension from zip:", error);
    } finally {
      // Reset the file input
      event.target.value = "";
    }
  };

  return (
    <div className="flex w-full h-full flex-row">
      <div className="flex flex-1 flex-row">
        <div className="flex w-64 flex-col">
          <div className="flex min-h-13 max-h-13 w-full items-center px-2 py-2">
            <InputGroup className="rounded-xs">
              <InputGroupInput placeholder="Search" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Search"
                  title="Search"
                  size="icon-xs"
                  onClick={() => {
                    //search
                  }}
                >
                  <SearchIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <Separator />
          <div
            className="flex flex-1 flex-col w-full h-full overflow-y-auto"
            style={{ maxHeight: `${windowSize.height - 53}px` }}
          >
            <div>
              {(extensions || []).map((extension) => {
                if (extension)
                  return (
                    <Button
                      key={extension.extensionId}
                      variant="outline"
                      onClick={async () => {
                        const info = await extensionsHook.getExtension(
                          extension.packageId
                        );
                        setExtension(info);
                        // setManifest(_manifest);
                      }}
                      className="flex p-2 rounded-none h-16 w-64 max-w-64"
                    >
                      <div className="flex flex-row w-full items-center gap-2 rounded-none">
                        <div className="flex flex-col items-center justify-center w-14  max-w-14">
                          <img
                            src={extension.iconUrl}
                            alt={extension.name}
                            className="w-6 h-6 max-w-6 max-h-6 flex items-center justify-center text-[16px] font-bold  text-background shrink-0"
                          />
                        </div>
                        <div className="flex flex-col  w-52  max-w-52">
                          <div className="flex text-xs font-normal text-foreground">
                            <p className="truncate">{extension.name}</p>
                          </div>
                          <div className="flex text-[12px] font-normal text-muted-foreground">
                            <p className="truncate">{extension.description}</p>
                          </div>
                          <div className="flex text-[10px] text-muted-foreground items-center gap-1.5">
                            <p className="truncate">{extension.author}</p>
                          </div>
                        </div>
                      </div>
                    </Button>
                  );
              })}
            </div>
          </div>
        </div>
        <Separator orientation="vertical" />
        <div className="flex flex-1 flex-col">
          <div className="flex w-full h-full flex-col">
            <div className="flex min-h-13 max-h-13 w-full items-center px-2 py-2">
              {/* <Separator orientation="vertical" className="mx-2 h-6" /> */}

              <div className="flex flex-1"></div>

              <div className="flex h-full items-center">
                <Separator orientation="vertical" className="mx-2 h-6" />
                <div className="flex">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex h-full ">
                        <input
                          id="loadExtension"
                          type="file"
                          onChange={loadFromFile}
                          accept=".zip"
                          className="hidden"
                        />
                        <label
                          htmlFor="loadExtension"
                          className="flex items-center justify-center h-9 cursor-pointer"
                        >
                          <FolderDown className="h-4 w-4 mx-2" />
                        </label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Load Extension</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <Separator orientation="vertical" className="mx-2 h-6" />
              <LanguageSwitcher />
              <Separator orientation="vertical" className="mx-2 h-6" />
              <LogoutOptions />
            </div>
            <Separator />
            <div className="flex w-full h-full flex-col">
              <div
                className="flex flex-1 border-b"
                style={{
                  maxWidth: `${windowSize.width - (isCollapsed ? 48 : 196)}px`,
                  overflow: "auto",
                  maxHeight: `${windowSize.height - (52 + 1)}px`,
                }}
              >
                {extension ? (
                  <ExtensionInfoPage
                    extension={extension}
                    onUnload={(_extension) => {
                      setExtension(null);
                    }}
                  />
                ) : (
                  <div
                    className="flex flex-1 flex-col items-center justify-center h-full w-full relative"
                    style={{ minHeight: `${windowSize.height - 53 - 50}px` }}
                  >
                    <div className="flex flex-1 h-full w-full relative">
                      <svg
                        className="absolute inset-0 size-full z-0 stroke-foreground/10 m-0 p-0"
                        fill="none"
                      >
                        <defs>
                          <pattern
                            id="pattern-5c1e4f0e-62d5-498b-8ff0-cf77bb448c8e"
                            x="0"
                            y="0"
                            width="10"
                            height="10"
                            patternUnits="userSpaceOnUse"
                          >
                            <path d="M-3 13 15-5M-5 5l18-18M-1 21 17 3"></path>
                          </pattern>
                        </defs>
                        <rect
                          stroke="none"
                          fill="url(#pattern-5c1e4f0e-62d5-498b-8ff0-cf77bb448c8e)"
                          width="100%"
                          height="100%"
                        ></rect>
                      </svg>
                    </div>

                    <Card className="w-75 cursor-default rounded-sm bg-background absolute">
                      <CardHeader className="pb-3 pt-3">
                        <CardTitle>Extensions</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm border py-4">
                        Select an extension from the side panel to view its
                        info.
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExtensionsPage;
