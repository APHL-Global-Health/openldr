export type PluginStatus = "active" | "draft" | "inactive";
export type PluginSlotType = "validation" | "mapping" | "outpost";

// ── Domain entities ───────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  createdAt?: string;
}

export interface UseCase {
  id: string;
  projectId: string;
  name: string;
  createdAt?: string;
}

export interface DataFeed {
  id: string;
  useCaseId: string;
  name: string;
  createdAt?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  status: PluginStatus;
  slot: PluginSlotType;
  /** JavaScript source executed inside the VM */
  code: string;
  createdAt?: string;
}

export interface DataFeedPluginAssignment {
  feedId: string;
  validationPluginId: string | null;
  mappingPluginId: string | null;
  outpostPluginId: string | null;
}

// ── Plugin execution ──────────────────────────────────────────────────────────

export interface CheckResult {
  rule: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface ValidationStageResult {
  passed: boolean;
  checks: CheckResult[];
  /** Enriched / annotated payload passed to mapping stage */
  output: Record<string, unknown>;
  logs: string[];
  durationMs: number;
}

export interface MappingStageResult {
  /** Transformed payload (e.g. FHIR resource) */
  output: Record<string, unknown>;
  logs: string[];
  durationMs: number;
}

export type StageResult = ValidationStageResult | MappingStageResult;

// ── API request / response shapes ────────────────────────────────────────────

export interface RunPluginTestRequest {
  payload: string; // raw JSON string from the textarea
  validationPluginId?: string | null;
  mappingPluginId?: string | null;
  outpostPluginId?: string | null;
}

export interface RunPluginTestResponse {
  ok: boolean;
  stages: {
    validation?: ValidationStageResult;
    mapping?: MappingStageResult;
  };
  /** True when every executed stage passed with no failures */
  allPassed: boolean;
  error?: string;
}

export interface SavePluginAssignmentRequest {
  feedId: string;
  validationPluginId: string | null;
  mappingPluginId: string | null;
  outpostPluginId: string | null;
}

export interface SavePluginAssignmentResponse {
  ok: boolean;
  assignment: DataFeedPluginAssignment;
}

export interface CreateProjectRequest {
  name: string;
}
export interface CreateUseCaseRequest {
  name: string;
  projectId: string;
}
export interface CreateDataFeedRequest {
  name: string;
  useCaseId: string;
}
export interface CreatePluginRequest {
  name: string;
  slot: PluginSlotType;
  code?: string;
}
