import { ContentLayout } from "@/components/admin-panel/content-layout";
import SchemaRecordSheet from "@/components/forms/schema-record-sheet";
import SchemaSheet from "@/components/forms/schema-sheet";
import { ContextDropdown } from "@/components/projects/ContextDropdown";
import { CreateModal } from "@/components/projects/CreateModal";
import { PluginSlot } from "@/components/projects/PluginSlot";
import { StageOutput } from "@/components/projects/StageOutput";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { Button } from "@/components/ui/button";
import { usePluginTest } from "@/hooks/misc/usePluginTest";
import { useAppTranslation } from "@/i18n/hooks";
import { cn } from "@/lib/utils";
import type { PluginSlotType } from "@/types/plugin-test.types";
import { useEffect, useState } from "react";

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
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { manipulateData } from "@/lib/restClients/schemaRestClient";
import { LoadingSpinner } from "@/components/loading-spinner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import CodeMirror from "@uiw/react-codemirror";
import { EditorState } from "@codemirror/state";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { getCurrentTheme } from "@/lib/theme";

type ModalType = "project" | "usecase" | "feed" | "plugin";
interface ModalState {
  type: ModalType;
  slot?: PluginSlotType;
}

function ProjectsPage() {
  const { t } = useAppTranslation();

  const client = useKeycloakClient();
  const { state, actions } = usePluginTest(client.kc.token);

  const [schema, setSchema] = useState<string | undefined>("Internal");
  const [table, setTable] = useState<string | undefined>("projects");

  const [selectedRecordItem, setSelectedRecordItem] = useState<any | undefined>(
    undefined,
  );

  const [isRecordSheetOpen, setRecordSheetOpen] = useState(false);
  const [isEditMode, setEditMode] = useState(false);

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
    payload,
    saving,
    savedOk,
    error,
  } = state;

  const isRunning =
    runStatus === "running-validation" ||
    runStatus === "running-mapping" ||
    runStatus === "running-outpost";

  let parsedPayloadOk = false;
  try {
    if (payload.trim()) {
      JSON.parse(payload);
      parsedPayloadOk = true;
    }
  } catch {}

  const canRun =
    (selectedPlugins.validation ||
      selectedPlugins.mapping ||
      selectedPlugins.outpost) &&
    parsedPayloadOk &&
    !isRunning;

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
      console.log("onDelete", effectiveTable, effectiveSchema, data);
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
    console.log(schema, table, item);
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
                  <div></div>
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => actions.setPayload("")}
                    >
                      <ListRestart width={16} height={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={actions.runTest}
                      disabled={!canRun}
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
                  <CodeMirror
                    value={payload}
                    onChange={(value) => actions.setPayload(value)}
                    className="w-full"
                    theme={theme === "dark" ? vscodeDark : vscodeLight}
                    extensions={[json(), EditorView.lineWrapping]}
                  />
                </div>
              </div>
              <div className="flex min-h-1/2 max-h-1/2 overflow-hidden">
                <Tabs
                  className="flex flex-col w-full gap-0 overflow-hidden"
                  defaultValue={SLOTS[0].key}
                >
                  <div className="border-border border-b w-full">
                    <TabsList className="justify-start rounded-none bg-background p-0">
                      {SLOTS.map((s) => {
                        return (
                          <TabsTrigger
                            key={s.key}
                            className="h-full rounded-none border-transparent border-t-none border-b-4 bg-background data-[state=active]:border-border data-[state=active]:shadow-none"
                            value={s.key}
                          >
                            {s.label}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </div>

                  {/* ── Validation + Mapping + Outpost outputs ── */}
                  {SLOTS.map((s) => {
                    const stageResult =
                      testResult?.stages[
                        s.key as "validation" | "mapping" | "outpost"
                      ];
                    const isStageRunning =
                      (s.key === "validation" &&
                        runStatus === "running-validation") ||
                      (s.key === "mapping" &&
                        runStatus === "running-mapping") ||
                      (s.key === "outpost" && runStatus === "running-outpost");
                    const isDone = !!stageResult;

                    const outputData = (stageResult as any)?.output ?? null;

                    const checks =
                      s.key === "validation"
                        ? (testResult?.stages.validation as any)?.checks ?? null
                        : null;

                    return (
                      <TabsContent
                        value={s.key}
                        className="flex flex-1 min-h-0 w-full overflow-hidden"
                      >
                        <StageOutput
                          key={s.key}
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
                </Tabs>
              </div>
            </main>

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
