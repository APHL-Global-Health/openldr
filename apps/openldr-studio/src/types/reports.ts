// ============================================================
// OpenLDR Reports — Shared API Types
// Used by both Express server (response shapes) and
// React client (fetch + rendering).
// Base URL: /api/v1/reports
// All GET endpoints accept: facility_id?, date_from, date_to
// ============================================================

// ── Antibiogram ─────────────────────────────────────────────
export interface AntibiogramRow {
  organism_code: string;
  organism_name: string;
  antibiotic_code: string;
  antibiotic_name: string;
  total_tested: number;
  resistant: number;
  intermediate: number;
  susceptible: number;
  resistance_pct: number;
}
export interface AntibiogramResponse {
  metadata: {
    facility: string;
    date_range: string;
    guideline: string;
    generated_at: string;
  };
  data: AntibiogramRow[];
}

// ── Priority Pathogens ───────────────────────────────────────
export type WhoPriority = "CRITICAL" | "HIGH" | "MEDIUM";
export interface PriorityTrendPoint {
  month: string;
  pct: number;
}
export interface Pathogen {
  who_priority: WhoPriority;
  organism_code: string;
  organism_name: string;
  full_name: string;
  total_isolates: number;
  key_resistance: string;
  trend: PriorityTrendPoint[];
}
export interface PriorityPathogensResponse {
  metadata: { date_range: string; guideline: string };
  pathogens: Pathogen[];
}

// ── AMR Surveillance ─────────────────────────────────────────
export interface MrsaTrendPoint {
  month: string;
  rate: number;
  icu: number;
  general: number;
  outpatient: number;
}
export interface CarbapenemTrendPoint {
  month: string;
  kpneu_cre: number;
  paeru_cr: number;
  abaum_cr: number;
}
export interface CarbapenemMechanism {
  mechanism: string;
  count: number;
  pct: number;
}
export interface EsblTrendPoint {
  month: string;
  ecoli: number;
  kpneu: number;
}
export interface SurveillanceResponse {
  metadata: { date_range: string };
  mrsa: {
    trend: MrsaTrendPoint[];
    by_facility: { facility: string; rate: number }[];
  };
  carbapenem: {
    trend: CarbapenemTrendPoint[];
    by_mechanism: CarbapenemMechanism[];
  };
  esbl: { trend: EsblTrendPoint[] };
}

// ── Workload & TAT ───────────────────────────────────────────
export interface MonthlyVolume {
  month: string;
  CH: number;
  MB: number;
  HM: number;
  SE: number;
  total: number;
}
export interface TatSection {
  section: string;
  code: string;
  p50: number;
  p90: number;
  target: number;
  unit: string;
}
export interface SpecimenType {
  name: string;
  value: number;
  color: string;
}
export interface WorkloadResponse {
  metadata: { date_range: string; facility: string };
  monthly_volumes: MonthlyVolume[];
  tat_by_section: TatSection[];
  specimen_type_dist: SpecimenType[];
}

// ── Geographic ───────────────────────────────────────────────
export interface FacilityGeo {
  facility_code: string;
  facility_name: string;
  region: string;
  district: string;
  total_isolates: number;
  mrsa_rate: number;
  cre_rate: number;
  esbl_rate: number;
  lat: number;
  lng: number;
}
export interface GeographicResponse {
  metadata: { date_range: string };
  facilities: FacilityGeo[];
}

// ── Data Quality ─────────────────────────────────────────────
export interface FacilityQuality {
  facility: string;
  batches: number;
  records: number;
  success_rate: number;
  completeness_demo: number;
  completeness_organism: number;
  completeness_ast: number;
  completeness_specimen: number;
}
export interface MonthlyIngestion {
  month: string;
  records: number;
  success_rate: number;
}
export interface DataQualityResponse {
  metadata: { date_range: string };
  summary: {
    total_batches: number;
    total_records: number;
    success_rate: number;
    facilities_active: number;
    last_import: string;
  };
  facilities: FacilityQuality[];
  monthly_ingestion: MonthlyIngestion[];
}

// ── Query params ─────────────────────────────────────────────
export interface ReportQuery {
  facility_id?: string;
  date_from: string; // ISO date e.g. "2025-01-01"
  date_to: string; // ISO date e.g. "2025-06-30"
  guideline?: "CLSI" | "EUCAST";
  min_isolates?: number;
}
