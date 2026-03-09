// ─────────────────────────────────────────────────────────────────────────────
//
// Lightweight in-memory store used during development so the test harness works
// without a running PostgreSQL instance.
// Replace each exported function with your actual Sequelize model calls.
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuid } from "uuid";
import type {
  Project,
  UseCase,
  DataFeed,
  Plugin,
  DataFeedPluginAssignment,
  PluginSlotType,
} from "@/types/plugin.test.types";

import { pool } from "../lib/db";
import { logger } from "../lib/logger";

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_VALIDATION_CODE = `
async function run(payload) {
  const checks = [];
  let passed = true;

  // Rule: patient_id must be present
  if (!payload.patient_id) {
    checks.push({ rule: 'patient_id_present', status: 'fail', message: 'patient_id is required' });
    passed = false;
  } else {
    checks.push({ rule: 'patient_id_present', status: 'pass', message: 'patient_id found' });
  }

  // Rule: SIR value must be S, I, or R
  const validSIR = ['S', 'I', 'R'];
  if (payload.sir && !validSIR.includes(payload.sir)) {
    checks.push({ rule: 'sir_value', status: 'fail', message: 'SIR must be S, I or R — got: ' + payload.sir });
    passed = false;
  } else if (payload.sir) {
    checks.push({ rule: 'sir_value', status: 'pass', message: 'SIR value "' + payload.sir + '" is valid' });
  }

  // Rule: MIC boundary warning
  if (typeof payload.mic === 'number' && payload.mic >= 8) {
    checks.push({ rule: 'mic_range', status: 'warn', message: 'MIC ' + payload.mic + ' is at or above upper surveillance boundary' });
  } else if (payload.mic !== undefined) {
    checks.push({ rule: 'mic_range', status: 'pass', message: 'MIC within expected range' });
  }

  // Rule: sample_date ISO format
  if (payload.sample_date && !/^\d{4}-\d{2}-\d{2}/.test(payload.sample_date)) {
    checks.push({ rule: 'date_format', status: 'fail', message: 'sample_date must be ISO 8601 (YYYY-MM-DD)' });
    passed = false;
  } else if (payload.sample_date) {
    checks.push({ rule: 'date_format', status: 'pass', message: 'ISO 8601 date confirmed' });
  }

  const output = {
    ...payload,
    _validated: passed,
    _validation_ts: new Date().toISOString(),
  };

  return { passed, checks, output };
}
`;

const SEED_MAPPING_CODE = `
async function run(payload) {
  const output = {
    resourceType: 'Observation',
    id: 'amr-obs-' + (payload.patient_id || 'unknown') + '-' + (payload.antibiotic || 'UNK'),
    status: 'final',
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '29576-4',
        display: (payload.antibiotic || 'Antibiotic') + ' MIC',
      }],
    },
    subject: { reference: 'Patient/' + payload.patient_id },
    valueQuantity: {
      value: payload.mic,
      unit: 'mg/L',
      system: 'http://unitsofmeasure.org',
      code: 'mg/L',
    },
    interpretation: [{
      coding: [{
        system: 'http://hl7.org/fhir/v2/0078',
        code: payload.sir,
        display: payload.sir === 'R' ? 'Resistant' : payload.sir === 'S' ? 'Susceptible' : 'Intermediate',
      }],
    }],
    effectiveDateTime: payload.sample_date,
    component: payload.ward
      ? [{ code: { text: 'Ward' }, valueString: payload.ward }]
      : [],
  };
  return { output };
}
`;

// ── In-memory tables ──────────────────────────────────────────────────────────

const projects: Project[] = [
  {
    id: "p1",
    name: "KCMC AMR Surveillance",
    createdAt: new Date().toISOString(),
  },
  { id: "p2", name: "MNH Lab Network", createdAt: new Date().toISOString() },
];

const useCases: UseCase[] = [
  {
    id: "uc1",
    projectId: "p1",
    name: "WHONET Lab Ingestion",
    createdAt: new Date().toISOString(),
  },
  {
    id: "uc2",
    projectId: "p1",
    name: "Blood Culture Workflow",
    createdAt: new Date().toISOString(),
  },
  {
    id: "uc3",
    projectId: "p2",
    name: "Referral Lab Sync",
    createdAt: new Date().toISOString(),
  },
];

const dataFeeds: DataFeed[] = [
  {
    id: "df1",
    useCaseId: "uc1",
    name: "WHONET SQLite Feed",
    createdAt: new Date().toISOString(),
  },
  {
    id: "df2",
    useCaseId: "uc1",
    name: "HL7 v2 Feed",
    createdAt: new Date().toISOString(),
  },
  {
    id: "df3",
    useCaseId: "uc2",
    name: "BacT/Alert Feed",
    createdAt: new Date().toISOString(),
  },
];

const plugins: Plugin[] = [
  {
    id: "v1",
    name: "WHONET Schema Validator",
    version: "1.2.0",
    status: "active",
    slot: "validation",
    code: SEED_VALIDATION_CODE,
  },
  {
    id: "v2",
    name: "SIR Range Checker",
    version: "0.9.1",
    status: "active",
    slot: "validation",
    code: SEED_VALIDATION_CODE,
  },
  {
    id: "m1",
    name: "WHONET → FHIR Mapper",
    version: "2.1.3",
    status: "active",
    slot: "mapping",
    code: SEED_MAPPING_CODE,
  },
  {
    id: "m2",
    name: "AMR Code Normalizer",
    version: "1.4.0",
    status: "active",
    slot: "mapping",
    code: SEED_MAPPING_CODE,
  },
  {
    id: "o1",
    name: "GLASS Reporter",
    version: "1.0.0",
    status: "active",
    slot: "outpost",
    code: "// outpost",
  },
  {
    id: "o2",
    name: "OpenSearch Indexer",
    version: "2.0.1",
    status: "active",
    slot: "outpost",
    code: "// outpost",
  },
];

const assignments: DataFeedPluginAssignment[] = [];

// ── Query helpers (swap these out for Sequelize model calls) ──────────────────

export const db = {
  // Projects
  getProjects: async (): Promise<Project[]> => {
    try {
      const sql = `
        SELECT "projectId", "projectName", "createdAt"
        FROM "projects"
    `;
      const res = await pool.query(sql);
      return res.rows.map((r) => ({
        id: r.projectId,
        name: r.projectName,
        createdAt: r.createdAt,
      }));
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
  },
  getProject: async (id: string): Promise<Project | null> => {
    try {
      const sql = `
        SELECT "projectId", "projectName", "createdAt"
        FROM "projects"
        WHERE "projectId" = $1;
    `;
      const res = await pool.query(sql, [id]);
      if (res.rowCount == 1) {
        return {
          id: res.rows[0].projectId,
          name: res.rows[0].projectName,
          createdAt: res.rows[0].createdAt,
        };
      }

      return null;
    } catch (error: any) {
      logger.error(
        { error: error.message, stack: error.stack },
        "Database query error",
      );
      throw error;
    }
  },
  createProject(name: string): Project {
    const p: Project = {
      id: uuid(),
      name,
      createdAt: new Date().toISOString(),
    };
    projects.push(p);
    return p;
  },

  // Use cases
  getUseCases: (projectId: string): UseCase[] =>
    useCases.filter((u) => u.projectId === projectId),
  createUseCase(name: string, projectId: string): UseCase {
    const u: UseCase = {
      id: uuid(),
      projectId,
      name,
      createdAt: new Date().toISOString(),
    };
    useCases.push(u);
    return u;
  },

  // Data feeds
  getDataFeeds: (useCaseId: string): DataFeed[] =>
    dataFeeds.filter((f) => f.useCaseId === useCaseId),
  createDataFeed(name: string, useCaseId: string): DataFeed {
    const f: DataFeed = {
      id: uuid(),
      useCaseId,
      name,
      createdAt: new Date().toISOString(),
    };
    dataFeeds.push(f);
    return f;
  },

  // Plugins
  getPlugins: (slot: PluginSlotType): Plugin[] =>
    plugins.filter((p) => p.slot === slot),
  getPluginById: (id: string) => plugins.find((p) => p.id === id),
  createPlugin(
    name: string,
    slot: PluginSlotType,
    code = "// TODO: implement run()\nasync function run(payload) {\n  return { output: payload };\n}",
  ): Plugin {
    const p: Plugin = {
      id: uuid(),
      name,
      version: "0.1.0",
      status: "draft",
      slot,
      code,
    };
    plugins.push(p);
    return p;
  },

  // Assignments
  getAssignment: (feedId: string) =>
    assignments.find((a) => a.feedId === feedId) ?? null,
  upsertAssignment(a: DataFeedPluginAssignment): DataFeedPluginAssignment {
    const idx = assignments.findIndex((x) => x.feedId === a.feedId);
    if (idx >= 0) assignments[idx] = a;
    else assignments.push(a);
    return a;
  },
};
