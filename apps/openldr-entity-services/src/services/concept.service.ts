import {
  queryExternal,
  queryOneExternal,
  withTransactionExternal,
} from "../lib/db";

// ── Coding Systems ──────────────────────────────────────────────────────

interface CodingSystemFilters {
  system_type?: string;
  is_active?: boolean;
}

async function getCodingSystems(filters?: CodingSystemFilters) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters?.system_type) {
    conditions.push(`system_type = $${idx++}`);
    params.push(filters.system_type);
  }
  if (filters?.is_active !== undefined) {
    conditions.push(`is_active = $${idx++}`);
    params.push(filters.is_active);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return queryExternal(
    `SELECT * FROM coding_systems ${where} ORDER BY system_code`,
    params,
  );
}

async function getCodingSystemById(id: string) {
  return queryOneExternal(`SELECT * FROM coding_systems WHERE id = $1`, [id]);
}

async function getCodingSystemByCode(code: string) {
  return queryOneExternal(
    `SELECT * FROM coding_systems WHERE system_code = $1`,
    [code],
  );
}

async function getCodingSystemStats(id: string) {
  const row = await queryOneExternal<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM concepts WHERE system_id = $1`,
    [id],
  );
  return { concept_count: parseInt(row?.count ?? "0", 10) };
}

async function getCodingSystemsWithStats(filters?: CodingSystemFilters) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters?.system_type) {
    conditions.push(`cs.system_type = $${idx++}`);
    params.push(filters.system_type);
  }
  if (filters?.is_active !== undefined) {
    conditions.push(`cs.is_active = $${idx++}`);
    params.push(filters.is_active);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return queryExternal(
    `SELECT cs.*, COALESCE(c.cnt, 0)::int AS concept_count
     FROM coding_systems cs
     LEFT JOIN (SELECT system_id, COUNT(*) AS cnt FROM concepts GROUP BY system_id) c
       ON c.system_id = cs.id
     ${where}
     ORDER BY cs.system_code`,
    params,
  );
}

interface CreateCodingSystemData {
  system_code: string;
  system_name: string;
  system_uri?: string;
  system_version?: string;
  system_type?: string;
  description?: string;
  owner?: string;
  metadata?: Record<string, unknown>;
}

async function createCodingSystem(data: CreateCodingSystemData) {
  return queryOneExternal(
    `INSERT INTO coding_systems (id, system_code, system_name, system_uri, system_version, system_type, description, owner, metadata)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.system_code,
      data.system_name,
      data.system_uri ?? null,
      data.system_version ?? null,
      data.system_type ?? "local",
      data.description ?? null,
      data.owner ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ],
  );
}

async function updateCodingSystem(id: string, data: Partial<CreateCodingSystemData>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const mapping: Record<string, unknown> = {
    system_code: data.system_code,
    system_name: data.system_name,
    system_uri: data.system_uri,
    system_version: data.system_version,
    system_type: data.system_type,
    description: data.description,
    owner: data.owner,
    metadata: data.metadata !== undefined ? JSON.stringify(data.metadata) : undefined,
  };

  for (const [col, val] of Object.entries(mapping)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      params.push(val);
    }
  }

  if (fields.length === 0) return getCodingSystemById(id);

  fields.push(`updated_at = NOW()`);
  params.push(id);

  return queryOneExternal(
    `UPDATE coding_systems SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    params,
  );
}

async function deleteCodingSystem(id: string, hardDelete = false) {
  if (hardDelete) {
    await queryExternal(`DELETE FROM concept_mappings WHERE from_concept_id IN (SELECT id FROM concepts WHERE system_id = $1)`, [id]);
    await queryExternal(`DELETE FROM concepts WHERE system_id = $1`, [id]);
    return queryOneExternal(`DELETE FROM coding_systems WHERE id = $1 RETURNING *`, [id]);
  }
  return queryOneExternal(
    `UPDATE coding_systems SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id],
  );
}

// ── Concepts ────────────────────────────────────────────────────────────

interface ConceptListOpts {
  search?: string;
  concept_class?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

async function getConceptsBySystem(systemId: string, opts: ConceptListOpts = {}) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const offset = (page - 1) * limit;
  const conditions: string[] = ["c.system_id = $1"];
  const params: unknown[] = [systemId];
  let idx = 2;

  if (opts.search) {
    conditions.push(
      `(c.display_name ILIKE '%' || $${idx} || '%' OR c.concept_code ILIKE '%' || $${idx} || '%')`,
    );
    params.push(opts.search);
    idx++;
  }
  if (opts.concept_class) {
    conditions.push(`c.concept_class = $${idx++}`);
    params.push(opts.concept_class);
  }
  if (opts.is_active !== undefined) {
    conditions.push(`c.is_active = $${idx++}`);
    params.push(opts.is_active);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await queryOneExternal<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM concepts c ${where}`,
    params,
  );
  const total = parseInt(countResult?.count ?? "0", 10);

  const data = await queryExternal(
    `SELECT c.* FROM concepts c ${where}
     ORDER BY c.concept_code
     LIMIT $${idx++} OFFSET $${idx}`,
    [...params, limit, offset],
  );

  return { data, total, page, limit };
}

async function searchConcepts(
  q: string,
  opts?: { system_id?: string; limit?: number },
) {
  const limit = opts?.limit ?? 20;
  const params: unknown[] = [q, `%${q}%`, limit];

  let systemFilter = "";
  if (opts?.system_id) {
    systemFilter = "AND c.system_id = $4";
    params.push(opts.system_id);
  }

  return queryExternal(
    `SELECT c.*, cs.system_code, cs.system_name
     FROM concepts c
     JOIN coding_systems cs ON cs.id = c.system_id
     WHERE (c.display_name ILIKE $2 OR c.concept_code ILIKE $2) ${systemFilter}
     ORDER BY
       CASE WHEN c.concept_code ILIKE $2 THEN 0 ELSE 1 END,
       c.display_name
     LIMIT $3`,
    params,
  );
}

async function getConceptById(id: string) {
  return queryOneExternal(
    `SELECT c.*, cs.system_code, cs.system_name
     FROM concepts c
     JOIN coding_systems cs ON cs.id = c.system_id
     WHERE c.id = $1`,
    [id],
  );
}

async function getConceptClasses(systemId: string) {
  const rows = await queryExternal<{ concept_class: string }>(
    `SELECT DISTINCT concept_class FROM concepts
     WHERE system_id = $1 AND concept_class IS NOT NULL
     ORDER BY concept_class`,
    [systemId],
  );
  return rows.map((r) => r.concept_class);
}

interface CreateConceptData {
  system_id: string;
  concept_code: string;
  display_name: string;
  concept_class?: string;
  datatype?: string;
  properties?: Record<string, unknown>;
  names?: unknown[];
  is_active?: boolean;
}

async function createConcept(data: CreateConceptData) {
  return queryOneExternal(
    `INSERT INTO concepts (id, system_id, concept_code, display_name, concept_class, datatype, properties, names, is_active)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.system_id,
      data.concept_code,
      data.display_name,
      data.concept_class ?? null,
      data.datatype ?? null,
      data.properties ? JSON.stringify(data.properties) : null,
      data.names ? JSON.stringify(data.names) : null,
      data.is_active ?? true,
    ],
  );
}

async function updateConcept(id: string, data: Partial<CreateConceptData> & { retired?: boolean; replaced_by?: string }) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const mapping: Record<string, unknown> = {
    system_id: data.system_id,
    concept_code: data.concept_code,
    display_name: data.display_name,
    concept_class: data.concept_class,
    datatype: data.datatype,
    properties: data.properties !== undefined ? JSON.stringify(data.properties) : undefined,
    names: data.names !== undefined ? JSON.stringify(data.names) : undefined,
    is_active: data.is_active,
    retired: data.retired,
    replaced_by: data.replaced_by,
  };

  for (const [col, val] of Object.entries(mapping)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      params.push(val);
    }
  }

  if (fields.length === 0) return getConceptById(id);

  fields.push(`updated_at = NOW()`);
  params.push(id);

  return queryOneExternal(
    `UPDATE concepts SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    params,
  );
}

async function deleteConcept(id: string, hardDelete = false) {
  if (hardDelete) {
    await queryExternal(`DELETE FROM concept_mappings WHERE from_concept_id = $1 OR to_concept_id = $1`, [id]);
    return queryOneExternal(`DELETE FROM concepts WHERE id = $1 RETURNING *`, [id]);
  }
  return queryOneExternal(
    `UPDATE concepts SET is_active = false, retired = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id],
  );
}

async function bulkCreateConcepts(systemId: string, concepts: Omit<CreateConceptData, "system_id">[]) {
  return withTransactionExternal(async (client) => {
    const results = [];
    for (const c of concepts) {
      const { rows } = await client.query(
        `INSERT INTO concepts (id, system_id, concept_code, display_name, concept_class, datatype, properties, names, is_active)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (system_id, concept_code) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           concept_class = EXCLUDED.concept_class,
           datatype = EXCLUDED.datatype,
           properties = EXCLUDED.properties,
           names = EXCLUDED.names,
           updated_at = NOW()
         RETURNING *`,
        [
          systemId,
          c.concept_code,
          c.display_name,
          c.concept_class ?? null,
          c.datatype ?? null,
          c.properties ? JSON.stringify(c.properties) : null,
          c.names ? JSON.stringify(c.names) : null,
          c.is_active ?? true,
        ],
      );
      results.push(rows[0]);
    }
    return results;
  });
}

// ── Concept Mappings ────────────────────────────────────────────────────

async function getMappingsByConceptId(conceptId: string) {
  return queryExternal(
    `SELECT cm.*,
       tc.display_name AS to_concept_display_name,
       tc.concept_code AS to_concept_code_resolved,
       tcs.system_code AS to_system_code_resolved
     FROM concept_mappings cm
     LEFT JOIN concepts tc ON tc.id = cm.to_concept_id
     LEFT JOIN coding_systems tcs ON tcs.id = tc.system_id
     WHERE cm.from_concept_id = $1
     ORDER BY cm.map_type, cm.to_system_code`,
    [conceptId],
  );
}

async function getMappingsToConceptId(conceptId: string) {
  return queryExternal(
    `SELECT cm.*,
       fc.display_name AS from_concept_display_name,
       fc.concept_code AS from_concept_code,
       fcs.system_code AS from_system_code
     FROM concept_mappings cm
     JOIN concepts fc ON fc.id = cm.from_concept_id
     JOIN coding_systems fcs ON fcs.id = fc.system_id
     WHERE cm.to_concept_id = $1
     ORDER BY cm.map_type`,
    [conceptId],
  );
}

interface CreateMappingData {
  from_concept_id: string;
  to_concept_id?: string;
  to_system_code?: string;
  to_concept_code?: string;
  to_concept_name?: string;
  map_type: string;
  relationship?: string;
  owner?: string;
  metadata?: Record<string, unknown>;
}

async function createMapping(data: CreateMappingData) {
  return queryOneExternal(
    `INSERT INTO concept_mappings (id, from_concept_id, to_concept_id, to_system_code, to_concept_code, to_concept_name, map_type, relationship, owner, metadata)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.from_concept_id,
      data.to_concept_id ?? null,
      data.to_system_code ?? null,
      data.to_concept_code ?? null,
      data.to_concept_name ?? null,
      data.map_type,
      data.relationship ?? null,
      data.owner ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ],
  );
}

async function updateMapping(id: string, data: Partial<CreateMappingData>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const mapping: Record<string, unknown> = {
    from_concept_id: data.from_concept_id,
    to_concept_id: data.to_concept_id,
    to_system_code: data.to_system_code,
    to_concept_code: data.to_concept_code,
    to_concept_name: data.to_concept_name,
    map_type: data.map_type,
    relationship: data.relationship,
    owner: data.owner,
    metadata: data.metadata !== undefined ? JSON.stringify(data.metadata) : undefined,
  };

  for (const [col, val] of Object.entries(mapping)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      params.push(val);
    }
  }

  if (fields.length === 0) return queryOneExternal(`SELECT * FROM concept_mappings WHERE id = $1`, [id]);

  fields.push(`updated_at = NOW()`);
  params.push(id);

  return queryOneExternal(
    `UPDATE concept_mappings SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    params,
  );
}

async function deleteMapping(id: string) {
  return queryOneExternal(
    `DELETE FROM concept_mappings WHERE id = $1 RETURNING *`,
    [id],
  );
}

export {
  getCodingSystems,
  getCodingSystemById,
  getCodingSystemByCode,
  getCodingSystemStats,
  getCodingSystemsWithStats,
  createCodingSystem,
  updateCodingSystem,
  deleteCodingSystem,
  getConceptsBySystem,
  searchConcepts,
  getConceptById,
  getConceptClasses,
  createConcept,
  updateConcept,
  deleteConcept,
  bulkCreateConcepts,
  getMappingsByConceptId,
  getMappingsToConceptId,
  createMapping,
  updateMapping,
  deleteMapping,
};
