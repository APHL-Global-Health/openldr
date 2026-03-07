import { ContentLayout } from "@/components/admin-panel/content-layout";
import { ContextDropdown } from "@/components/projects/ContextDropdown";
import { CreateModal } from "@/components/projects/CreateModal";
import { PluginSlot } from "@/components/projects/PluginSlot";
import { StageOutput } from "@/components/projects/StageOutput";
import { usePluginTest } from "@/hooks/misc/usePluginTest";
import { useAppTranslation } from "@/i18n/hooks";
import { cn } from "@/lib/utils";
import type { PluginSlotType } from "@/types/plugin-test.types";
import { useState } from "react";

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

  const { state, actions } = usePluginTest();
  const [modal, setModal] = useState<ModalState | null>(null);

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
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-slate-900">
          {/* Header */}
          <div className="shrink-0 border-b border-slate-900 px-3 py-3">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[3px] text-slate-600">
              Plugin Test Harness
            </p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
              <span className="font-mono text-[9px] tracking-[1px] text-slate-600">
                KAFKA BYPASSED · TEST MODE
              </span>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto py-3">
            {/* ── Context Section ── */}
            <p className="mb-2 px-3 font-mono text-[9px] uppercase tracking-[2px] text-slate-700">
              Context
            </p>

            <ContextDropdown
              label="Project"
              accentClass="border-cyan-500"
              items={state.projects}
              selectedId={state.selectedProjectId}
              onSelect={actions.selectProject}
              onAdd={() => setModal({ type: "project" })}
            />

            <div className="my-1.5 ml-5 border-l border-slate-900 pl-0 py-1" />

            <ContextDropdown
              label="Use Case"
              accentClass="border-indigo-500"
              items={state.useCases}
              selectedId={state.selectedUseCaseId}
              disabled={!state.selectedProjectId}
              onSelect={actions.selectUseCase}
              onAdd={() => setModal({ type: "usecase" })}
            />

            <div className="my-1.5 ml-5 border-l border-slate-900 py-1" />

            <ContextDropdown
              label="Data Feed"
              accentClass="border-sky-500"
              items={state.dataFeeds}
              selectedId={state.selectedFeedId}
              disabled={!state.selectedUseCaseId}
              onSelect={actions.selectFeed}
              onAdd={() => setModal({ type: "feed" })}
            />

            {/* Divider */}
            <div className="mx-3 my-4 border-t border-slate-900" />

            {/* ── Pipeline Slots ── */}
            <p className="mb-2 px-3 font-mono text-[9px] uppercase tracking-[2px] text-slate-700">
              Pipeline Slots
            </p>
            {SLOTS.map((s, idx) => (
              <PluginSlot
                key={s.key}
                index={idx + 1}
                label={s.label}
                dotClass={s.dot}
                borderSelectedClass={s.border}
                plugins={state.plugins[s.key]}
                selectedId={selectedPlugins[s.key]}
                onSelect={(id) => actions.selectPlugin(s.key, id)}
                onAdd={() => setModal({ type: "plugin", slot: s.key })}
              />
            ))}
          </div>

          {/* Footer: Run + Save */}
          <div className="shrink-0 space-y-2 border-t border-slate-900 p-3">
            {/* Run */}
            <button
              onClick={actions.runTest}
              disabled={!canRun}
              className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-mono text-[11px] uppercase tracking-[2px] transition-all
              ${
                canRun
                  ? "bg-gradient-to-r from-sky-600 to-violet-600 text-white hover:from-sky-500 hover:to-violet-500 shadow-lg shadow-sky-900/30"
                  : "cursor-not-allowed border border-slate-800 bg-transparent text-slate-700"
              }`}
            >
              {isRunning ? (
                <>
                  <span className="h-2 w-2 animate-spin rounded-full border border-white/30 border-t-white" />
                  Running…
                </>
              ) : (
                "▶  Run Test"
              )}
            </button>

            {/* Save */}
            <button
              onClick={actions.saveAssignment}
              disabled={!canSave || saving}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 font-mono text-[11px] uppercase tracking-[2px] transition-all
              ${
                canSave
                  ? "border-green-600/50 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "cursor-not-allowed border-slate-800 text-slate-700"
              }
              ${
                savedOk
                  ? "border-green-500/50 bg-green-500/15 text-green-400"
                  : ""
              }`}
            >
              {saving ? "Saving…" : savedOk ? "✓ Saved" : "↓  Save Assignment"}
            </button>

            {!canRun && !isRunning && (
              <p className="text-center font-mono text-[9px] text-slate-700">
                {!parsedPayloadOk && payload.trim()
                  ? "Fix JSON payload first"
                  : !payload.trim()
                  ? "Paste a payload to test"
                  : "Select at least one plugin"}
              </p>
            )}
            {testResult && !testResult.allPassed && (
              <p className="text-center font-mono text-[9px] text-red-500">
                Fix failures before saving
              </p>
            )}
          </div>
        </aside>

        {/* ── Main panel ──────────────────────────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-900 bg-[#04080f] px-5 py-3">
            {state.selectedProjectId ? (
              <>
                <span className="font-mono text-[11px] text-slate-500">
                  {
                    state.projects.find((p) => p.id === state.selectedProjectId)
                      ?.name
                  }
                </span>
                {state.selectedUseCaseId && (
                  <>
                    <span className="text-slate-800">›</span>
                    <span className="font-mono text-[11px] text-slate-500">
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
                    <span className="font-mono text-[11px] text-sky-400">
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
              <span className="font-mono text-[11px] italic text-slate-700">
                No context selected
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {error && (
                <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] text-red-400">
                  {error}
                  <button
                    onClick={actions.clearError}
                    className="ml-2 text-red-500 hover:text-red-300"
                  >
                    ✕
                  </button>
                </span>
              )}
              {testResult?.allPassed && (
                <span className="rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 font-mono text-[10px] text-green-400">
                  ✓ All stages passed
                </span>
              )}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto space-y-4 p-4">
            {/* ── Payload ── */}
            <div className="overflow-hidden rounded-xl border border-green-500/30 bg-[#080d14] shadow-[0_0_20px_rgba(34,197,94,0.05)]">
              <div className="flex items-center justify-between border-b border-green-500/20 bg-green-500/[0.04] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm bg-green-500" />
                  <span className="font-mono text-[10px] uppercase tracking-[2px] text-green-400">
                    Input Payload
                  </span>
                  <span className="font-mono text-[9px] text-slate-600">
                    JSON
                  </span>
                </div>
                <div className="flex gap-2">
                  {payload.trim() && (
                    <span
                      className={`font-mono text-[9px] ${
                        parsedPayloadOk ? "text-green-500" : "text-red-400"
                      }`}
                    >
                      {parsedPayloadOk ? "✓ Valid JSON" : "✗ Invalid JSON"}
                    </span>
                  )}
                  <button
                    onClick={() => actions.setPayload(SAMPLE_PAYLOAD)}
                    className="rounded border border-slate-800 px-2 py-0.5 font-mono text-[9px] text-slate-600 transition hover:border-slate-600 hover:text-slate-400"
                  >
                    SAMPLE
                  </button>
                  <button
                    onClick={() => actions.setPayload("")}
                    className="rounded border border-slate-800 px-2 py-0.5 font-mono text-[9px] text-slate-600 transition hover:border-slate-600 hover:text-slate-400"
                  >
                    CLEAR
                  </button>
                </div>
              </div>
              <textarea
                value={payload}
                onChange={(e) => actions.setPayload(e.target.value)}
                spellCheck={false}
                placeholder={'{\n  "paste": "your JSON payload here"\n}'}
                className="h-44 w-full resize-none bg-transparent px-4 py-3 font-mono text-[11px] leading-relaxed text-green-400 placeholder-slate-700 outline-none"
              />
              <div className="flex justify-end border-t border-slate-800/50 px-4 py-1">
                <span className="font-mono text-[9px] text-slate-700">
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
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-orange-500/20 bg-orange-500/[0.04] px-4 py-3">
              <span className="h-2 w-2 shrink-0 rounded-sm bg-orange-500/30" />
              <span className="font-mono text-[10px] text-slate-500">
                <span className="text-orange-400/60">OUTPOST</span> · Not
                executed in test mode.
                {selectedPlugins.outpost && (
                  <span className="text-slate-600">
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
        {modal && (
          <CreateModal
            title={modalMeta[modal.type].title}
            placeholder={modalMeta[modal.type].placeholder}
            onConfirm={handleCreate}
            onClose={() => setModal(null)}
          />
        )}
      </div>
    </ContentLayout>
  );
}

export default ProjectsPage;
