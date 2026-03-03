import { externalPool } from "../lib/db.external";
import { logger } from "../lib/logger";

export async function getConceptsBySystem(systemCode: string): Promise<{
  concepts: Record<string, any>;
}> {
  const sql = `
    SELECT
      c.id          AS concept_id,
      c.concept_code,
      c.display_name,
      COALESCE(
        json_agg(
          json_build_object(
            'relationship',  cm.map_type,
            'externalId',    cm.id::text,
            'toConceptCode', COALESCE(tc.concept_code,  cm.to_concept_code),
            'toConceptName', COALESCE(tc.display_name,  cm.to_concept_name),
            'toSourceName',  COALESCE(tcs.system_code,  cm.to_system_code),
            'toSourceOwner', tcs.owner,
            'toSourceUrl',   tcs.system_uri
          ) ORDER BY cm.created_at
        ) FILTER (WHERE cm.id IS NOT NULL),
        '[]'::json
      ) AS mappings
    FROM concepts c
    JOIN  coding_systems cs  ON c.system_id          = cs.id
    LEFT JOIN concept_mappings cm  ON cm.from_concept_id = c.id  AND cm.is_active = true
    LEFT JOIN concepts tc           ON cm.to_concept_id   = tc.id
    LEFT JOIN coding_systems tcs    ON tc.system_id       = tcs.id
    WHERE cs.system_code = $1
      AND c.is_active    = true
      AND c.retired      = false
    GROUP BY c.id, c.concept_code, c.display_name
  `;

  try {
    const result = await externalPool.query(sql, [systemCode]);

    const concepts: Record<string, any> = {};
    for (const row of result.rows) {
      concepts[row.concept_code] = {
        concept: {
          id: row.concept_id,
          code: row.concept_code,
          name: row.display_name,
        },
        mappings: row.mappings ?? [],
      };
    }

    logger.info(
      { systemCode, count: result.rowCount },
      "Loaded concepts from openldr_external",
    );

    return { concepts };
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack, systemCode },
      "Failed to query concepts from openldr_external",
    );
    throw error;
  }
}

export async function getConceptsBySystemCodes(systemCodes: string[]): Promise<{
  bySystem: Record<string, Record<string, any>>;
}> {
  if (systemCodes.length === 0) {
    return { bySystem: {} };
  }

  const sql = `
    SELECT
      cs.system_code,
      c.id          AS concept_id,
      c.concept_code,
      c.display_name,
      COALESCE(
        json_agg(
          json_build_object(
            'relationship',  cm.map_type,
            'externalId',    cm.id::text,
            'toConceptCode', COALESCE(tc.concept_code,  cm.to_concept_code),
            'toConceptName', COALESCE(tc.display_name,  cm.to_concept_name),
            'toSourceName',  COALESCE(tcs.system_code,  cm.to_system_code),
            'toSourceOwner', tcs.owner,
            'toSourceUrl',   tcs.system_uri
          ) ORDER BY cm.created_at
        ) FILTER (WHERE cm.id IS NOT NULL),
        '[]'::json
      ) AS mappings
    FROM concepts c
    JOIN  coding_systems cs     ON c.system_id          = cs.id
    LEFT JOIN concept_mappings cm  ON cm.from_concept_id = c.id  AND cm.is_active = true
    LEFT JOIN concepts tc           ON cm.to_concept_id   = tc.id
    LEFT JOIN coding_systems tcs    ON tc.system_id       = tcs.id
    WHERE cs.system_code = ANY($1)
      AND c.is_active    = true
      AND c.retired      = false
    GROUP BY cs.system_code, c.id, c.concept_code, c.display_name
  `;

  try {
    const result = await externalPool.query(sql, [systemCodes]);

    const bySystem: Record<string, Record<string, any>> = {};
    for (const row of result.rows) {
      if (!bySystem[row.system_code]) {
        bySystem[row.system_code] = {};
      }
      bySystem[row.system_code][row.concept_code] = {
        concept: {
          id: row.concept_id,
          code: row.concept_code,
          name: row.display_name,
        },
        mappings: row.mappings ?? [],
      };
    }

    const counts = Object.fromEntries(
      Object.entries(bySystem).map(([sys, concepts]) => [
        sys,
        Object.keys(concepts).length,
      ]),
    );
    logger.info(
      { systemCodes, counts },
      "Loaded concepts by system codes from openldr_external",
    );

    return { bySystem };
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack, systemCodes },
      "Failed to batch query concepts from openldr_external",
    );
    throw error;
  }
}

function normalizeConceptCode(value: any) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeConceptDisplayName(reference: any) {
  const rawDisplayName = String(reference?.display_name || "")
    .replace(/\s+/g, " ")
    .trim();
  const fallbackCode = normalizeConceptCode(
    reference?.concept_code || "UNKNOWN",
  );

  if (!rawDisplayName) {
    return fallbackCode;
  }

  if (/^[^A-Za-z0-9]*$/.test(rawDisplayName)) {
    return fallbackCode;
  }

  const suspiciousFragments = new Set(["arks", "ment", "ts", "us Threads"]);
  if (suspiciousFragments.has(rawDisplayName)) {
    return fallbackCode;
  }

  return rawDisplayName;
}

function normalizeConceptProperties(reference: any) {
  const properties =
    reference?.properties && typeof reference.properties === "object"
      ? { ...reference.properties }
      : {};

  if (reference?.display_name) {
    properties.source_display_name = String(reference.display_name);
  }

  return properties;
}

export async function getCodingSystemsByCodes(systemCodes: string[]) {
  if (systemCodes.length === 0) {
    return {} as Record<string, any>;
  }

  const sql = `
    SELECT id, system_code, system_name, system_uri, system_version, system_type, is_active
    FROM coding_systems
    WHERE system_code = ANY($1)
      AND is_active = true
  `;

  const result = await externalPool.query(sql, [systemCodes]);
  const byCode: Record<string, any> = {};
  for (const row of result.rows) {
    byCode[row.system_code] = row;
  }
  return byCode;
}

export async function assertCodingSystemsExist(systemCodes: string[]) {
  const uniqueCodes = [...new Set(systemCodes.filter(Boolean))];
  const byCode = await getCodingSystemsByCodes(uniqueCodes);
  const missing = uniqueCodes.filter((code) => !byCode[code]);
  if (missing.length > 0) {
    throw new Error(`Unknown coding system(s): ${missing.join(", ")}`);
  }
  return byCode;
}

export function isConceptReference(value: any) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof value.system_id === "string" &&
      typeof value.concept_code === "string" &&
      typeof value.display_name === "string",
  );
}

export function collectConceptReferences(
  value: any,
  currentPath = "$",
  results: Array<{ path: string; key: string; reference: any }> = [],
) {
  if (!value || typeof value !== "object") {
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectConceptReferences(item, `${currentPath}[${index}]`, results),
    );
    return results;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}.${key}`;
    if (key.endsWith("_code") && isConceptReference(child)) {
      results.push({ path: childPath, key, reference: child });
    } else if (child && typeof child === "object") {
      collectConceptReferences(child, childPath, results);
    }
  }

  return results;
}

export async function resolveOrCreateConceptRef(reference: any) {
  const systemCode = reference.system_id;
  const conceptCode = normalizeConceptCode(reference.concept_code);
  const displayName = normalizeConceptDisplayName(reference);
  const normalizedProperties = normalizeConceptProperties(reference);

  const systems = await assertCodingSystemsExist([systemCode]);
  const system = systems[systemCode];

  const existingSql = `
    SELECT id, concept_code, display_name, concept_class, datatype, properties
    FROM concepts
    WHERE system_id = $1
      AND concept_code = $2
      AND is_active = true
      AND retired = false
    LIMIT 1
  `;

  const existing = await externalPool.query(existingSql, [
    system.id,
    conceptCode,
  ]);
  if (existing.rowCount === 1) {
    return {
      created: false,
      system,
      concept: existing.rows[0],
    };
  }

  const insertSql = `
    INSERT INTO concepts (
      system_id,
      concept_code,
      display_name,
      concept_class,
      datatype,
      properties,
      names,
      is_active,
      retired
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6::jsonb,
      $7::jsonb,
      true,
      false
    )
    ON CONFLICT (system_id, concept_code)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      concept_class = COALESCE(concepts.concept_class, EXCLUDED.concept_class),
      datatype = COALESCE(concepts.datatype, EXCLUDED.datatype),
      properties = CASE
        WHEN concepts.properties IS NULL OR concepts.properties = '{}'::jsonb THEN EXCLUDED.properties
        ELSE concepts.properties
      END,
      updated_at = NOW()
    RETURNING id, concept_code, display_name, concept_class, datatype, properties
  `;

  const names = JSON.stringify([
    {
      locale: "en",
      name: displayName,
      name_type: "fully_specified",
      preferred: true,
    },
  ]);

  const inserted = await externalPool.query(insertSql, [
    system.id,
    conceptCode,
    displayName,
    reference.concept_class || null,
    reference.datatype || null,
    JSON.stringify(normalizedProperties),
    names,
  ]);

  return {
    created: true,
    system,
    concept: inserted.rows[0],
  };
}

export async function resolveConceptReferencesInMessage(message: any) {
  const conceptReferences = collectConceptReferences(message);
  if (conceptReferences.length === 0) {
    return message;
  }

  const systemCodes = conceptReferences.map(
    ({ reference }) => reference.system_id,
  );
  await assertCodingSystemsExist(systemCodes);

  async function transform(value: any): Promise<any> {
    if (Array.isArray(value)) {
      const mapped = [];
      for (const item of value) {
        mapped.push(await transform(item));
      }
      return mapped;
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    const output: Record<string, any> = {};
    const resolutions: any[] = [];

    for (const [key, child] of Object.entries(value)) {
      if (key.endsWith("_code") && isConceptReference(child)) {
        const resolved = await resolveOrCreateConceptRef(child);
        const targetKey = key.replace(/_code$/, "_concept_id");
        output[targetKey] = resolved.concept.id;
        resolutions.push({
          source_field: key,
          target_field: targetKey,
          concept_id: resolved.concept.id,
          system_id: (child as any).system_id,
          concept_code: (child as any).concept_code,
          display_name: (child as any).display_name,
          created: resolved.created,
        });
        continue;
      }

      output[key] = await transform(child);
    }

    if (resolutions.length > 0) {
      output._resolved_concepts = [
        ...(Array.isArray((value as any)._resolved_concepts)
          ? (value as any)._resolved_concepts
          : []),
        ...resolutions,
      ];
    }

    return output;
  }

  const transformed = await transform(message);
  const flatResolutions = collectResolvedConcepts(transformed);
  transformed._mapping_results = {
    resolved: flatResolutions.length,
    created: flatResolutions.filter((item) => item.created).length,
    reused: flatResolutions.filter((item) => !item.created).length,
  };
  return transformed;
}

function collectResolvedConcepts(value: any, results: any[] = []) {
  if (!value || typeof value !== "object") {
    return results;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectResolvedConcepts(item, results));
    return results;
  }
  if (Array.isArray((value as any)._resolved_concepts)) {
    results.push(...(value as any)._resolved_concepts);
  }
  Object.values(value).forEach((child) =>
    collectResolvedConcepts(child, results),
  );
  return results;
}
