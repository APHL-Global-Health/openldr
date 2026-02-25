import { ContentLayout } from "@/components/admin-panel/content-layout";

import { useState, useEffect, useRef } from "react";

import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ListRestart,
  Save,
  NotebookIcon,
  RefreshCwIcon,
  PlayIcon,
  FolderDown,
} from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { processFeedEntry } from "@/lib/restClients/dataProcessingRestClient";
import { AutoForm } from "@/components/autoform";
import { ZodProvider } from "@/lib/autoform/zod";
import { type UseFormReturn } from "react-hook-form";

import { toJsonSchema, toZodSchema } from "@/lib/schemaUtils";

import {
  AutoFormProvider,
  useAutoFormTrigger,
} from "@/components/autoform-provider";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
} from "@/components/ui/input-group";
import { CopyIcon } from "@radix-ui/react-icons";

import JsonView from "@uiw/react-json-view";
import { lightTheme } from "@uiw/react-json-view/light";
import { vscodeTheme as darkTheme } from "@uiw/react-json-view/vscode";
import { toast } from "sonner";

import * as DataEntryRestClient from "@/lib/restClients/dataEntryRestClient";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";

import JSZip from "jszip";
import Papa from "papaparse";

const getCurrentTheme = () => {
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
};

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSQLiteClient } from "@/components/sqlite-client-provider";

function DataEntryPage() {
  const sql = useSQLiteClient();
  const client = useKeycloakClient();

  const { trigger } = useAutoFormTrigger();
  const [selectedFeed, setSelectedFeed] = useState<any | undefined>(undefined);
  const [selectedFeedValue, setSelectedFeedValue] = useState<any | undefined>(
    undefined,
  );
  const [importDialog, setImportDialog] = useState({
    open: false,
    data: [] as any[],
    fileName: "",
  });
  const [form, setForm] = useState<UseFormReturn<any, any, any> | null>(null);
  const [pageOption, setPageOption] = useState<string>("form");
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const { data: entryForms } = useQuery({
    queryKey: ["DataEntry", "Forms"],
    queryFn: async () => {
      return await DataEntryRestClient.getAllForms("form", client.kc.token);
    },
    refetchInterval: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  const { data, refetch, isLoading, isRefetching } = useQuery<any>({
    queryKey: ["DataEntry", "Form", selectedFeed],
    queryFn: async () => {
      if (selectedFeed) {
        const json = await DataEntryRestClient.getForm(
          selectedFeed.name,
          selectedFeed.version,
          "form",
          client.kc.token,
        );

        try {
          // console.log(JSON.stringify(json));

          const _schema = toZodSchema(json);

          const schemaProvider = new ZodProvider(_schema as any);

          return {
            title: json.title,
            description: json.description,
            schema: schemaProvider,
            code: toJsonSchema(_schema),
          };
        } catch (error) {
          console.error("Error converting to Zod schema:", error);
        }

        return {
          title: undefined,
          description: undefined,
          schema: undefined,
          code: undefined,
        };
      }
      return {
        title: undefined,
        description: undefined,
        schema: undefined,
        code: undefined,
      };
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  const theme = localStorage.getItem("theme") || getCurrentTheme();

  async function onSubmit(values: any, _form?: any) {
    if (values && selectedFeed && selectedFeed.feed) {
      setLoading(true);

      try {
        if (client.kc.token) {
          await processFeedEntry(values, selectedFeed.feed, client.kc.token);

          toast.success(`Submitted successfully`, {
            className: "bg-card text-card-foreground border-border",
          });
        }
      } catch (error: any) {
        toast.error(`Failed to submit. Please try again.`, {
          className: "bg-card text-card-foreground border-border",
        });
      } finally {
        setLoading(false);
      }
    }
  }

  const allowed = [".zip", ".jsonl", ".json", ".sqlite", ".db", ".csv", ".tsv"];

  const handleImport = async () => {
    setImportDialog({ open: false, data: importDialog.data, fileName: "" });

    if (selectedFeed && selectedFeed.feed) {
      setLoading(true);

      try {
        if (client.kc.token) {
          for (let x = 0; x < importDialog.data.length; x++) {
            const values = importDialog.data[x];
            if (values) {
              await processFeedEntry(
                values,
                selectedFeed.feed,
                client.kc.token,
              );
            }
          }

          toast.success("Data imported successfully", {
            className: "bg-card text-card-foreground border-border",
            description: `${importDialog.data.length} records imported`,
          });
        }
      } catch (error: any) {
        toast.error(`Failed to submit. Please try again.`, {
          className: "bg-card text-card-foreground border-border",
        });
      } finally {
        setLoading(false);
      }
    }

    setImportDialog({ open: false, data: [], fileName: "" });
  };

  const handleCancel = () => {
    setImportDialog({ open: false, data: [], fileName: "" });
  };

  const loadFromFile = async (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const ext = "." + f.name.split(".").pop()?.toLowerCase();

    if (allowed.includes(ext)) {
      try {
        let data: any[] = [];

        if (ext === ".jsonl") {
          const text = await f.text();
          const lines = text.split("\n").filter((line) => line.trim());
          data = lines.map((line) => JSON.parse(line));
        } else if (ext === ".zip") {
          const zip = new JSZip();
          const contents = await zip.loadAsync(f);

          const jsonlFile = Object.keys(contents.files).find((name) =>
            name.endsWith(".jsonl"),
          );
          const jsonFile = Object.keys(contents.files).find((name) =>
            name.endsWith(".json"),
          );
          const csvFile = Object.keys(contents.files).find((name) =>
            name.endsWith(".csv"),
          );
          const tsvFile = Object.keys(contents.files).find((name) =>
            name.endsWith(".tsv"),
          );

          if (jsonlFile) {
            const text = await contents.files[jsonlFile].async("text");
            const lines = text.split("\n").filter((line) => line.trim());
            data = lines.map((line) => JSON.parse(line));
          } else if (jsonFile) {
            const text = await contents.files[jsonFile].async("text");
            const parsed = JSON.parse(text);
            data = Array.isArray(parsed) ? parsed : [parsed];
          } else if (csvFile) {
            const text = await contents.files[csvFile].async("text");
            const result = Papa.parse(text, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (header) => header.trim(),
            });
            data = result.data;
          } else if (tsvFile) {
            const text = await contents.files[tsvFile].async("text");
            const result = Papa.parse(text, {
              header: true,
              delimiter: "\t",
              skipEmptyLines: true,
              transformHeader: (header) => header.trim(),
            });
            data = result.data;
          } else {
            throw new Error("No supported file found in ZIP");
          }
        } else if (ext === ".json") {
          const text = await f.text();
          const parsed = JSON.parse(text);
          data = Array.isArray(parsed) ? parsed : [parsed];
        } else if (ext === ".sqlite" || ext === ".db") {
          const reader = new FileReader();
          reader.onabort = () => console.log("file reading was aborted");
          reader.onerror = () => console.log("file reading has failed");
          reader.onload = async () => {
            const result = reader.result;

            if (
              result &&
              result instanceof ArrayBuffer &&
              "TextDecoder" in window
            ) {
              const decoder = new TextDecoder("utf-8");
              const header = decoder.decode(result.slice(0, 16));
              if (header.startsWith("SQLite format 3")) {
                const db = sql.load(reader.result as ArrayBuffer);
                if (db) {
                  /*const _data = (
                      await dbUtils.get_table_data(db, "Isolates")
                    ).map((d) => {
                      d["FilePath"] = file.webkitRelativePath;
                      d["FileName"] = file.name;
                      d["FileSize"] = file.size;
                      d["FileLastModified"] = file.lastModified;
                      d["FileLastModifiedDate"] = formatDate(
                        new Date(file.lastModified)
                      );
                      d["FileWebkitRelativePath"] = file.webkitRelativePath;
                      return d;
                    });*/

                  db.close();
                }
              }
            }
          };
          reader.readAsArrayBuffer(f);
        } else if (ext === ".csv" || ext === ".tsv") {
          const text = await f.text();
          const result = Papa.parse(text, {
            header: true,
            delimiter: ext === ".tsv" ? "\t" : ",",
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
          });
          data = result.data;
        }

        if (data && data.length > 0) {
          // Open confirmation dialog
          setImportDialog({
            open: true,
            data,
            fileName: f.name,
          });
        }
      } catch (error) {
        console.error("Error loading file:", error);
        toast.error("Failed to load file", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        e.target.value = "";
      }
    }
  };

  useEffect(() => {
    if (selectedFeed) {
      refetch();
    }
  }, [selectedFeed, refetch]);

  const navComponents = () => {
    return (
      <div className="flex min-h-13 max-h-13 w-full items-center pr-2 py-2">
        <div className="flex flex-row items-center">
          <Select
            value={selectedFeedValue}
            onValueChange={(val: any) => {
              const form = (entryForms || []).find(
                (f) => `${f.name}_${f.version}` === val,
              );
              setSelectedFeedValue(val);
              setSelectedFeed(form);
            }}
          >
            <SelectTrigger className="focus:ring-0 w-50 h-8 justify-between ">
              <SelectValue placeholder="Forms" />
            </SelectTrigger>
            <SelectContent className="flex bg-background">
              {(entryForms || []).map((value) => {
                return (
                  <SelectItem
                    key={value.id}
                    value={`${value.name}_${value.version}`}
                  >
                    {value.name}
                    {" - v"}
                    {value.version}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Separator orientation="vertical" className=" h-6" />
        </div>

        <Separator orientation="vertical" className="mx-2 min-h-6" />

        <div className="flex flex-1"></div>

        <div className="flex h-full items-center">
          <Separator orientation="vertical" className="mx-2 min-h-6" />
          <div className="flex">
            <Tooltip>
              <TooltipTrigger
                style={{
                  pointerEvents:
                    loading || isLoading || selectedFeed === undefined
                      ? "none"
                      : "auto",
                }}
                asChild
              >
                <div className="flex h-full ">
                  <input
                    id="bulkImport"
                    type="file"
                    disabled={
                      loading || isLoading || selectedFeed === undefined
                    }
                    onChange={loadFromFile}
                    accept={allowed.join(",")}
                    className="hidden"
                  />
                  <label
                    htmlFor="bulkImport"
                    className="flex items-center justify-center h-9 cursor-pointer"
                  >
                    <FolderDown
                      className={cn(
                        "h-4 w-4 mx-2",
                        loading || isLoading || selectedFeed === undefined
                          ? "text-gray-500"
                          : "",
                      )}
                    />
                  </label>
                </div>
              </TooltipTrigger>
              <TooltipContent>Bulk Import</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled={loading || isLoading || selectedFeed === undefined}
                  onClick={() => {
                    if (form) {
                      form.reset();
                      trigger("reset", null);
                    }
                  }}
                  variant="ghost"
                  size="icon"
                >
                  <ListRestart className="h-4 w-4" />
                  <span className="sr-only">Clear</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span className="ml-auto text-muted text-sm">Clear</span>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled={loading || isLoading || selectedFeed === undefined}
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (formRef.current) {
                      if (formRef.current.requestSubmit) {
                        formRef.current.requestSubmit();
                      } else {
                        if (formRef.current.reportValidity()) {
                          // console.log("Form is valid");
                        }
                      }
                    }
                  }}
                >
                  <Save className="h-4 w-4" />
                  <span className="sr-only">Save</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span className="ml-auto text-muted text-sm">Save</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Separator orientation="vertical" className="mx-2 min-h-6" />
      </div>
    );
  };

  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        <div className="flex w-full h-full flex-col overflow-auto min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]">
          <div className="flex flex-1 border-b ">
            {loading || isLoading || isRefetching ? (
              <div className="w-full min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : data?.schema === undefined ? (
              <div className="flex min-h-[calc(100vh-26px-58px)] max-h-[calc(100vh-26px-58px)] flex-col items-center justify-center h-full w-full relative">
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

                <Card className="w-75 cursor-default p-0 m-0 gap-0 rounded-sm bg-background absolute">
                  <CardHeader className="pb-0 py-2">
                    <CardTitle>Data Entry</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm border py-4">
                    Select a data entry form from the panel above to view its
                    form.
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex w-full flex-col">
                <Item
                  variant="outline"
                  className="mx-2 my-3 bg-primary text-white dark:bg-black dark:text-foreground "
                >
                  <ItemMedia
                    variant="icon"
                    className="dark:bg-white text-black"
                  >
                    <NotebookIcon />
                  </ItemMedia>
                  <ItemContent>
                    {data.title && <ItemTitle>{data.title}</ItemTitle>}
                    {data.description && (
                      <ItemDescription className="text-gray-300">
                        {data.description}
                      </ItemDescription>
                    )}
                  </ItemContent>
                  <ItemActions>
                    <Button
                      className="text-black dark:text-white"
                      size="sm"
                      variant="outline"
                    >
                      Docs
                    </Button>
                  </ItemActions>
                </Item>

                <div className="px-2">
                  <Separator />
                </div>

                <div className="flex flex-row items-center px-2">
                  <div className="flex flex-1"></div>

                  <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    className="border mt-2"
                    value={pageOption}
                    onValueChange={(val) => {
                      setPageOption(val);
                    }}
                  >
                    <ToggleGroupItem
                      value="form"
                      className="text-sm items-center px-4"
                    >
                      Form
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="schema"
                      className="text-sm items-center px-4"
                    >
                      Schema
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {pageOption === "form" && (
                  <AutoForm
                    onFormInit={(form: any) => {
                      setForm(form);
                    }}
                    formProps={{
                      ref: formRef,
                      className:
                        "grid grid-cols-[24px_auto_1fr] h-fit gap-y-2 w-full px-2 py-3",
                    }}
                    uiComponents={{}}
                    schema={data.schema}
                    onSubmit={(data: any, form: any) => {
                      onSubmit(data, form);
                    }}
                    withSubmit={false}
                  />
                )}

                {pageOption === "schema" && (
                  <div className="flex gap-y-2 w-full px-2 py-3">
                    <InputGroup className="flex flex-1 ">
                      <JsonView
                        className="flex flex-1 w-full"
                        value={data.code}
                        style={theme === "dark" ? darkTheme : lightTheme}
                        shouldExpandNodeInitially={() => true}
                        collapsed={false}
                        enableClipboard={false}
                        displayDataTypes={false}
                        displayObjectSize={false}
                      />
                      {/* 
                    <InputGroupTextarea
                      id="textarea-code-32"
                      //   placeholder="console.log('Hello, world!');"
                      value={data.code}
                      className="flex flex-1"
                      readOnly={true}
                    />
                    <InputGroupAddon align="block-end" className="border-t">
                      <InputGroupText>Line 1, Column 1</InputGroupText>
                      <InputGroupButton
                        size="sm"
                        className="ml-auto"
                        variant="default"
                      >
                        Run <PlayIcon />
                      </InputGroupButton>
                    </InputGroupAddon> */}
                      <InputGroupAddon align="block-start" className="border-b">
                        <InputGroupText className="font-mono font-medium">
                          Json schema
                        </InputGroupText>
                        <InputGroupButton className="ml-auto" size="icon-xs">
                          <RefreshCwIcon />
                        </InputGroupButton>
                        <InputGroupButton variant="ghost" size="icon-xs">
                          <CopyIcon />
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Dialog
          open={importDialog.open}
          onOpenChange={(open) => !open && handleCancel()}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Data</DialogTitle>
              <DialogDescription>
                Are you sure you want to import {importDialog.data.length}{" "}
                record
                {importDialog.data.length !== 1 ? "s" : ""} from{" "}
                {importDialog.fileName}?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleImport}>Import</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ContentLayout>
  );
}

function HelperPage() {
  return (
    <AutoFormProvider>
      <DataEntryPage />
    </AutoFormProvider>
  );
}

export default HelperPage;
