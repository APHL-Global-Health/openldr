// AMR Report Types

export interface DateRange {
  from: string;
  to: string;
}

export interface ReportFilters {
  organism?: string;
  specimenType?: string;
  institution?: string;
  wardType?: string;
  country?: string;
}

export interface ResistanceMetrics {
  totalIsolates: number;
  overallResistanceRate: number;
  resistanceTrend: number;
  mdrCount: number;
  mdrPercentage: number;
  uniqueOrganisms: number;
  dateRange: string;
}

export interface ResistanceByClass {
  class: string;
  antibiotics: string[];
  tested: number;
  resistant: number;
  resistanceRate: number;
  susceptible: number;
  intermediate: number;
}

export interface TopResistantOrganism {
  organism: string;
  organismName: string;
  count: number;
  resistanceRate: number;
  mdrRate: number;
  topResistantTo: string[];
}

export interface AntibioticProfile {
  antibiotic: string;
  antibioticClass: string;
  tested: number;
  susceptible: number;
  intermediate: number;
  resistant: number;
  susceptibilityRate: number;
  resistanceRate: number;
}

export interface TrendDataPoint {
  period: string;
  date: string;
  resistanceRate: number;
  isolateCount: number;
  mdrRate: number;
}

export interface GeographicData {
  location: string;
  country: string;
  institution?: string;
  isolateCount: number;
  resistanceRate: number;
  mdrCount: number;
  topOrganisms: Array<{
    organism: string;
    count: number;
  }>;
}

export interface SpecimenTypeData {
  specimenType: string;
  specimenName: string;
  isolateCount: number;
  resistanceRate: number;
  topOrganisms: Array<{
    organism: string;
    count: number;
    resistanceRate: number;
  }>;
}

export interface ResistanceOverviewData {
  metrics: ResistanceMetrics;
  resistanceByClass: ResistanceByClass[];
  topResistantOrganisms: TopResistantOrganism[];
  recentAlerts: Array<{
    type: "high_resistance" | "mdr_increase" | "new_organism";
    message: string;
    severity: "high" | "medium" | "low";
    timestamp: string;
  }>;
}

export interface AntibioticSusceptibilityData {
  antibioticProfiles: AntibioticProfile[];
  classSummary: Array<{
    class: string;
    averageSusceptibility: number;
    antibioticCount: number;
  }>;
}

export interface OrganismDistributionData {
  topOrganisms: Array<{
    organism: string;
    organismName: string;
    count: number;
    percentage: number;
    resistanceProfile: Array<{
      antibiotic: string;
      resistanceRate: number;
    }>;
  }>;
  resistancePatterns: Array<{
    pattern: string;
    count: number;
    organisms: string[];
  }>;
}

export interface TrendAnalysisData {
  monthlyTrends: TrendDataPoint[];
  yearlyComparison: Array<{
    year: string;
    resistanceRate: number;
    isolateCount: number;
  }>;
  emergingThreats: Array<{
    organism: string;
    trend: number;
    currentRate: number;
    message: string;
  }>;
}

export type ReportType =
  | "overview"
  | "susceptibility"
  | "organisms"
  | "trends"
  | "geographic"
  | "specimen"
  | "amr-for-r";

export interface ReportConfig {
  id: ReportType;
  title: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
}
