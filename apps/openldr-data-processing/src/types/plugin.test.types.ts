export type PluginStatus = "active" | "draft" | "inactive" | "deprecated";
export type PluginSecurityLevel = "low" | "medium" | "high";
export type PluginSlotType = "validation" | "mapping" | "outpost" | "storage";

// ── Domain entities ───────────────────────────────────────────────────────────

export interface Project {
  projectId: string;
  projectName: string;
  description: string;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UseCase {
  useCaseId: string;
  projectId: string;
  useCaseName: string;
  description: string;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DataFeed {
  dataFeedId: string;
  useCaseId: string;
  dataFeedName: string;
  createdAt?: string;
  updatedAt?: string;
  schemaPluginId?: string;
  mapperPluginId?: string;
  storagePluginId?: string;
  outpostPluginId?: string;
}

export interface Plugin {
  pluginId: string;
  pluginName: string;
  pluginVersion: string;
  pluginType: PluginSlotType;
  config?: any;
  notes?: string;
  status: PluginStatus;
  securityLevel: PluginSecurityLevel;
  isBundled?: boolean;
  /** JavaScript source executed inside the VM */
  pluginMinioObjectPath: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DataFeedPluginAssignment {
  feedId: string;
  validationPluginId: string | null;
  mappingPluginId: string | null;
  storagePluginId: string | null;
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
  payload?: string; // raw payload string — optional when a binary file is uploaded via multipart
  contentType?: string; // MIME type hint (defaults to "application/json")
  validationPluginId?: string | null;
  mappingPluginId?: string | null;
  storagePluginId?: string | null;
  outpostPluginId?: string | null;
}

export interface RunPluginTestResponse {
  ok: boolean;
  stages: {
    validation?: ValidationStageResult;
    mapping?: MappingStageResult;
    storage?: MappingStageResult;
    outpost?: MappingStageResult;
  };
  /** True when every executed stage passed with no failures */
  allPassed: boolean;
  error?: string;
}

export interface SavePluginAssignmentRequest {
  feedId: string;
  validationPluginId: string | null;
  mappingPluginId: string | null;
  storagePluginId: string | null;
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
