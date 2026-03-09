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
import { useState } from "react";

import * as SchemaRestClient from "@/lib/restClients/schemaRestClient";
import { useQuery } from "@tanstack/react-query";
import type { TableData } from "./ArchivePage";

import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Plus } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ModalType = "project" | "usecase" | "feed" | "plugin";
interface ModalState {
  type: ModalType;
  slot?: PluginSlotType;
}

const SAMPLE_PAYLOAD = JSON.stringify(
  {
    patient_id: "TZ-KCMC-00421",
    sample_date: "2025-11-12",
    organism: "MRSA",
    antibiotic: "OXA",
    sir: "R",
    mic: 8,
    ward: "ICU",
    specimen_type: "Blood",
  },
  null,
  2,
);

function ProjectsPage() {
  const { t } = useAppTranslation();

  const client = useKeycloakClient();
  const { state, actions } = usePluginTest(client.kc.token);
  const [modal, setModal] = useState<ModalState | null>(null);

  const [schema, setSchema] = useState<string | undefined>("Internal");
  const [table, setTable] = useState<string | undefined>("projects");

  const [isRecordSheetOpen, setRecordSheetOpen] = useState(false);

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
    runStatus === "running-validation" || runStatus === "running-mapping";

  let parsedPayloadOk = false;
  try {
    if (payload.trim()) {
      JSON.parse(payload);
      parsedPayloadOk = true;
    }
  } catch {}

  const canRun =
    (selectedPlugins.validation || selectedPlugins.mapping) &&
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

  const handleCreate = async (value: string) => {
    if (!modal) return;
    try {
      if (modal.type === "project") await actions.createProject(value);
      if (modal.type === "usecase") await actions.createUseCase(value);
      if (modal.type === "feed") await actions.createDataFeed(value);
      if (modal.type === "plugin" && modal.slot)
        await actions.createPlugin(value, modal.slot);
    } catch (e) {
      /* toast here */
    }
    setModal(null);
  };

  const modalMeta: Record<ModalType, { title: string; placeholder: string }> = {
    project: {
      title: "New Project",
      placeholder: "e.g. KCMC AMR Surveillance",
    },
    usecase: {
      title: "New Use Case",
      placeholder: "e.g. WHONET Lab Ingestion",
    },
    feed: { title: "New Data Feed", placeholder: "e.g. WHONET SQLite Feed" },
    plugin: {
      title: `New ${
        modal?.slot
          ? modal.slot.charAt(0).toUpperCase() + modal.slot.slice(1)
          : ""
      } Plugin`,
      placeholder: "e.g. My Custom Validator",
    },
  };

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
        {/* ── Left sidebar ────────────────────────────────────────────────────── */}
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-border">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto py-3">
            <ButtonGroup className="w-full px-2 pb-2 focus-visible:outline-none">
              <Select
                value={state.selectedProjectId || undefined}
                onValueChange={(val) => {
                  actions.selectProject(val);
                  refetch();
                }}
              >
                <SelectTrigger className="flex flex-1 rounded-sm text-sm focus-visible:outline-none">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent className="rounded-xs">
                  <SelectGroup>
                    {state.projects?.map((project: any) => {
                      return (
                        <SelectItem value={project.id}>
                          {project.name}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <ButtonGroupSeparator />
              <Button
                variant="outline"
                className="rounded-sm"
                onClick={() => {
                  setSchema("Internal");
                  setTable("projects");
                  setRecordSheetOpen(true);
                }}
              >
                <Plus width={16} height={16} />
              </Button>
            </ButtonGroup>

            <ButtonGroup className="w-full px-2 pb-2 focus-visible:outline-none">
              <Select
                value={state.selectedUseCaseId || undefined}
                onValueChange={(val) => {
                  actions.selectUseCase(val);
                  refetch();
                }}
              >
                <SelectTrigger
                  disabled={!state.selectedProjectId}
                  className="flex flex-1 rounded-sm text-sm focus-visible:outline-none"
                >
                  <SelectValue placeholder="Use Case" />
                </SelectTrigger>
                <SelectContent className="rounded-xs">
                  <SelectGroup>
                    {state.useCases?.map((useCase: any) => {
                      return (
                        <SelectItem value={useCase.id}>
                          {useCase.name}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <ButtonGroupSeparator className="border-border bg-border" />
              <Button
                disabled={!state.selectedProjectId}
                variant="outline"
                className="rounded-sm"
                onClick={() => {
                  setSchema("Internal");
                  setTable("useCases");
                  setRecordSheetOpen(true);
                }}
              >
                <Plus width={16} height={16} />
              </Button>
            </ButtonGroup>

            <ButtonGroup className="w-full px-2 pb-2 focus-visible:outline-none">
              <Select
                value={state.selectedFeedId || undefined}
                onValueChange={(val) => {
                  actions.selectFeed(val);
                  refetch();
                }}
              >
                <SelectTrigger
                  disabled={!state.selectedUseCaseId}
                  className="flex flex-1 rounded-sm text-sm focus-visible:outline-none"
                >
                  <SelectValue placeholder="Data Feed" />
                </SelectTrigger>
                <SelectContent className="rounded-xs">
                  <SelectGroup>
                    {state.dataFeeds?.map((dataFeed: any) => {
                      return (
                        <SelectItem value={dataFeed.id}>
                          {dataFeed.name}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <ButtonGroupSeparator className="border-border bg-border" />
              <Button
                disabled={!state.selectedUseCaseId}
                variant="outline"
                className="rounded-sm"
                onClick={() => {
                  setSchema("Internal");
                  setTable("dataFeeds");
                  setRecordSheetOpen(true);
                }}
              >
                <Plus width={16} height={16} />
              </Button>
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
                  key={s.key}
                  value={selectedPlugins[s.key] || undefined}
                  onValueChange={(val) => {
                    actions.selectPlugin(s.key, val);
                    // refetch();
                  }}
                >
                  <SelectTrigger
                    disabled={!state.selectedFeedId}
                    className="flex flex-1 rounded-sm text-sm focus-visible:outline-none"
                  >
                    <SelectValue placeholder={s.label} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xs">
                    <SelectGroup>
                      {state.plugins[s.key]?.map((plugin: any) => {
                        return (
                          <SelectItem value={plugin.id}>
                            {/* {plugin.name} */}
                            <div>
                              <div className=" text-[11px] text-left truncate w-full">
                                {plugin.name}
                              </div>
                              <div className=" text-[9px] text-left w-full">
                                v{plugin.version}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <ButtonGroupSeparator className="border-border bg-border" />
                <Button
                  disabled={!state.selectedFeedId}
                  variant="outline"
                  className="rounded-sm"
                  onClick={() => {
                    setSchema("Internal");
                    setTable("plugins");
                    setRecordSheetOpen(true);
                  }}
                >
                  <Plus width={16} height={16} />
                </Button>
              </ButtonGroup>
              // <PluginSlot
              //   key={s.key}
              //   index={idx + 1}
              //   label={s.label}
              //   dotClass={s.dot}
              //   borderSelectedClass={s.border}
              //   plugins={state.plugins[s.key]}
              //   selectedId={selectedPlugins[s.key]}
              //   onSelect={(id) => actions.selectPlugin(s.key, id)}
              //   onAdd={() => setModal({ type: "plugin", slot: s.key })}
              // />
            ))}
          </div>

          {/* Footer: Run + Save */}
          <div className="shrink-0 space-y-2 border-t border-border p-3">
            {/* Run */}
            <Button
              variant="ghost"
              onClick={actions.runTest}
              disabled={!canRun}
              className={`flex w-full border border-border items-center justify-center gap-2 rounded-sm py-2.5  text-[11px] uppercase tracking-[2px] transition-all
              ${canRun ? "" : "cursor-not-allowed  bg-transparent "}`}
            >
              {isRunning ? (
                <>
                  <span className="h-2 w-2 animate-spin rounded-full border border-border border-t-white" />
                  Running…
                </>
              ) : (
                "▶  Run Test"
              )}
            </Button>

            {/* Save */}
            <Button
              variant="ghost"
              onClick={actions.saveAssignment}
              disabled={!canSave || saving}
              className={`flex w-full items-center justify-center gap-2 rounded-sm border py-2  text-[11px] uppercase tracking-[2px] transition-all
              ${
                canSave
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "cursor-not-allowed border-border "
              }
              ${savedOk ? "border-primary/50 bg-primary/15 text-primary" : ""}`}
            >
              {saving ? "Saving…" : savedOk ? "✓ Saved" : "↓  Save Assignment"}
            </Button>

            {/* {!canRun && !isRunning && (
              <p className="text-center  text-[9px] ">
                {!parsedPayloadOk && payload.trim()
                  ? "Fix JSON payload first"
                  : !payload.trim()
                  ? "Paste a payload to test"
                  : "Select at least one plugin"}
              </p>
            )} */}
            {testResult && !testResult.allPassed && (
              <p className="text-center  text-[9px] text-red-500">
                Fix failures before saving
              </p>
            )}
          </div>
        </aside>

        {/* ── Main panel ──────────────────────────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border  px-5 py-3">
            {state.selectedProjectId ? (
              <>
                <span className=" text-[11px]">
                  {
                    state.projects.find((p) => p.id === state.selectedProjectId)
                      ?.name
                  }
                </span>
                {state.selectedUseCaseId && (
                  <>
                    <span className="text-slate-800">›</span>
                    <span className=" text-[11px]">
                      {
                        state.useCases.find(
                          (u) => u.id === state.selectedUseCaseId,
                        )?.name
                      }
                    </span>
                  </>
                )}
                {state.selectedFeedId && (
                  <>
                    <span className="text-slate-800">›</span>
                    <span className=" text-[11px] text-sky-400">
                      {
                        state.dataFeeds.find(
                          (f) => f.id === state.selectedFeedId,
                        )?.name
                      }
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className=" text-[11px] italic ">No context selected</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {error && (
                <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5  text-[10px] text-red-400">
                  {error}
                  <Button
                    variant="ghost"
                    onClick={actions.clearError}
                    className="ml-2 text-red-500 hover:text-red-300"
                  >
                    ✕
                  </Button>
                </span>
              )}
              {testResult?.allPassed && (
                <span className="rounded-md border  bg-green-500/10 px-2 py-0.5  text-[10px]">
                  ✓ All stages passed
                </span>
              )}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto space-y-4 p-4">
            {/* ── Payload ── */}
            <div className="overflow-hidden rounded-sm border border-border bg-card/50">
              <div className="flex items-center justify-between border-b  bg-card px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm bg-border" />
                  <span className=" text-[10px] uppercase tracking-[2px]">
                    Input Payload
                  </span>
                  <span className=" text-[9px] ">JSON</span>
                </div>
                <div className="flex gap-2">
                  {payload.trim() && (
                    <span
                      className={` text-[9px] ${
                        parsedPayloadOk ? "text-green-500" : "text-red-400"
                      }`}
                    >
                      {parsedPayloadOk ? "✓ Valid JSON" : "✗ Invalid JSON"}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => actions.setPayload(SAMPLE_PAYLOAD)}
                    className="rounded border border-border px-2 py-0.5  text-[9px]"
                  >
                    SAMPLE
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => actions.setPayload("")}
                    className="rounded border border-border px-2 py-0.5  text-[9px]"
                  >
                    CLEAR
                  </Button>
                </div>
              </div>
              <textarea
                value={payload}
                onChange={(e) => actions.setPayload(e.target.value)}
                spellCheck={false}
                placeholder={'{\n  "paste": "your JSON payload here"\n}'}
                className="h-44 w-full resize-none bg-transparent px-4 py-3  text-[11px] leading-relaxed  outline-none"
              />
              <div className="flex justify-end border-t border-border px-4 py-1">
                <span className=" text-[9px] ">
                  {payload.split("\n").length} lines
                </span>
              </div>
            </div>

            {/* ── Validation + Mapping outputs ── */}
            {SLOTS.filter((s) => s.key !== "outpost").map((s) => {
              const stageResult =
                testResult?.stages[s.key as "validation" | "mapping"];
              const isStageRunning =
                (s.key === "validation" &&
                  runStatus === "running-validation") ||
                (s.key === "mapping" && runStatus === "running-mapping");
              const isDone = !!stageResult;

              const outputData =
                s.key === "validation"
                  ? (testResult?.stages.validation as any)?.output ?? null
                  : (testResult?.stages.mapping as any)?.output ?? null;

              const checks =
                s.key === "validation"
                  ? (testResult?.stages.validation as any)?.checks ?? null
                  : null;

              return (
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
                    stageResult ? (stageResult as any).durationMs : undefined
                  }
                />
              );
            })}

            {/* ── Outpost note ── */}
            <div className="flex items-center gap-3 rounded-sm border border-dashed border-border bg-card px-4 py-3">
              <span className="h-2 w-2 shrink-0 rounded-sm bg-border" />
              <span className=" text-[10px]">
                <span className="t">OUTPOST</span> · Not executed in test mode.
                {selectedPlugins.outpost && (
                  <span className="">
                    {" "}
                    Would forward to:{" "}
                    {
                      state.plugins.outpost.find(
                        (o) => o.id === selectedPlugins.outpost,
                      )?.name
                    }
                    .
                  </span>
                )}
              </span>
            </div>
          </div>
        </main>

        {/* ── Modal ─────────────────────────────────────────────────────────── */}
        {/* {modal && (
          <CreateModal
            title={modalMeta[modal.type].title}
            placeholder={modalMeta[modal.type].placeholder}
            onConfirm={handleCreate}
            onClose={() => setModal(null)}
          />
        )} */}

        <SchemaRecordSheet
          isOpen={isRecordSheetOpen}
          data={{
            columns: columns || [],
            table: table || "",
            schema: schema || "",
          }}
          onSubmit={() => {
            // handle function
          }}
          onDelete={() => {
            // handle function
          }}
          onCleared={() => {
            // handle function
          }}
          value={undefined}
          setOpen={setRecordSheetOpen}
          onOpenChange={(value: boolean) => {
            // if (!value) setSelectedRecordItem(undefined);
            setRecordSheetOpen(value);
          }}
        />
      </div>
    </ContentLayout>
  );
}

export default ProjectsPage;
