import { ContentLayout } from "@/components/admin-panel/content-layout";
import SchemaRecordSheet from "@/components/forms/schema-record-sheet";
import SchemaSheet from "@/components/forms/schema-sheet";
import { ContextDropdown } from "@/components/projects/ContextDropdown";
import { CreateModal } from "@/components/projects/CreateModal";
import { PluginSlot } from "@/components/projects/PluginSlot";
import { StageOutput } from "@/components/projects/StageOutput";
import { StageProgressView } from "@/components/projects/StageProgressView";
import { useLiveRun } from "@/contexts/LiveRunContext";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { Button } from "@/components/ui/button";
import { usePluginTest } from "@/hooks/misc/usePluginTest";
import { useAppTranslation } from "@/i18n/hooks";
import { cn } from "@/lib/utils";
import type { PluginSlotType } from "@/types/plugin-test.types";
import { useEffect, useRef, useState } from "react";

import * as SchemaRestClient from "@/lib/restClients/schemaRestClient";
import { useQuery } from "@tanstack/react-query";
import type { TableData } from "./ArchivePage";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";

import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
  ListRestart,
  MoreHorizontalIcon,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2Icon,
  Upload,
  X,
  FileIcon,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { manipulateData } from "@/lib/restClients/schemaRestClient";
import { LoadingSpinner } from "@/components/loading-spinner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import CodeMirror from "@uiw/react-codemirror";
import { type Extension } from "@codemirror/state";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { javascript } from "@codemirror/lang-javascript";
import { EditorView } from "@codemirror/view";
import { getCurrentTheme } from "@/lib/theme";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/lib/autoform/shadcn/components/ui/card";

const BINARY_MIME_TYPES = new Set([
  "application/vnd.sqlite3",
  "application/octet-stream",
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const MIME_ACCEPT_MAP: Record<string, string> = {
  "application/vnd.sqlite3": ".sqlite,.db",
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg,.jpeg",
  "image/png": ".png",
  "application/octet-stream": "*",
};

function isBinaryMimeType(mime: string | undefined) {
  return mime ? BINARY_MIME_TYPES.has(mime) : false;
}

function extensionsForMime(mime: string | undefined): Extension[] {
  if (mime?.includes("json")) return [json(), EditorView.lineWrapping];
  if (mime?.includes("xml")) return [xml(), EditorView.lineWrapping];
  return [EditorView.lineWrapping];
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ProjectsPage() {
  const { t } = useAppTranslation();

  const client = useKeycloakClient();
  const liveRunCtx = useLiveRun();
  const { state, actions } = usePluginTest(
    client.kc.token,
    undefined,
    liveRunCtx.startRun,
  );

  const [schema, setSchema] = useState<string | undefined>("Internal");
  const [table, setTable] = useState<string | undefined>("projects");
  const [syntaxType, setSyntaxType] = useState<string | undefined>(undefined);
  const [runType, setRunType] = useState<string>("dry-run");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedRecordItem, setSelectedRecordItem] = useState<any | undefined>(
    undefined,
  );

  const [outputTab, setOutputTab] = useState("validation");
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [dedupDialogOpen, setDedupDialogOpen] = useState(false);
  const [dedupMessageId, setDedupMessageId] = useState<string | null>(null);
  const [isRecordSheetOpen, setRecordSheetOpen] = useState(false);
  const [isEditMode, setEditMode] = useState(false);

  const [extensions, setExtensions] = useState<Extension[] | undefined>([
    json(),
    EditorView.lineWrapping,
  ]);

  const [theme, setTheme] = useState(getCurrentTheme);

  useEffect(() => {
    const onThemeChange = () => {
      setTheme(getCurrentTheme());
    };
    window.addEventListener("themechange", onThemeChange);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onThemeChange);

    return () => {
      window.removeEventListener("themechange", onThemeChange);
      mq.removeEventListener("change", onThemeChange);
    };
  }, []);

  const {
    runStatus,
    testResult,
    selectedPlugins,
    selectedFeedId,
    savedAssignment,
    payload,
    saving,
    savedOk,
    error,
  } = state;

  const liveRun = liveRunCtx.activeRun;

  const isRunning =
    runStatus === "running-validation" ||
    runStatus === "running-mapping" ||
    runStatus === "running-storage" ||
    runStatus === "running-outpost";

  const isBinaryInput = isBinaryMimeType(syntaxType);
  const hasPayload = isBinaryInput ? !!selectedFile : !!payload.trim();

  const canRun =
    (selectedPlugins.validation ||
      selectedPlugins.mapping ||
      selectedPlugins.storage ||
      selectedPlugins.outpost) &&
    hasPayload &&
    !isRunning;

  const canRunLive = !!selectedFeedId && hasPayload && !isRunning;

  // Keep the active tab in sync with the run mode.
  useEffect(() => {
    if (runType === "live") {
      setOutputTab("live");
    } else {
      setOutputTab("validation");
    }
  }, [runType]);

  // Auto-switch to Live tab when a live run starts.
  useEffect(() => {
    if (liveRun?.messageId) setOutputTab("live");
  }, [liveRun?.messageId]);

  // True when the UI selection matches what is currently saved in the DB.
  const selectionMatchesSaved =
    savedAssignment !== null &&
    (savedAssignment.validationPluginId ?? undefined) ===
      selectedPlugins.validation &&
    (savedAssignment.mappingPluginId ?? undefined) ===
      selectedPlugins.mapping &&
    (savedAssignment.storagePluginId ?? undefined) ===
      selectedPlugins.storage &&
    (savedAssignment.outpostPluginId ?? undefined) === selectedPlugins.outpost;

  const canSave = testResult?.allPassed && selectedFeedId && !savedOk;

  const {
    data: columns,
    refetch,
    isLoading,
    isRefetching,
  } = useQuery<TableData>({
    queryKey: ["Data", "ProjectsPage", table, schema],
    queryFn: async () => {
      if (table && schema) {
        const cols = await SchemaRestClient.getTableColumns(
          table,
          client.kc.token,
        );

        return (cols?.data || []).map((row) => {
          return {
            id: row.Name,
            name: row.Name.replace(/([A-Z]+)/g, " $1") // Handle consecutive capitals
              .replace(/([A-Z][a-z])/g, " $1") // Handle normal capitals
              .trim()
              .replace(/^./, (str) => str.toUpperCase())
              .replace(/\s+/g, " "), // Clean up multiple spaces
            type: row.Type,
            nullable: row.Nullable,
            primaryKey: row.PrimaryKey || false,
            constraint: row.Constraint,
          };
        });
      }
      return [];
    },
    refetchInterval: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  const SLOTS: Array<{
    key: PluginSlotType;
    label: string;
    dot: string;
    border: string;
    headerCls: string;
    activeDot: string;
  }> = [
    {
      key: "validation",
      label: "Validation",
      dot: "bg-sky-400",
      border: "border-l-sky-500",
      headerCls: "border-sky-500/30",
      activeDot: "bg-sky-400",
    },
    {
      key: "mapping",
      label: "Mapping",
      dot: "bg-violet-400",
      border: "border-l-violet-500",
      headerCls: "border-violet-500/30",
      activeDot: "bg-violet-400",
    },
    {
      key: "storage",
      label: "Storage",
      dot: "bg-emerald-400",
      border: "border-l-emerald-500",
      headerCls: "border-emerald-500/30",
      activeDot: "bg-emerald-400",
    },
    {
      key: "outpost",
      label: "Outpost",
      dot: "bg-orange-400",
      border: "border-l-orange-500",
      headerCls: "border-orange-500/30",
      activeDot: "bg-orange-400",
    },
  ];

  const onSubmit = async (data: any) => {
    let _data = data;
    if (selectedRecordItem) {
      _data = {
        ...selectedRecordItem,
        ...data,
      };
    }

    if (table && schema) {
      const keys = [_data];
      const results = await Promise.allSettled(
        keys.map((item) => {
          return manipulateData(
            table,
            schema,
            "archive",
            _data,
            client.kc.token,
            !isEditMode ? "POST" : "PUT",
          );
        }),
      );

      const successful = results.filter((r: any) => r.status === "fulfilled");
      const failed = results.filter((r: any) => r.status === "rejected");
      if (successful.length > 0) {
        toast.success(
          `(${successful.length}) ${
            !selectedRecordItem ? "created" : "updated"
          } successfully`,
          {
            className: "bg-card text-card-foreground border-border",
          },
        );
      }
      if (failed.length > 0) {
        toast.error(
          `Failed to ${
            !selectedRecordItem ? "create" : "update"
          }. Please try again.`,
          {
            className: "bg-card text-card-foreground border-border",
          },
        );
      }
      refetch();
      setSelectedRecordItem(undefined);

      actions.refreshProjects();
      if (state.selectedProjectId) {
        actions.refreshUseCases();
        if (state.selectedUseCaseId) {
          actions.refreshDataFeeds();
          if (state.selectedFeedId) {
            actions.refreshPlugins();
          }
        }
      }

      setEditMode(false);
      setRecordSheetOpen(false);
    }
  };

  const onDelete = async (data: any, _table?: string, _schema?: string) => {
    const effectiveTable = _table ?? table;
    const effectiveSchema = _schema ?? schema;
    if (effectiveTable && effectiveSchema) {
      const keys = [data];
      // console.log("onDelete", effectiveTable, effectiveSchema, data);
      const results = await Promise.allSettled(
        keys.map((item) => {
          return manipulateData(
            effectiveTable,
            effectiveSchema,
            "archive",
            data,
            client.kc.token,
            "DELETE",
          );
        }),
      );

      // console.log("onDelete", results);

      const successful = results.filter((r: any) => r.status === "fulfilled");
      const failed = results.filter((r: any) => r.status === "rejected");
      if (successful.length > 0) {
        toast.success(`(${successful.length}) dleted successfully`, {
          className: "bg-card text-card-foreground border-border",
        });
      }
      if (failed.length > 0) {
        toast.error(`Failed to delete. Please try again.`, {
          className: "bg-card text-card-foreground border-border",
        });
      }
      refetch();
      setSelectedRecordItem(undefined);

      if (successful.length > 0) {
        if (effectiveTable === "projects") {
          actions.selectProject(undefined);
          actions.refreshProjects();
        } else if (effectiveTable === "useCases") {
          actions.selectUseCase(undefined);
          actions.refreshUseCases();
        } else if (effectiveTable === "dataFeeds") {
          actions.selectFeed(undefined);
          actions.refreshDataFeeds();
        }
      }

      actions.refreshPlugins();

      setEditMode(false);
      setRecordSheetOpen(false);
    }
  };

  const EditData = (
    schema: string,
    table: string,
    item: any = undefined,
    editMode: boolean = false,
  ) => {
    // console.log(schema, table, item);
    setEditMode(editMode);
    setSchema(schema);
    setTable(table);
    setSelectedRecordItem(item);
    setRecordSheetOpen(true);
  };

  const DeleteData = (schema: string, table: string, item: any = undefined) => {
    setSchema(schema);
    setTable(table);
    onDelete(item, table, schema);
  };

  const navComponents = () => {
    return <h1 className="font-bold">{t("projects.title")}</h1>;
  };

  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-row min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        {isLoading || isRefetching ? (
          <div
            className={cn(
              "flex items-center justify-center min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
            )}
          >
            <LoadingSpinner />
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-row min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
            )}
          >
            {/* ── Left sidebar ────────────────────────────────────────────────────── */}
            <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-border">
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto py-3">
                <ButtonGroup className="w-full px-2 pb-2 focus-visible:outline-none">
                  <Select
                    disabled={state.projects.length === 0}
                    value={state.selectedProjectId || undefined}
                    onValueChange={(val) => {
                      actions.selectProject(val);
                      refetch();
                    }}
                  >
                    <SelectTrigger className="flex flex-1 rounded-sm text-sm focus-visible:outline-none">
                      <SelectValue placeholder="Project" />
                    </SelectTrigger>
                    <SelectContent
                      className="rounded-xs"
                      side="bottom"
                      avoidCollisions={false}
                      position="popper"
                    >
                      <SelectGroup>
                        {state.projects?.map((project: any) => {
                          return (
                            <SelectItem value={project.projectId}>
                              {project.projectName}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-center items-center min-h-9 max-h-9 w-[0.5px]">
                    <div className="flex bg-border min-h-7 max-h-7  w-[0.5px]"></div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      className="disabled:cursor-not-allowed"
                    >
                      <Button
                        className="rounded-sm disabled:cursor-not-allowed"
                        variant="outline"
                        size="icon"
                        aria-label="More Options"
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() => EditData("Internal", "projects")}
                        >
                          <Plus width={16} height={16} />
                          New
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!state.selectedProjectId}
                          onClick={() => {
                            const item = state.projects.find(
                              (uc: any) =>
                                uc.projectId === state.selectedProjectId,
                            );
                            EditData("Internal", "projects", item, true);
                          }}
                        >
                          <Pencil width={16} height={16} />
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={!state.selectedProjectId}
                          onClick={() => {
                            DeleteData("Internal", "projects", [
                              state.selectedProjectId,
                            ]);
                          }}
                        >
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ButtonGroup>

                <ButtonGroup className="w-full px-2 pb-2 focus-visible:outline-none">
                  <Select
                    key={state.selectedProjectId}
                    value={state.selectedUseCaseId || undefined}
                    onValueChange={(val) => {
                      actions.selectUseCase(val);
                      refetch();
                    }}
                  >
                    <SelectTrigger
                      disabled={
                        !state.selectedProjectId || state.useCases.length === 0
                      }
                      className="flex flex-1 rounded-sm text-sm focus-visible:outline-none"
                    >
                      <SelectValue placeholder="Use Case" />
                    </SelectTrigger>
                    <SelectContent
                      className="rounded-xs"
                      side="bottom"
                      avoidCollisions={false}
                      position="popper"
                    >
                      <SelectGroup>
                        {state.useCases?.map((useCase: any) => {
                          return (
                            <SelectItem value={useCase.useCaseId}>
                              {useCase.useCaseName}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-center items-center min-h-9 max-h-9 w-[0.5px]">
                    <div className="flex bg-border min-h-7 max-h-7  w-[0.5px]"></div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      className="disabled:cursor-not-allowed"
                      disabled={!state.selectedProjectId}
                    >
                      <Button
                        className="rounded-sm"
                        variant="outline"
                        size="icon"
                        aria-label="More Options"
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() =>
                            EditData("Internal", "useCases", {
                              projectId: state.selectedProjectId,
                            })
                          }
                        >
                          <Plus width={16} height={16} />
                          New
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!state.selectedUseCaseId}
                          onClick={() => {
                            const item = state.useCases.find(
                              (uc: any) =>
                                uc.useCaseId === state.selectedUseCaseId,
                            );
                            EditData("Internal", "useCases", item, true);
                          }}
                        >
                          <Pencil width={16} height={16} />
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={!state.selectedUseCaseId}
                          onClick={() => {
                            DeleteData("Internal", "useCases", [
                              state.selectedUseCaseId,
                            ]);
                          }}
                        >
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ButtonGroup>

                <ButtonGroup className="w-full px-2 pb-2 focus-visible:outline-none">
                  <Select
                    key={state.selectedUseCaseId}
                    value={state.selectedFeedId || undefined}
                    onValueChange={(val) => {
                      actions.selectFeed(val);
                      refetch();
                    }}
                  >
                    <SelectTrigger
                      disabled={
                        !state.selectedUseCaseId || state.dataFeeds.length === 0
                      }
                      className="flex flex-1 rounded-sm text-sm focus-visible:outline-none disabled:cursor-not-allowed"
                    >
                      <SelectValue placeholder="Data Feed" />
                    </SelectTrigger>
                    <SelectContent
                      className="rounded-xs"
                      side="bottom"
                      avoidCollisions={false}
                      position="popper"
                    >
                      <SelectGroup>
                        {state.dataFeeds?.map((dataFeed: any) => {
                          return (
                            <SelectItem value={dataFeed.dataFeedId}>
                              {dataFeed.dataFeedName}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-center items-center min-h-9 max-h-9 w-[0.5px]">
                    <div className="flex bg-border min-h-7 max-h-7  w-[0.5px]"></div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      disabled={!state.selectedUseCaseId}
                    >
                      <Button
                        className="rounded-sm"
                        variant="outline"
                        size="icon"
                        aria-label="More Options"
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() =>
                            EditData("Internal", "dataFeeds", {
                              useCaseId: state.selectedUseCaseId,
                            })
                          }
                        >
                          <Plus width={16} height={16} />
                          New
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!state.selectedFeedId}
                          onClick={() => {
                            const item = state.dataFeeds.find(
                              (df: any) =>
                                df.dataFeedId === state.selectedFeedId,
                            );
                            EditData("Internal", "dataFeeds", item, true);
                          }}
                        >
                          <Pencil width={16} height={16} />
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={!state.selectedFeedId}
                          onClick={() => {
                            DeleteData("Internal", "dataFeeds", [
                              state.selectedFeedId,
                            ]);
                          }}
                        >
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ButtonGroup>

                {/* Divider */}
                <div className="mx-3 my-4 border-t border-border" />

                {/* ── Pipeline Slots ── */}
                <p className="mb-2 px-3  text-[9px] uppercase tracking-[2px] ">
                  Pipeline Slots
                </p>
                {SLOTS.map((s, idx) => (
                  <ButtonGroup className="w-full px-2 pb-2 focus-visible:outline-none">
                    <Select
                      key={`${state.selectedFeedId}-${s.key}-${
                        selectedPlugins[s.key] ?? "__empty__"
                      }`}
                      value={selectedPlugins[s.key] || undefined}
                      onValueChange={(val) => {
                        actions.selectPlugin(s.key, val);
                        // refetch();
                      }}
                    >
                      <SelectTrigger
                        disabled={
                          !state.selectedFeedId ||
                          state.plugins[s.key].length === 0
                        }
                        className="flex flex-1 rounded-sm text-sm focus-visible:outline-none"
                      >
                        <SelectValue placeholder={s.label} />
                      </SelectTrigger>
                      <SelectContent
                        className="rounded-xs"
                        side="bottom"
                        avoidCollisions={false}
                        position="popper"
                      >
                        <SelectGroup>
                          {state.plugins[s.key]?.map((plugin: any) => {
                            return (
                              <SelectItem value={plugin.pluginId}>
                                {/* {plugin.name} */}
                                <div>
                                  <div className=" text-[11px] text-left truncate w-full">
                                    {plugin.pluginName}
                                  </div>
                                  <div className=" text-[9px] text-left w-full">
                                    v{plugin.pluginVersion}
                                  </div>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <div className="flex justify-center items-center min-h-9 max-h-9 w-[0.5px]">
                      <div className="flex bg-border min-h-7 max-h-7  w-[0.5px]"></div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        disabled={!state.selectedFeedId}
                        className="disabled:cursor-not-allowed"
                      >
                        <Button
                          className="rounded-sm"
                          variant="outline"
                          size="icon"
                          aria-label="More Options"
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => EditData("Internal", "plugins")}
                          >
                            <Plus width={16} height={16} />
                            New
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={selectedPlugins[s.key] ? false : true}
                            onClick={() => {
                              const item = state.plugins[s.key]?.find(
                                (plugin: any) =>
                                  plugin.pluginId === selectedPlugins[s.key],
                              );
                              if (item) {
                                EditData("Internal", "plugins", item, true);
                              }
                            }}
                          >
                            <Pencil width={16} height={16} />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={selectedPlugins[s.key] ? false : true}
                            onClick={() => {
                              DeleteData("Internal", "plugins", [
                                selectedPlugins[s.key],
                              ]);
                              actions.selectPlugin(s.key, undefined);
                            }}
                          >
                            <Trash2Icon />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ButtonGroup>
                ))}
              </div>
            </aside>

            {/* ── Main panel ──────────────────────────────────────────────────────── */}
            <main className="flex w-full min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] flex-col overflow-hidden">
              <div className="flex min-h-1/2 max-h-1/2 flex-col border-b border-border">
                <div className="flex w-full px-2 min-h-12 max-h-12 justify-between border-b border-border items-center">
                  <div className="flex flex-row gap-2 items-center">
                    <Select value={runType} onValueChange={setRunType}>
                      <SelectTrigger className="flex flex-1 w-20 max-h-8 rounded border bg-transparent dark:bg-transparent">
                        <SelectValue placeholder="Run Type" />
                      </SelectTrigger>
                      <SelectContent
                        className="rounded-xs"
                        side="bottom"
                        avoidCollisions={false}
                        position="popper"
                      >
                        <SelectGroup>
                          <SelectItem value="dry-run">Dry-Run</SelectItem>
                          <SelectItem value="live">Live</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    <div className="flex bg-border w-px min-h-6 max-h-6" />

                    <Select
                      value={syntaxType}
                      onValueChange={(val) => {
                        setSyntaxType(val);
                        setExtensions(extensionsForMime(val));
                        if (isBinaryMimeType(val)) {
                          setSelectedFile(null);
                        }
                        actions.setPayloadContentType(val);
                      }}
                    >
                      <SelectTrigger className="flex flex-1 w-48 max-h-8 rounded border bg-transparent dark:bg-transparent">
                        <SelectValue placeholder="Content Type" />
                      </SelectTrigger>
                      <SelectContent
                        className="rounded-xs max-h-72"
                        side="bottom"
                        avoidCollisions={false}
                        position="popper"
                      >
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Text
                          </SelectLabel>
                          <SelectItem value="application/json">JSON</SelectItem>
                          <SelectItem value="application/xml">XML</SelectItem>
                          <SelectItem value="text/csv">CSV</SelectItem>
                          <SelectItem value="text/tab-separated-values">
                            TSV
                          </SelectItem>
                          <SelectItem value="application/fhir+json">
                            FHIR JSON
                          </SelectItem>
                          <SelectItem value="application/fhir+xml">
                            FHIR XML
                          </SelectItem>
                          <SelectItem value="application/jsonl">
                            JSONL
                          </SelectItem>
                          <SelectItem value="application/hl7-v2">
                            HL7 v2
                          </SelectItem>
                          {/* <SelectItem value="text/plain">Plain Text</SelectItem> */}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Binary
                          </SelectLabel>
                          <SelectItem value="application/vnd.sqlite3">
                            SQLite
                          </SelectItem>
                          {/* <SelectItem value="application/octet-stream">
                            Binary
                          </SelectItem>
                          <SelectItem value="application/pdf">PDF</SelectItem>
                          <SelectItem value="image/jpeg">JPEG</SelectItem>
                          <SelectItem value="image/png">PNG</SelectItem> */}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        actions.setPayload("");
                        setSelectedFile(null);
                      }}
                    >
                      <ListRestart width={16} height={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (runType === "live") {
                          setLiveConfirmOpen(true);
                        } else {
                          actions.runTest(selectedFile);
                        }
                      }}
                      disabled={runType === "live" ? !canRunLive : !canRun}
                    >
                      <Play width={16} height={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={actions.saveAssignment}
                      disabled={!canSave || saving}
                    >
                      <Save width={16} height={16} />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-1 w-full overflow-y-auto">
                  {isBinaryMimeType(syntaxType) ? (
                    selectedFile ? (
                      <div className="flex flex-col items-center justify-center gap-3 w-full h-full bg-card">
                        <FileIcon className="h-10 w-10 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-[13px] font-medium">
                            {selectedFile.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {formatFileSize(selectedFile.size)} &middot;{" "}
                            {syntaxType}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                        >
                          <X width={14} height={14} className="mr-1" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragging(false);
                          const f = e.dataTransfer.files?.[0];
                          if (f) setSelectedFile(f);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-4 w-full h-full cursor-pointer transition-all border-2 border-dashed rounded-sm ${
                          dragging
                            ? "border-amber-400 bg-amber-400/5"
                            : "border-border hover:border-primary bg-card hover:bg-primary/5"
                        }`}
                      >
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-[13px] font-medium">
                            Drop file here or click to browse
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {syntaxType
                              ? MIME_ACCEPT_MAP[syntaxType] === "*"
                                ? "Any file type"
                                : `Accepts: ${
                                    MIME_ACCEPT_MAP[syntaxType] || "*"
                                  }`
                              : "Any file type"}
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept={
                            syntaxType ? MIME_ACCEPT_MAP[syntaxType] : "*"
                          }
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setSelectedFile(f);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    )
                  ) : syntaxType ? (
                    <CodeMirror
                      value={payload}
                      onChange={(value) => actions.setPayload(value)}
                      className="w-full h-full"
                      height="100%"
                      theme={theme === "dark" ? vscodeDark : vscodeLight}
                      extensions={extensions}
                    />
                  ) : (
                    <div className="flex w-full items-center justify-center h-full relative">
                      <div className="flex w-full h-full relative">
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

                      <div className="w-50 cursor-default p-3 m-0 gap-0 border border-border rounded-sm bg-background absolute">
                        Select a content type and provide data
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex min-h-1/2 max-h-1/2 overflow-hidden">
                <Tabs
                  className="flex flex-col w-full gap-0 overflow-hidden"
                  value={outputTab}
                  onValueChange={setOutputTab}
                >
                  {runType === "dry-run" ? (
                    <>
                      <div className="border-border border-b w-full">
                        <TabsList className="justify-start rounded-none bg-background p-0">
                          {SLOTS.map((s) => (
                            <TabsTrigger
                              key={s.key}
                              className="h-full rounded-none border-transparent border-t-none border-b-4 bg-background data-[state=active]:border-border data-[state=active]:shadow-none"
                              value={s.key}
                            >
                              {s.label}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>
                      {SLOTS.map((s) => {
                        const stageResult =
                          testResult?.stages[
                            s.key as
                              | "validation"
                              | "mapping"
                              | "storage"
                              | "outpost"
                          ];
                        const isStageRunning =
                          (s.key === "validation" &&
                            runStatus === "running-validation") ||
                          (s.key === "mapping" &&
                            runStatus === "running-mapping") ||
                          (s.key === "storage" &&
                            runStatus === "running-storage") ||
                          (s.key === "outpost" &&
                            runStatus === "running-outpost");
                        const isDone = !!stageResult;
                        const outputData = (stageResult as any)?.output ?? null;
                        const checks =
                          s.key === "validation"
                            ? (testResult?.stages.validation as any)?.checks ??
                              null
                            : null;
                        return (
                          <TabsContent
                            key={s.key}
                            value={s.key}
                            className="flex flex-1 min-h-0 w-full overflow-hidden"
                          >
                            <StageOutput
                              label={s.label}
                              headerClass={s.headerCls}
                              dotActiveClass={s.activeDot}
                              data={outputData}
                              checks={checks}
                              running={isStageRunning}
                              done={isDone}
                              durationMs={
                                stageResult
                                  ? (stageResult as any).durationMs
                                  : undefined
                              }
                            />
                          </TabsContent>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <div className="border-border border-b w-full">
                        <TabsList className="justify-start rounded-none bg-background p-0">
                          <TabsTrigger
                            className="h-full rounded-none border-transparent border-t-none border-b-4 bg-background data-[state=active]:border-border data-[state=active]:shadow-none"
                            value="live"
                          >
                            Live
                            {liveRun?.polling && (
                              <span className="ml-1.5 inline-flex gap-0.5">
                                {[0, 1, 2].map((i) => (
                                  <span
                                    key={i}
                                    className="h-1 w-1 rounded-full bg-amber-400 animate-pulse"
                                    style={{ animationDelay: `${i * 0.2}s` }}
                                  />
                                ))}
                              </span>
                            )}
                            {liveRun?.done && (
                              <span
                                className={`ml-1.5 text-[9px] ${
                                  liveRun.failed
                                    ? "text-red-400"
                                    : "text-green-400"
                                }`}
                              >
                                {liveRun.failed ? "✗" : "✓"}
                              </span>
                            )}
                          </TabsTrigger>
                        </TabsList>
                      </div>
                      <TabsContent
                        value="live"
                        className="flex flex-1 min-h-0 w-full overflow-hidden"
                      >
                        <StageProgressView
                          messageId={liveRun?.messageId ?? null}
                          events={liveRun?.events ?? []}
                          polling={liveRun?.polling ?? false}
                          done={liveRun?.done ?? false}
                          failed={liveRun?.failed ?? false}
                          stalenessSeconds={liveRunCtx.stalenessSeconds}
                        />
                      </TabsContent>
                    </>
                  )}
                </Tabs>
              </div>
            </main>

            {/* ── Live Run Confirmation ──────────────────────────────────────────── */}
            <AlertDialog
              open={liveConfirmOpen}
              onOpenChange={setLiveConfirmOpen}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {selectionMatchesSaved
                      ? "Send to live system?"
                      : "Plugin assignment not saved"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {selectionMatchesSaved ? (
                      "This will push the payload through the Kafka pipeline using the saved assignment. This action cannot be undone."
                    ) : savedAssignment !== null ? (
                      <>
                        Your current plugin selection differs from the saved
                        assignment. The live pipeline will use the{" "}
                        <strong>saved</strong> assignment, not the plugins
                        currently selected. Save your selection first, or
                        proceed with what is already saved.
                      </>
                    ) : (
                      "No plugin assignment has been saved for this feed yet. Save your current selection to continue with a live run."
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  {selectionMatchesSaved ? (
                    <AlertDialogAction
                      onClick={async () => {
                        setLiveConfirmOpen(false);
                        const result = await actions.runLive(selectedFile);
                        if (result?.deduplicated) {
                          setDedupMessageId(result.messageId);
                          setDedupDialogOpen(true);
                        }
                      }}
                    >
                      Run Live
                    </AlertDialogAction>
                  ) : savedAssignment !== null ? (
                    <>
                      <AlertDialogAction
                        onClick={async () => {
                          setLiveConfirmOpen(false);
                          const result = await actions.runLive(selectedFile);
                          if (result?.deduplicated) {
                            setDedupMessageId(result.messageId);
                            setDedupDialogOpen(true);
                          }
                        }}
                      >
                        Run with Saved
                      </AlertDialogAction>
                      <AlertDialogAction
                        onClick={async () => {
                          setLiveConfirmOpen(false);
                          const result = await actions.saveAndRunLive(
                            selectedFile,
                          );
                          if (result?.deduplicated) {
                            setDedupMessageId(result.messageId);
                            setDedupDialogOpen(true);
                          }
                        }}
                      >
                        Save &amp; Run Live
                      </AlertDialogAction>
                    </>
                  ) : (
                    <AlertDialogAction
                      onClick={async () => {
                        setLiveConfirmOpen(false);
                        const result = await actions.saveAndRunLive(
                          selectedFile,
                        );
                        if (result?.deduplicated) {
                          setDedupMessageId(result.messageId);
                          setDedupDialogOpen(true);
                        }
                      }}
                    >
                      Save &amp; Run Live
                    </AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* ── Dedup confirmation dialog ──────────────────────────────────── */}
            <AlertDialog
              open={dedupDialogOpen}
              onOpenChange={setDedupDialogOpen}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>File Already Processed</AlertDialogTitle>
                  <AlertDialogDescription>
                    This file has already been processed (run{" "}
                    <span className="font-mono">
                      {dedupMessageId?.slice(0, 8)}...
                    </span>
                    ). Do you want to force a new pipeline run?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDedupDialogOpen(false)}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      setDedupDialogOpen(false);
                      await actions.forceRunLive(selectedFile);
                    }}
                  >
                    Force Run
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* ── Modal ─────────────────────────────────────────────────────────── */}
            <SchemaRecordSheet
              isOpen={isRecordSheetOpen}
              data={{
                columns: columns || [],
                table: table || "",
                schema: schema || "",
              }}
              onSubmit={onSubmit}
              onDelete={onDelete}
              onCleared={() => {
                // handle function
              }}
              value={selectedRecordItem}
              setOpen={setRecordSheetOpen}
              onOpenChange={(value: boolean) => {
                if (!value) setSelectedRecordItem(undefined);
                setRecordSheetOpen(value);
              }}
            />
          </div>
        )}
      </div>
    </ContentLayout>
  );
}

export default ProjectsPage;
