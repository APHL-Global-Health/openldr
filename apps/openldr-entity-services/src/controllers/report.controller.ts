import { Router, type Request, type Response } from "express";
import { externalPool } from "../lib/db";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse and validate common query params */
function parseQuery(req: Request) {
  const {
    facility_id,
    date_from = "2025-01-01",
    date_to = "2025-06-30",
    guideline,
    min_isolates,
  } = req.query as Record<string, string | undefined>;

  return {
    facility_id: facility_id ?? null,
    date_from,
    date_to,
    guideline: guideline ?? null,
    min_isolates: min_isolates ? parseInt(min_isolates, 10) : 30,
  };
}

function send<T>(res: Response, data: T) {
  res.setHeader("Cache-Control", "no-store");
  res.json(data);
}

function handleError(res: Response, err: unknown, label: string) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${label}]`, msg);
  res.status(500).json({ error: msg });
}

/**
 * Match "positive" free-text values in mrsa_screen / esbl / carbapenemase.
 * WHONET exports use formats like: +, POS, POSITIVE, DETECTED, YES, MRSA,
 * KPC, NDM, OXA-48, VIM, IMP …
 * The negative guard prevents false-positives on values like "not detected".
 */
function posFlag(col: string) {
  return `(
    ${col} IS NOT NULL
    AND ${col} !~* '^\\s*(neg|no|not|absent|none|nd|0|-)\\s*$'
    AND ${col} ~*  '(\\+|pos|detect|present|yes|true|mrsa|esbl|kpc|ndm|oxa|vim|imp)'
  )`;
}

/**
 * Return ordered 3-letter month abbreviations spanning two ISO dates.
 * e.g. ("2025-01-01", "2025-06-30") → ["Jan","Feb","Mar","Apr","May","Jun"]
 */
function monthsInRange(dateFrom: string, dateTo: string): string[] {
  const months: string[] = [];
  const cur = new Date(
    parseInt(dateFrom.slice(0, 4)),
    parseInt(dateFrom.slice(5, 7)) - 1,
    1,
  );
  const end = new Date(dateTo);
  while (cur <= end) {
    months.push(cur.toLocaleString("en-US", { month: "short" }));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

// WHO priority organism metadata
const WHO_ORGANISMS: Record<
  string,
  {
    priority: "CRITICAL" | "HIGH" | "MEDIUM";
    full_name: string;
    key_abx: string[];
  }
> = {
  ABAUM: {
    priority: "CRITICAL",
    full_name: "Acinetobacter baumannii",
    key_abx: ["MEM", "IPM"],
  },
  KPNEU: {
    priority: "CRITICAL",
    full_name: "Klebsiella pneumoniae",
    key_abx: ["MEM", "IPM"],
  },
  PAERU: {
    priority: "CRITICAL",
    full_name: "Pseudomonas aeruginosa",
    key_abx: ["MEM", "IPM"],
  },
  SAURE: {
    priority: "HIGH",
    full_name: "Staphylococcus aureus",
    key_abx: ["OXA", "MET"],
  },
  ECOLI: {
    priority: "HIGH",
    full_name: "Escherichia coli",
    key_abx: ["CTX", "CAZ", "CXM"],
  },
  EFAEC: {
    priority: "HIGH",
    full_name: "Enterococcus faecium",
    key_abx: ["VAN"],
  },
};

// Section code → display label + TAT target hours
const SECTION_META: Record<string, { label: string; target: number }> = {
  CH: { label: "Chemistry", target: 6 },
  HM: { label: "Haematology", target: 4 },
  MB: { label: "Microbiology", target: 48 },
  SE: { label: "Serology", target: 8 },
  IM: { label: "Immunology", target: 12 },
};

// ── GET /api/v1/reports/antibiogram ──────────────────────────────────────────
//
// Parameterised version of vw_resistance_rates: adds facility filter,
// date window, guideline selection, and minimum-isolates threshold.
// WHO GLASS recommends ≥30 isolates per organism-antibiotic cell.
//
router.get("/antibiogram", async (req: Request, res: Response) => {
  const q = parseQuery(req);
  console.log("[antibiogram]", q);

  try {
    const facilityName = q.facility_id
      ? await externalPool
          .query<{ facility_name: string }>(
            "SELECT facility_name FROM facilities WHERE id = $1",
            [q.facility_id],
          )
          .then((r) => r.rows[0]?.facility_name ?? "Unknown Facility")
      : "All Facilities";

    const { rows } = await externalPool.query(
      `
      SELECT
        i.organism_code,
        COALESCE(oc.display_name, i.organism_name, i.organism_code)      AS organism_name,
        st.antibiotic_code,
        COALESCE(ac.display_name, st.antibiotic_name, st.antibiotic_code) AS antibiotic_name,
        COALESCE(st.guideline, 'Unknown')                                 AS guideline,
        COUNT(*)                                                           AS total_tested,
        COUNT(*) FILTER (WHERE st.interpretation = 'R')                   AS resistant,
        COUNT(*) FILTER (WHERE st.interpretation = 'I')                   AS intermediate,
        COUNT(*) FILTER (WHERE st.interpretation = 'S')                   AS susceptible,
        ROUND(
          COUNT(*) FILTER (WHERE st.interpretation = 'R') * 100.0
            / NULLIF(COUNT(*), 0),
          1
        )                                                                  AS resistance_pct
      FROM susceptibility_tests st
      JOIN isolates i
        ON st.isolate_id = i.id
      JOIN lab_requests lr
        ON i.request_id = lr.id
      LEFT JOIN concepts oc
        ON oc.id = i.organism_concept_id
      LEFT JOIN concepts ac
        ON ac.id = st.antibiotic_concept_id
      WHERE ($1::uuid IS NULL OR lr.facility_id = $1::uuid)
        AND i.specimen_date BETWEEN $2::date AND $3::date
        AND ($4::text IS NULL OR LOWER(st.guideline) = LOWER($4))
      GROUP BY
        i.organism_code, oc.display_name, i.organism_name,
        st.antibiotic_code, ac.display_name, st.antibiotic_name,
        st.guideline
      HAVING COUNT(*) >= $5
      ORDER BY i.organism_code, st.antibiotic_code
      `,
      [q.facility_id, q.date_from, q.date_to, q.guideline, q.min_isolates],
    );

    send(res, {
      metadata: {
        facility: facilityName,
        date_range: `${q.date_from} – ${q.date_to}`,
        guideline: q.guideline ?? "All guidelines",
        generated_at: new Date().toISOString().slice(0, 10),
      },
      data: rows.map((r) => ({
        organism_code: r.organism_code,
        organism_name: r.organism_name,
        antibiotic_code: r.antibiotic_code,
        antibiotic_name: r.antibiotic_name,
        total_tested: Number(r.total_tested),
        resistant: Number(r.resistant),
        intermediate: Number(r.intermediate),
        susceptible: Number(r.susceptible),
        resistance_pct: Number(r.resistance_pct),
      })),
    });
  } catch (err) {
    handleError(res, err, "antibiogram");
  }
});

// ── GET /api/v1/reports/priority-pathogens ───────────────────────────────────
//
// For each WHO priority organism:
//   • Total isolates in the date window
//   • Current resistance % against the key antibiotic class
//   • Month-by-month resistance trend
//
router.get("/priority-pathogens", async (req: Request, res: Response) => {
  const q = parseQuery(req);
  console.log("[priority-pathogens]", q);

  const orgCodes = Object.keys(WHO_ORGANISMS);
  const allKeyAbx = [
    ...new Set(Object.values(WHO_ORGANISMS).flatMap((o) => o.key_abx)),
  ];

  try {
    // Total isolates per priority organism
    const { rows: totals } = await externalPool.query(
      `
      SELECT
        i.organism_code,
        COALESCE(MAX(oc.display_name), MAX(i.organism_name), i.organism_code) AS organism_name,
        COUNT(DISTINCT i.id) AS total_isolates
      FROM isolates i
      JOIN lab_requests lr
        ON i.request_id = lr.id
      LEFT JOIN concepts oc
        ON oc.id = i.organism_concept_id
      WHERE i.organism_code = ANY($1::text[])
        AND ($2::uuid IS NULL OR lr.facility_id = $2::uuid)
        AND i.specimen_date BETWEEN $3::date AND $4::date
      GROUP BY i.organism_code
      `,
      [orgCodes, q.facility_id, q.date_from, q.date_to],
    );

    // Monthly resistance trend for every (priority organism × key antibiotic)
    const { rows: trendRows } = await externalPool.query(
      `
      SELECT
        i.organism_code,
        st.antibiotic_code,
        TO_CHAR(DATE_TRUNC('month', i.specimen_date), 'Mon') AS month_label,
        DATE_TRUNC('month', i.specimen_date)                  AS month_date,
        ROUND(
          COUNT(*) FILTER (WHERE st.interpretation = 'R') * 100.0
            / NULLIF(COUNT(*), 0),
          1
        ) AS resistance_pct
      FROM susceptibility_tests st
      JOIN isolates i
        ON st.isolate_id = i.id
      JOIN lab_requests lr
        ON i.request_id = lr.id
      WHERE i.organism_code = ANY($1::text[])
        AND st.antibiotic_code = ANY($2::text[])
        AND ($3::uuid IS NULL OR lr.facility_id = $3::uuid)
        AND i.specimen_date BETWEEN $4::date AND $5::date
      GROUP BY
        i.organism_code, st.antibiotic_code,
        DATE_TRUNC('month', i.specimen_date)
      ORDER BY i.organism_code, st.antibiotic_code, month_date
      `,
      [orgCodes, allKeyAbx, q.facility_id, q.date_from, q.date_to],
    );

    const months = monthsInRange(q.date_from, q.date_to);
    const totalMap = Object.fromEntries(
      totals.map((r) => [r.organism_code, r]),
    );

    // Build: organism → antibiotic → month → resistance_pct
    const trendMap: Record<string, Record<string, Record<string, number>>> = {};
    for (const r of trendRows) {
      trendMap[r.organism_code] ??= {};
      trendMap[r.organism_code][r.antibiotic_code] ??= {};
      trendMap[r.organism_code][r.antibiotic_code][r.month_label] = Number(
        r.resistance_pct,
      );
    }

    const pathogens = orgCodes
      .filter((code) => totalMap[code])
      .map((code) => {
        const meta = WHO_ORGANISMS[code];
        const orgTrend = trendMap[code] ?? {};

        // Use the first key antibiotic that has data, fall back to first listed
        const bestAbx =
          meta.key_abx.find((a) => orgTrend[a]) ?? meta.key_abx[0];
        const abxMonth = orgTrend[bestAbx] ?? {};
        const trend = months.map((m) => ({ month: m, pct: abxMonth[m] ?? 0 }));

        // Latest non-zero month = "current" resistance %
        const currentPct =
          trend
            .slice()
            .reverse()
            .find((t) => t.pct > 0)?.pct ?? 0;

        // Build key_resistance label per organism
        let keyResistance: string;
        if (code === "KPNEU") {
          const ctxMonth = orgTrend["CTX"] ?? orgTrend["CAZ"] ?? {};
          const ctx3gcPct =
            months
              .map((m) => ctxMonth[m] ?? 0)
              .filter(Boolean)
              .at(-1) ?? 0;
          keyResistance = `3GC-resistant: ${ctx3gcPct}% | Carbapenem-R: ${currentPct}%`;
        } else if (code === "SAURE") {
          keyResistance = `MRSA: ${currentPct}%`;
        } else if (code === "ECOLI") {
          keyResistance = `ESBL (3GC-R): ${currentPct}%`;
        } else if (code === "EFAEC") {
          keyResistance = `Vancomycin-resistant (VRE): ${currentPct}%`;
        } else {
          keyResistance = `Carbapenem-resistant: ${currentPct}%`;
        }

        return {
          who_priority: meta.priority,
          organism_code: code,
          organism_name: String(totalMap[code].organism_name),
          full_name: meta.full_name,
          total_isolates: Number(totalMap[code].total_isolates),
          key_resistance: keyResistance,
          trend,
        };
      });

    send(res, {
      metadata: {
        date_range: `${q.date_from} – ${q.date_to}`,
        guideline: q.guideline ?? "All guidelines",
      },
      pathogens,
    });
  } catch (err) {
    handleError(res, err, "priority-pathogens");
  }
});

// ── GET /api/v1/reports/amr-surveillance ─────────────────────────────────────
//
// MRSA trend (overall + by ward_type), carbapenem resistance trend by species,
// resistance count by mechanism, and ESBL prevalence trend.
//
// mrsa_screen / esbl / carbapenemase are free-text VARCHAR fields;
// posFlag() handles the full WHONET export value range.
//
router.get("/amr-surveillance", async (req: Request, res: Response) => {
  const q = parseQuery(req);
  console.log("[amr-surveillance]", q);

  const fFilter = "$1::uuid IS NULL OR lr.facility_id = $1::uuid";
  const p = [q.facility_id, q.date_from, q.date_to];

  try {
    // MRSA monthly trend: overall % + breakdown by ward_type
    const { rows: mrsaRows } = await externalPool.query(
      `
      SELECT
        TO_CHAR(DATE_TRUNC('month', i.specimen_date), 'Mon') AS month_label,
        DATE_TRUNC('month', i.specimen_date)                  AS month_date,
        ROUND(
          COUNT(*) FILTER (WHERE ${posFlag("i.mrsa_screen")}) * 100.0
            / NULLIF(COUNT(*), 0), 1
        ) AS rate,
        ROUND(
          COUNT(*) FILTER (WHERE ${posFlag("i.mrsa_screen")}
            AND LOWER(i.ward_type) = 'icu') * 100.0
            / NULLIF(COUNT(*) FILTER (WHERE LOWER(i.ward_type) = 'icu'), 0), 1
        ) AS icu,
        ROUND(
          COUNT(*) FILTER (WHERE ${posFlag("i.mrsa_screen")}
            AND LOWER(i.ward_type) IN ('inpatient', 'general')) * 100.0
            / NULLIF(COUNT(*) FILTER (
              WHERE LOWER(i.ward_type) IN ('inpatient', 'general')), 0), 1
        ) AS general,
        ROUND(
          COUNT(*) FILTER (WHERE ${posFlag("i.mrsa_screen")}
            AND LOWER(i.ward_type) = 'outpatient') * 100.0
            / NULLIF(COUNT(*) FILTER (WHERE LOWER(i.ward_type) = 'outpatient'), 0), 1
        ) AS outpatient
      FROM isolates i
      JOIN lab_requests lr ON i.request_id = lr.id
      WHERE i.organism_code = 'SAURE'
        AND i.mrsa_screen IS NOT NULL
        AND (${fFilter})
        AND i.specimen_date BETWEEN $2::date AND $3::date
      GROUP BY DATE_TRUNC('month', i.specimen_date)
      ORDER BY month_date
      `,
      p,
    );

    // MRSA rate per facility (for the geographic breakdown card)
    const { rows: mrsaFacRows } = await externalPool.query(
      `
      SELECT
        f.facility_code AS facility,
        ROUND(
          COUNT(*) FILTER (WHERE ${posFlag("i.mrsa_screen")}) * 100.0
            / NULLIF(COUNT(*), 0), 1
        ) AS rate
      FROM isolates i
      JOIN lab_requests lr ON i.request_id = lr.id
      JOIN facilities   f  ON f.id = lr.facility_id
      WHERE i.organism_code = 'SAURE'
        AND i.mrsa_screen IS NOT NULL
        AND (${fFilter})
        AND i.specimen_date BETWEEN $2::date AND $3::date
      GROUP BY f.id, f.facility_code
      ORDER BY rate DESC
      `,
      p,
    );

    // Carbapenem resistance monthly trend for CRAB / CRPA / CRKP
    // Antibiotic codes: MEM = meropenem, IPM = imipenem
    const { rows: carbaRows } = await externalPool.query(
      `
      SELECT
        i.organism_code,
        TO_CHAR(DATE_TRUNC('month', i.specimen_date), 'Mon') AS month_label,
        DATE_TRUNC('month', i.specimen_date)                  AS month_date,
        ROUND(
          COUNT(*) FILTER (WHERE st.interpretation = 'R') * 100.0
            / NULLIF(COUNT(*), 0), 1
        ) AS resistance_pct
      FROM susceptibility_tests st
      JOIN isolates i      ON st.isolate_id = i.id
      JOIN lab_requests lr ON i.request_id = lr.id
      WHERE i.organism_code IN ('ABAUM', 'PAERU', 'KPNEU')
        AND st.antibiotic_code IN ('MEM', 'IPM')
        AND (${fFilter})
        AND i.specimen_date BETWEEN $2::date AND $3::date
      GROUP BY i.organism_code, DATE_TRUNC('month', i.specimen_date)
      ORDER BY i.organism_code, month_date
      `,
      p,
    );

    // Carbapenem resistance grouped by standard nomenclature
    const { rows: mechRows } = await externalPool.query(
      `
      SELECT
        CASE
          WHEN i.organism_code = 'ABAUM'              THEN 'CRAB'
          WHEN i.organism_code = 'PAERU'              THEN 'CRPA'
          WHEN i.organism_code IN ('KPNEU', 'ECOLI')  THEN 'CRKP / CREC'
          ELSE                                              'CRE (other)'
        END                          AS mechanism,
        COUNT(DISTINCT i.id)         AS count
      FROM susceptibility_tests st
      JOIN isolates i      ON st.isolate_id = i.id
      JOIN lab_requests lr ON i.request_id = lr.id
      WHERE st.antibiotic_code IN ('MEM', 'IPM')
        AND st.interpretation = 'R'
        AND (${fFilter})
        AND i.specimen_date BETWEEN $2::date AND $3::date
      GROUP BY 1
      ORDER BY count DESC
      `,
      p,
    );

    // ESBL trend: 3rd-gen cephalosporin resistance as ESBL proxy
    // CTX = cefotaxime, CAZ = ceftazidime, CXM = cefuroxime
    const { rows: esblRows } = await externalPool.query(
      `
      SELECT
        i.organism_code,
        TO_CHAR(DATE_TRUNC('month', i.specimen_date), 'Mon') AS month_label,
        DATE_TRUNC('month', i.specimen_date)                  AS month_date,
        ROUND(
          COUNT(*) FILTER (WHERE st.interpretation = 'R') * 100.0
            / NULLIF(COUNT(*), 0), 1
        ) AS resistance_pct
      FROM susceptibility_tests st
      JOIN isolates i      ON st.isolate_id = i.id
      JOIN lab_requests lr ON i.request_id = lr.id
      WHERE i.organism_code IN ('ECOLI', 'KPNEU')
        AND st.antibiotic_code IN ('CTX', 'CAZ', 'CXM')
        AND (${fFilter})
        AND i.specimen_date BETWEEN $2::date AND $3::date
      GROUP BY i.organism_code, DATE_TRUNC('month', i.specimen_date)
      ORDER BY i.organism_code, month_date
      `,
      p,
    );

    // Pivot all results into month-keyed maps
    const months = monthsInRange(q.date_from, q.date_to);

    const mrsaByMonth = Object.fromEntries(
      mrsaRows.map((r) => [r.month_label, r]),
    );

    const carbaPivot: Record<string, Record<string, number>> = {};
    for (const r of carbaRows) {
      (carbaPivot[r.organism_code] ??= {})[r.month_label] = Number(
        r.resistance_pct,
      );
    }

    const esblPivot: Record<string, Record<string, number>> = {};
    for (const r of esblRows) {
      (esblPivot[r.organism_code] ??= {})[r.month_label] = Number(
        r.resistance_pct,
      );
    }

    const totalCR = mechRows.reduce((s, r) => s + Number(r.count), 0);

    send(res, {
      metadata: { date_range: `${q.date_from} – ${q.date_to}` },
      mrsa: {
        trend: months.map((m) => ({
          month: m,
          rate: Number(mrsaByMonth[m]?.rate ?? 0),
          icu: Number(mrsaByMonth[m]?.icu ?? 0),
          general: Number(mrsaByMonth[m]?.general ?? 0),
          outpatient: Number(mrsaByMonth[m]?.outpatient ?? 0),
        })),
        by_facility: mrsaFacRows.map((r) => ({
          facility: String(r.facility),
          rate: Number(r.rate),
        })),
      },
      carbapenem: {
        trend: months.map((m) => ({
          month: m,
          abaum_cr: carbaPivot["ABAUM"]?.[m] ?? 0,
          paeru_cr: carbaPivot["PAERU"]?.[m] ?? 0,
          kpneu_cre: carbaPivot["KPNEU"]?.[m] ?? 0,
        })),
        by_mechanism: mechRows.map((r) => ({
          mechanism: String(r.mechanism),
          count: Number(r.count),
          pct:
            totalCR > 0
              ? Number(((Number(r.count) / totalCR) * 100).toFixed(1))
              : 0,
        })),
      },
      esbl: {
        trend: months.map((m) => ({
          month: m,
          ecoli: esblPivot["ECOLI"]?.[m] ?? 0,
          kpneu: esblPivot["KPNEU"]?.[m] ?? 0,
        })),
      },
    });
  } catch (err) {
    handleError(res, err, "amr-surveillance");
  }
});

// ── GET /api/v1/reports/workload ─────────────────────────────────────────────
//
// Monthly test volumes by section_code, TAT percentiles (P50 / P90),
// and specimen type distribution.
// TAT = authorised_at − registered_at in hours.
// Negative / implausible values (> 30 days = 720 h) are excluded.
//
router.get("/workload", async (req: Request, res: Response) => {
  const q = parseQuery(req);
  console.log("[workload]", q);

  const fFilter = "$1::uuid IS NULL OR lr.facility_id = $1::uuid";
  const p = [q.facility_id, q.date_from, q.date_to];

  try {
    // Monthly volumes bucketed into 4 canonical section groups
    const { rows: volRows } = await externalPool.query(
      `
      SELECT
        TO_CHAR(DATE_TRUNC('month', lr.specimen_datetime), 'Mon') AS month_label,
        DATE_TRUNC('month', lr.specimen_datetime)                  AS month_date,
        COUNT(*) FILTER (WHERE lr.section_code = 'CH')             AS ch,
        COUNT(*) FILTER (WHERE lr.section_code = 'HM')             AS hm,
        COUNT(*) FILTER (WHERE lr.section_code IN ('MB', 'MI'))    AS mb,
        COUNT(*) FILTER (WHERE lr.section_code IN ('SE', 'IM'))    AS se,
        COUNT(*)                                                    AS total
      FROM lab_requests lr
      WHERE (${fFilter})
        AND lr.specimen_datetime BETWEEN $2::timestamptz
          AND ($3::date + INTERVAL '1 day')::timestamptz
        AND lr.result_status = 'F'
      GROUP BY DATE_TRUNC('month', lr.specimen_datetime)
      ORDER BY month_date
      `,
      p,
    );

    // TAT percentiles per canonical section
    const { rows: tatRows } = await externalPool.query(
      `
      SELECT
        CASE
          WHEN lr.section_code IN ('MB', 'MI') THEN 'MB'
          WHEN lr.section_code IN ('SE', 'IM') THEN 'SE'
          ELSE COALESCE(lr.section_code, 'CH')
        END AS code,
        ROUND(CAST(
          PERCENTILE_CONT(0.50) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (lr.authorised_at - lr.registered_at)) / 3600
          ) AS numeric
        ), 1) AS p50,
        ROUND(CAST(
          PERCENTILE_CONT(0.90) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (lr.authorised_at - lr.registered_at)) / 3600
          ) AS numeric
        ), 1) AS p90
      FROM lab_requests lr
      WHERE lr.authorised_at IS NOT NULL
        AND lr.registered_at IS NOT NULL
        AND lr.authorised_at > lr.registered_at
        AND EXTRACT(EPOCH FROM (lr.authorised_at - lr.registered_at)) / 3600 <= 720
        AND (${fFilter})
        AND lr.specimen_datetime BETWEEN $2::timestamptz
          AND ($3::date + INTERVAL '1 day')::timestamptz
      GROUP BY code
      ORDER BY code
      `,
      p,
    );

    // Top 5 specimen types + everything else rolled into "Other"
    const { rows: specRows } = await externalPool.query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(lr.specimen_desc), ''), 'Other') AS name,
        COUNT(*) AS cnt
      FROM lab_requests lr
      WHERE (${fFilter})
        AND lr.specimen_datetime BETWEEN $2::timestamptz
          AND ($3::date + INTERVAL '1 day')::timestamptz
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT 8
      `,
      p,
    );

    const specColors = [
      "#2D9EFF",
      "#FF4560",
      "#00C9A7",
      "#FFC145",
      "#7B61FF",
      "#FF7A45",
      "#3E6080",
    ];
    const specTotal = specRows.reduce((s, r) => s + Number(r.cnt), 0);
    const top5 = specRows.slice(0, 5);
    const otherSum = specRows.slice(5).reduce((s, r) => s + Number(r.cnt), 0);

    const specimenDist = [
      ...top5.map((r, i) => ({
        name: String(r.name),
        value: Math.round((Number(r.cnt) / specTotal) * 100),
        color: specColors[i] ?? "#3E6080",
      })),
      ...(otherSum > 0
        ? [
            {
              name: "Other",
              value: Math.round((otherSum / specTotal) * 100),
              color: "#3E6080",
            },
          ]
        : []),
    ];

    const facilityLabel = q.facility_id
      ? await externalPool
          .query<{ facility_name: string }>(
            "SELECT facility_name FROM facilities WHERE id = $1",
            [q.facility_id],
          )
          .then((r) => r.rows[0]?.facility_name ?? "Unknown")
      : "All Facilities";

    const tatMap = Object.fromEntries(tatRows.map((r) => [String(r.code), r]));

    // Unique sections only (MI is an alias for MB)
    const uniqueSections = [
      ["CH", SECTION_META["CH"]],
      ["HM", SECTION_META["HM"]],
      ["MB", SECTION_META["MB"]],
      ["SE", SECTION_META["SE"]],
      ["IM", SECTION_META["IM"]],
    ] as [string, (typeof SECTION_META)[string]][];

    send(res, {
      metadata: {
        date_range: `${q.date_from} – ${q.date_to}`,
        facility: facilityLabel,
      },
      monthly_volumes: volRows.map((r) => ({
        month: String(r.month_label),
        CH: Number(r.ch),
        MB: Number(r.mb),
        HM: Number(r.hm),
        SE: Number(r.se),
        total: Number(r.total),
      })),
      tat_by_section: uniqueSections
        .filter(([code]) => tatMap[code])
        .map(([code, meta]) => ({
          section: meta.label,
          code,
          p50: Number(tatMap[code].p50),
          p90: Number(tatMap[code].p90),
          target: meta.target,
          unit: "hours",
        })),
      specimen_type_dist: specimenDist,
    });
  } catch (err) {
    handleError(res, err, "workload");
  }
});

// ── GET /api/v1/reports/geographic ───────────────────────────────────────────
//
// Per-facility MRSA / CRE / ESBL rates.
// Coordinates come from facilities.metadata->>'lat' / ->>'lng';
// populate those at facility registration time via the admin API.
//
router.get("/geographic", async (req: Request, res: Response) => {
  const q = parseQuery(req);
  console.log("[geographic]", q);

  try {
    const { rows } = await externalPool.query(
      `
      SELECT
        f.facility_code,
        f.facility_name,
        COALESCE(f.region, f.province, f.city, 'Unknown') AS region,
        COALESCE(f.district, 'Unknown')                    AS district,
        (f.metadata->>'lat')::text AS lat,
        (f.metadata->>'lng')::text AS lng,

        COUNT(DISTINCT i.id) AS total_isolates,

        -- S. aureus denominator for MRSA rate
        COUNT(DISTINCT i.id) FILTER (
          WHERE i.organism_code = 'SAURE'
        ) AS saure_total,
        COUNT(DISTINCT i.id) FILTER (
          WHERE i.organism_code = 'SAURE'
            AND ${posFlag("i.mrsa_screen")}
        ) AS mrsa_positive,

        -- Carbapenem-resistant isolates (any species, MEM or IPM)
        COUNT(DISTINCT st_cr.isolate_id) AS cr_total,

        -- ESBL-positive isolates (via the esbl marker field)
        COUNT(DISTINCT i.id) FILTER (
          WHERE ${posFlag("i.esbl")}
        ) AS esbl_positive

      FROM facilities f
      LEFT JOIN lab_requests lr
        ON lr.facility_id = f.id
      LEFT JOIN isolates i
        ON i.request_id = lr.id
        AND i.specimen_date BETWEEN $1::date AND $2::date
      -- Lateral sub-select to flag carbapenem-resistant isolates
      LEFT JOIN LATERAL (
        SELECT DISTINCT st2.isolate_id
        FROM susceptibility_tests st2
        WHERE st2.isolate_id = i.id
          AND st2.antibiotic_code IN ('MEM', 'IPM')
          AND st2.interpretation = 'R'
      ) st_cr ON TRUE
      WHERE f.is_active = TRUE
      GROUP BY f.id, f.facility_code, f.facility_name,
               f.region, f.province, f.city, f.district, f.metadata
      HAVING COUNT(DISTINCT i.id) > 0
      ORDER BY total_isolates DESC
      `,
      [q.date_from, q.date_to],
    );

    send(res, {
      metadata: { date_range: `${q.date_from} – ${q.date_to}` },
      facilities: rows.map((r) => {
        const total = Number(r.total_isolates);
        const saure = Number(r.saure_total);
        const mrsaPos = Number(r.mrsa_positive);
        const crTotal = Number(r.cr_total);
        const esblPos = Number(r.esbl_positive);

        return {
          facility_code: String(r.facility_code),
          facility_name: String(r.facility_name),
          region: String(r.region),
          district: String(r.district),
          total_isolates: total,
          mrsa_rate:
            saure > 0 ? Number(((mrsaPos / saure) * 100).toFixed(1)) : 0,
          cre_rate:
            total > 0 ? Number(((crTotal / total) * 100).toFixed(1)) : 0,
          esbl_rate:
            total > 0 ? Number(((esblPos / total) * 100).toFixed(1)) : 0,
          lat: r.lat ? Number(r.lat) : 0,
          lng: r.lng ? Number(r.lng) : 0,
        };
      }),
    });
  } catch (err) {
    handleError(res, err, "geographic");
  }
});

// ── GET /api/v1/reports/data-quality ─────────────────────────────────────────
//
// Import batch success rates + field completeness scoring per facility.
//
// Completeness dimensions (0–100 per request, averaged per facility):
//   demographics → patient has date_of_birth AND sex
//   organism     → MB/MI request has ≥1 isolate with organism_code
//   ast          → those isolates have ≥1 susceptibility_test row
//   specimen     → request has specimen_code populated
//
router.get("/data-quality", async (req: Request, res: Response) => {
  const q = parseQuery(req);
  console.log("[data-quality]", q);

  try {
    // Batch statistics: one row per facility
    const { rows: batchRows } = await externalPool.query(
      `
      SELECT
        f.id::text           AS facility_id,
        f.facility_code,
        f.facility_name,
        COUNT(ib.id)                             AS batches,
        COALESCE(SUM(ib.records_total),   0)     AS records_total,
        COALESCE(SUM(ib.records_success), 0)     AS records_success,
        MAX(ib.completed_at)                     AS last_import
      FROM facilities f
      JOIN data_sources   ds ON ds.facility_id = f.id
      JOIN import_batches ib ON ib.data_source_id = ds.id
      WHERE ib.batch_status IN ('completed', 'partial')
        AND ib.started_at BETWEEN $1::timestamptz
          AND ($2::date + INTERVAL '1 day')::timestamptz
        AND ($3::uuid IS NULL OR f.id = $3::uuid)
      GROUP BY f.id, f.facility_code, f.facility_name
      ORDER BY records_total DESC
      `,
      [q.date_from, q.date_to, q.facility_id],
    );

    // Monthly ingestion trend
    const { rows: monthlyRows } = await externalPool.query(
      `
      SELECT
        TO_CHAR(DATE_TRUNC('month', ib.started_at), 'Mon') AS month_label,
        DATE_TRUNC('month', ib.started_at)                  AS month_date,
        SUM(ib.records_total)                               AS records,
        ROUND(
          SUM(ib.records_success) * 100.0
            / NULLIF(SUM(ib.records_total), 0),
          1
        ) AS success_rate
      FROM import_batches ib
      JOIN data_sources ds ON ds.id = ib.data_source_id
      JOIN facilities   f  ON f.id  = ds.facility_id
      WHERE ib.batch_status IN ('completed', 'partial')
        AND ib.started_at BETWEEN $1::timestamptz
          AND ($2::date + INTERVAL '1 day')::timestamptz
        AND ($3::uuid IS NULL OR f.id = $3::uuid)
      GROUP BY DATE_TRUNC('month', ib.started_at)
      ORDER BY month_date
      `,
      [q.date_from, q.date_to, q.facility_id],
    );

    // Field completeness per facility
    // organism / AST scores are computed only over MB/MI requests
    // so that the denominator is meaningful (non-MB tests won't have isolates).
    const { rows: compRows } = await externalPool.query(
      `
      SELECT
        lr.facility_id::text,

        ROUND(AVG(
          CASE WHEN p.date_of_birth IS NOT NULL
                AND p.sex IS NOT NULL THEN 100 ELSE 0 END
        ), 1) AS completeness_demo,

        ROUND(AVG(
          CASE WHEN lr.section_code IN ('MB', 'MI') THEN
            CASE WHEN EXISTS (
              SELECT 1 FROM isolates ii
              WHERE ii.request_id = lr.id
                AND ii.organism_code IS NOT NULL
            ) THEN 100 ELSE 0 END
          ELSE NULL END
        ), 1) AS completeness_organism,

        ROUND(AVG(
          CASE WHEN lr.section_code IN ('MB', 'MI') THEN
            CASE WHEN EXISTS (
              SELECT 1
              FROM isolates ii
              JOIN susceptibility_tests st ON st.isolate_id = ii.id
              WHERE ii.request_id = lr.id
            ) THEN 100 ELSE 0 END
          ELSE NULL END
        ), 1) AS completeness_ast,

        ROUND(AVG(
          CASE WHEN lr.specimen_code IS NOT NULL THEN 100 ELSE 0 END
        ), 1) AS completeness_specimen

      FROM lab_requests lr
      LEFT JOIN patients p ON p.id = lr.patient_id
      WHERE lr.specimen_datetime BETWEEN $1::timestamptz
          AND ($2::date + INTERVAL '1 day')::timestamptz
        AND ($3::uuid IS NULL OR lr.facility_id = $3::uuid)
      GROUP BY lr.facility_id
      `,
      [q.date_from, q.date_to, q.facility_id],
    );

    const compMap = Object.fromEntries(
      compRows.map((r) => [String(r.facility_id), r]),
    );

    const totalRecords = batchRows.reduce(
      (s, r) => s + Number(r.records_total),
      0,
    );
    const totalSuccess = batchRows.reduce(
      (s, r) => s + Number(r.records_success),
      0,
    );
    const totalBatches = batchRows.reduce((s, r) => s + Number(r.batches), 0);
    const lastImport =
      batchRows
        .map((r) => r.last_import as string | null)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    send(res, {
      metadata: { date_range: `${q.date_from} – ${q.date_to}` },
      summary: {
        total_batches: totalBatches,
        total_records: totalRecords,
        success_rate:
          totalRecords > 0
            ? Number(((totalSuccess / totalRecords) * 100).toFixed(1))
            : 0,
        facilities_active: batchRows.length,
        last_import: lastImport
          ? new Date(lastImport).toISOString().slice(0, 10)
          : "N/A",
      },
      facilities: batchRows.map((r) => {
        const comp = compMap[String(r.facility_id)];
        const rec = Number(r.records_total);
        const suc = Number(r.records_success);
        return {
          facility: String(r.facility_code),
          batches: Number(r.batches),
          records: rec,
          success_rate: rec > 0 ? Number(((suc / rec) * 100).toFixed(1)) : 0,
          completeness_demo: Number(comp?.completeness_demo ?? 0),
          completeness_organism: Number(comp?.completeness_organism ?? 0),
          completeness_ast: Number(comp?.completeness_ast ?? 0),
          completeness_specimen: Number(comp?.completeness_specimen ?? 0),
        };
      }),
      monthly_ingestion: monthlyRows.map((r) => ({
        month: String(r.month_label),
        records: Number(r.records),
        success_rate: Number(r.success_rate),
      })),
    });
  } catch (err) {
    handleError(res, err, "data-quality");
  }
});

export default router;
