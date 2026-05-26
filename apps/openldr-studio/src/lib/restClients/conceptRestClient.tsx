const ENV = import.meta.env;

async function request<T>(
  token: string | undefined,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`${ENV.VITE_API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Coding Systems ──────────────────────────────────────────────────────

export interface CodingSystem {
  id: string;
  system_code: string;
  system_name: string;
  system_uri: string | null;
  system_version: string | null;
  system_type: string;
  description: string | null;
  owner: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  concept_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Concept {
  id: string;
  system_id: string;
  concept_code: string;
  display_name: string;
  concept_class: string | null;
  datatype: string | null;
  properties: Record<string, unknown> | null;
  names: { locale: string; name: string; name_type: string; preferred: boolean }[] | null;
  is_active: boolean;
  retired: boolean;
  replaced_by: string | null;
  system_code?: string;
  system_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ConceptMapping {
  id: string;
  from_concept_id: string;
  to_concept_id: string | null;
  to_system_code: string | null;
  to_concept_code: string | null;
  to_concept_name: string | null;
  map_type: string;
  relationship: string | null;
  owner: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  to_concept_display_name?: string;
  to_concept_code_resolved?: string;
  to_system_code_resolved?: string;
  from_concept_display_name?: string;
  from_concept_code?: string;
  from_system_code?: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Coding Systems

export async function getCodingSystems(
  token: string | undefined,
  filters?: { system_type?: string; is_active?: boolean; include_stats?: boolean },
) {
  const params = new URLSearchParams();
  if (filters?.system_type) params.set("system_type", filters.system_type);
  if (filters?.is_active !== undefined) params.set("is_active", String(filters.is_active));
  if (filters?.include_stats) params.set("include_stats", "true");
  const qs = params.toString();
  const resp = await request<ApiResponse<CodingSystem[]>>(
    token,
    "GET",
    `/api/v1/concepts/systems${qs ? `?${qs}` : ""}`,
  );
  return resp.data;
}

export async function getCodingSystem(token: string | undefined, id: string) {
  const resp = await request<ApiResponse<CodingSystem>>(
    token,
    "GET",
    `/api/v1/concepts/systems/${id}`,
  );
  return resp.data;
}

export async function getCodingSystemStats(token: string | undefined, id: string) {
  const resp = await request<ApiResponse<{ concept_count: number }>>(
    token,
    "GET",
    `/api/v1/concepts/systems/${id}/stats`,
  );
  return resp.data;
}

export async function createCodingSystem(
  token: string | undefined,
  data: Partial<CodingSystem>,
) {
  const resp = await request<ApiResponse<CodingSystem>>(
    token,
    "POST",
    "/api/v1/concepts/systems",
    data,
  );
  return resp.data;
}

export async function updateCodingSystem(
  token: string | undefined,
  id: string,
  data: Partial<CodingSystem>,
) {
  const resp = await request<ApiResponse<CodingSystem>>(
    token,
    "PUT",
    `/api/v1/concepts/systems/${id}`,
    data,
  );
  return resp.data;
}

export async function deleteCodingSystem(token: string | undefined, id: string, hard = false) {
  const resp = await request<ApiResponse<CodingSystem>>(
    token,
    "DELETE",
    `/api/v1/concepts/systems/${id}${hard ? "?hard=true" : ""}`,
  );
  return resp.data;
}

// Concepts

export async function getConcepts(
  token: string | undefined,
  systemId: string,
  opts?: { search?: string; concept_class?: string; is_active?: boolean; page?: number; limit?: number },
) {
  const params = new URLSearchParams();
  params.set("system_id", systemId);
  if (opts?.search) params.set("search", opts.search);
  if (opts?.concept_class) params.set("concept_class", opts.concept_class);
  if (opts?.is_active !== undefined) params.set("is_active", String(opts.is_active));
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.limit) params.set("limit", String(opts.limit));
  return request<PaginatedResponse<Concept>>(
    token,
    "GET",
    `/api/v1/concepts/concepts?${params.toString()}`,
  );
}

export async function searchConcepts(
  token: string | undefined,
  q: string,
  opts?: { system_id?: string; limit?: number },
) {
  const params = new URLSearchParams();
  params.set("q", q);
  if (opts?.system_id) params.set("system_id", opts.system_id);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const resp = await request<ApiResponse<Concept[]>>(
    token,
    "GET",
    `/api/v1/concepts/concepts/search?${params.toString()}`,
  );
  return resp.data;
}

export async function getConcept(token: string | undefined, id: string) {
  const resp = await request<ApiResponse<Concept>>(
    token,
    "GET",
    `/api/v1/concepts/concepts/${id}`,
  );
  return resp.data;
}

export async function getConceptClasses(token: string | undefined, systemId: string) {
  const resp = await request<ApiResponse<string[]>>(
    token,
    "GET",
    `/api/v1/concepts/concepts/classes/${systemId}`,
  );
  return resp.data;
}

export async function createConcept(
  token: string | undefined,
  data: Partial<Concept>,
) {
  const resp = await request<ApiResponse<Concept>>(
    token,
    "POST",
    "/api/v1/concepts/concepts",
    data,
  );
  return resp.data;
}

export async function updateConcept(
  token: string | undefined,
  id: string,
  data: Partial<Concept>,
) {
  const resp = await request<ApiResponse<Concept>>(
    token,
    "PUT",
    `/api/v1/concepts/concepts/${id}`,
    data,
  );
  return resp.data;
}

export async function deleteConcept(token: string | undefined, id: string, hard = false) {
  const resp = await request<ApiResponse<Concept>>(
    token,
    "DELETE",
    `/api/v1/concepts/concepts/${id}${hard ? "?hard=true" : ""}`,
  );
  return resp.data;
}

// Mappings

export async function getConceptMappings(token: string | undefined, conceptId: string) {
  const resp = await request<ApiResponse<{ from: ConceptMapping[]; to: ConceptMapping[] }>>(
    token,
    "GET",
    `/api/v1/concepts/concepts/${conceptId}/mappings`,
  );
  return resp.data;
}

export async function createConceptMapping(
  token: string | undefined,
  data: Partial<ConceptMapping>,
) {
  const resp = await request<ApiResponse<ConceptMapping>>(
    token,
    "POST",
    "/api/v1/concepts/mappings",
    data,
  );
  return resp.data;
}

export async function updateConceptMapping(
  token: string | undefined,
  id: string,
  data: Partial<ConceptMapping>,
) {
  const resp = await request<ApiResponse<ConceptMapping>>(
    token,
    "PUT",
    `/api/v1/concepts/mappings/${id}`,
    data,
  );
  return resp.data;
}

export async function deleteConceptMapping(token: string | undefined, id: string) {
  const resp = await request<ApiResponse<ConceptMapping>>(
    token,
    "DELETE",
    `/api/v1/concepts/mappings/${id}`,
  );
  return resp.data;
}
