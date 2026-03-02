-- ============================================================================
-- OpenLDR V2 — Central Laboratory Data Repository Schema
-- ============================================================================
-- Design principles:
--   1. Multi-source ingestion: data arrives from many LIS, formats, standards
--   2. OCL-inspired terminology layer (lightweight, self-contained)
--   3. Columnar core fields for fast analytics + JSONB for extensibility
--   4. General lab data first, AMR as a natural extension
--   5. Full provenance: know where every row came from
-- ============================================================================

CREATE DATABASE openldr_external;

\c openldr_external

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fuzzy text search on concept names


-- ############################################################################
-- LAYER 1: TERMINOLOGY & MAPPING (OCL-inspired, lightweight)
-- ############################################################################
-- Instead of running a full OCL instance, we embed the essential primitives:
--   coding_systems  ≈  OCL Source   (LOINC, ICD-10, WHONET, SNOMED, local)
--   concepts        ≈  OCL Concept  (a single code within a system)
--   concept_mappings ≈ OCL Mapping  (relationships across systems)
--
-- This lets each deployment define which standards matter to them while
-- keeping a single mapping table that the query engine can JOIN against.
-- ############################################################################

-- ----------------------------------------------------------------------------
-- coding_systems — registry of every coding system / vocabulary in play
-- Think: LOINC, ICD-10, WHONET-ORG, WHONET-ABX, SNOMED-CT, facility-local
-- ----------------------------------------------------------------------------
CREATE TABLE coding_systems (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_code     VARCHAR(50)  NOT NULL UNIQUE,   -- e.g. 'LOINC', 'ICD10', 'WHONET_ORG'
    system_name     VARCHAR(255) NOT NULL,
    system_uri      TEXT,                            -- canonical URI (hl7.org/fhir/sid/…)
    system_version  VARCHAR(50),
    system_type     VARCHAR(30)  NOT NULL DEFAULT 'external',  -- 'external' | 'internal' | 'local'
    description     TEXT,
    owner           VARCHAR(255),                    -- org that maintains this system
    metadata        JSONB        DEFAULT '{}',       -- anything else (license, url, etc.)
    is_active       BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE  coding_systems IS 'Registry of vocabularies/code systems (≈ OCL Source)';
COMMENT ON COLUMN coding_systems.system_type IS 'external = published standard, internal = org-managed, local = facility-specific';

-- ----------------------------------------------------------------------------
-- concepts — individual codes within a coding system
-- Kept deliberately flat; rich metadata goes in `properties` JSONB
-- ----------------------------------------------------------------------------
CREATE TABLE concepts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id       UUID         NOT NULL REFERENCES coding_systems(id),
    concept_code    VARCHAR(100) NOT NULL,           -- the actual code value
    display_name    VARCHAR(500) NOT NULL,           -- preferred human-readable name
    concept_class   VARCHAR(100),                    -- 'test', 'panel', 'organism', 'antibiotic', 'specimen', 'diagnosis', …
    datatype        VARCHAR(50),                     -- 'numeric', 'coded', 'text', 'datetime'
    properties      JSONB        DEFAULT '{}',       -- extensible: drug_class, atc_code, potency, taxonomy, loinc_component …
    names           JSONB        DEFAULT '[]',       -- [{locale, name, name_type, preferred}] — multilingual
    is_active       BOOLEAN      DEFAULT TRUE,
    retired         BOOLEAN      DEFAULT FALSE,
    replaced_by     UUID         REFERENCES concepts(id),
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),

    UNIQUE (system_id, concept_code)
);

CREATE INDEX idx_concepts_system       ON concepts(system_id);
CREATE INDEX idx_concepts_code         ON concepts(concept_code);
CREATE INDEX idx_concepts_class        ON concepts(concept_class);
CREATE INDEX idx_concepts_display      ON concepts USING gin(display_name gin_trgm_ops);
CREATE INDEX idx_concepts_properties   ON concepts USING gin(properties);

COMMENT ON TABLE  concepts IS 'Individual codes/terms within a coding system (≈ OCL Concept)';
COMMENT ON COLUMN concepts.properties IS 'System-specific attributes: for WHONET antibiotics this holds drug_class, atc_code, potency, etc.';

-- ----------------------------------------------------------------------------
-- concept_mappings — relationships between concepts across coding systems
-- map_type follows OCL conventions: SAME-AS, NARROWER-THAN, BROADER-THAN,
-- Q-AND-A, CONCEPT-SET, etc.  The most common use case is SAME-AS for
-- cross-walking a local code to LOINC or WHONET.
-- ----------------------------------------------------------------------------
CREATE TABLE concept_mappings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_concept_id UUID         NOT NULL REFERENCES concepts(id),
    to_concept_id   UUID         REFERENCES concepts(id),      -- NULL if target not in our DB
    to_system_code  VARCHAR(50),                                -- fallback: external system code
    to_concept_code VARCHAR(100),                               -- fallback: external concept code
    to_concept_name VARCHAR(500),                               -- fallback: display name
    map_type        VARCHAR(50)  NOT NULL DEFAULT 'SAME-AS',    -- SAME-AS | NARROWER-THAN | BROADER-THAN | RELATED-TO | …
    relationship    VARCHAR(100),                                -- optional finer label
    owner           VARCHAR(255),                                -- who created this mapping
    metadata        JSONB        DEFAULT '{}',
    is_active       BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_mappings_from       ON concept_mappings(from_concept_id);
CREATE INDEX idx_mappings_to         ON concept_mappings(to_concept_id);
CREATE INDEX idx_mappings_type       ON concept_mappings(map_type);
CREATE INDEX idx_mappings_to_ext     ON concept_mappings(to_system_code, to_concept_code);

COMMENT ON TABLE concept_mappings IS 'Cross-walks between codes in different systems (≈ OCL Mapping)';
COMMENT ON COLUMN concept_mappings.to_concept_id IS 'Set when target concept exists locally; NULL when mapping to external-only code';


-- ############################################################################
-- LAYER 2: INFRASTRUCTURE / FACILITIES
-- ############################################################################

CREATE TABLE facilities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_code   VARCHAR(50)  NOT NULL UNIQUE,    -- the code used in incoming messages
    facility_name   VARCHAR(255) NOT NULL,
    facility_type   VARCHAR(50),                     -- 'hospital', 'national_ref', 'district', 'private', 'research'
    country_code    VARCHAR(3),                       -- ISO 3166-1 alpha-3
    region          VARCHAR(100),
    district        VARCHAR(100),
    province        VARCHAR(100),
    city            VARCHAR(100),
    address         TEXT,
    contact         JSONB        DEFAULT '{}',        -- {email, phone, person}
    lims_vendor     VARCHAR(100),                     -- what LIS they run
    metadata        JSONB        DEFAULT '{}',        -- accreditation, minio_bucket, etc.
    is_active       BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_facilities_country  ON facilities(country_code);
CREATE INDEX idx_facilities_type     ON facilities(facility_type);


-- ############################################################################
-- LAYER 3: DATA PROVENANCE — know where every row came from
-- ############################################################################

-- ----------------------------------------------------------------------------
-- data_sources — a registered external system that feeds data into OpenLDR
-- e.g. "Muhimbili DISA*Lab", "Mbeya HL7 feed", "WHONET SQLite upload"
-- ----------------------------------------------------------------------------
CREATE TABLE data_sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_code     VARCHAR(100) NOT NULL UNIQUE,
    source_name     VARCHAR(255) NOT NULL,
    source_type     VARCHAR(50)  NOT NULL,           -- 'hl7_v2', 'hl7_fhir', 'csv', 'whonet_sqlite', 'astm', 'api', 'manual'
    facility_id     UUID         REFERENCES facilities(id),
    description     TEXT,
    config          JSONB        DEFAULT '{}',        -- connection details, field mapping profile ref, etc.
    is_active       BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- import_batches — every ingest run is tracked
-- ----------------------------------------------------------------------------
CREATE TABLE import_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id  UUID         NOT NULL REFERENCES data_sources(id),
    batch_status    VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed | partial
    filename        VARCHAR(500),
    file_hash       VARCHAR(128),                    -- SHA-256 for dedup
    file_storage_path TEXT,                          -- MinIO / S3 path
    records_total   INTEGER      DEFAULT 0,
    records_success INTEGER      DEFAULT 0,
    records_failed  INTEGER      DEFAULT 0,
    error_log       JSONB        DEFAULT '[]',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    metadata        JSONB        DEFAULT '{}'
);

CREATE INDEX idx_batches_source      ON import_batches(data_source_id);
CREATE INDEX idx_batches_status      ON import_batches(batch_status);
CREATE INDEX idx_batches_hash        ON import_batches(file_hash);

-- ----------------------------------------------------------------------------
-- field_mappings — how source-system fields map to OpenLDR columns
-- This replaces hard-coded ETL logic: a JSON document per data_source
-- that says "their column X → our column Y, with transform Z"
-- ----------------------------------------------------------------------------
CREATE TABLE field_mappings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id  UUID         NOT NULL REFERENCES data_sources(id),
    mapping_name    VARCHAR(255) NOT NULL,
    mapping_version VARCHAR(20)  DEFAULT '1.0',
    -- The actual mapping rules:
    -- [ { "source_field": "ORGANISM", "target_table": "lab_results", "target_field": "observation_code",
    --     "transform": "lookup", "lookup_system": "WHONET_ORG", "default": null } ]
    rules           JSONB        NOT NULL DEFAULT '[]',
    is_active       BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),

    UNIQUE (data_source_id, mapping_name, mapping_version)
);


-- ############################################################################
-- LAYER 4: CORE LAB DATA — general purpose, all lab disciplines
-- ############################################################################
-- Design: important/queryable columns are promoted to real columns.
-- Everything else (including the full original message) lives in JSONB.
-- This gives you fast indexed queries AND full backward compatibility with V1.

-- ----------------------------------------------------------------------------
-- patients
-- ----------------------------------------------------------------------------
CREATE TABLE patients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_guid    VARCHAR(255) NOT NULL,            -- external patient identifier from source
    facility_id     UUID         NOT NULL REFERENCES facilities(id),

    -- Promoted demographics (commonly queried)
    surname         VARCHAR(100),
    firstname       VARCHAR(100),
    date_of_birth   DATE,
    dob_estimated   BOOLEAN      DEFAULT FALSE,
    sex             CHAR(1)      CHECK (sex IN ('M', 'F', 'U', 'O')),
    national_id     VARCHAR(50),
    phone           VARCHAR(30),
    email           VARCHAR(100),

    -- Encrypted/hashed ID for de-identified analytics
    encrypted_patient_id VARCHAR(128),

    -- Full original patient payload (V1 backward compat + future extensibility)
    patient_data    JSONB        DEFAULT '{}',

    -- Provenance
    import_batch_id UUID         REFERENCES import_batches(id),
    source_system   VARCHAR(100),

    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),

    UNIQUE (patient_guid, facility_id)
);

CREATE INDEX idx_patients_facility       ON patients(facility_id);
CREATE INDEX idx_patients_guid           ON patients(patient_guid);
CREATE INDEX idx_patients_encrypted      ON patients(encrypted_patient_id);
CREATE INDEX idx_patients_data           ON patients USING gin(patient_data);

-- ----------------------------------------------------------------------------
-- lab_requests — one row per test-panel order
-- Maps to V1 Requests + the OBR segment in HL7
-- ----------------------------------------------------------------------------
CREATE TABLE lab_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID         NOT NULL REFERENCES patients(id),
    facility_id     UUID         NOT NULL REFERENCES facilities(id),

    -- Identifiers
    request_id      VARCHAR(255) NOT NULL,            -- LIS accession / request number
    obr_set_id      INTEGER,                          -- HL7 OBR set ID (for multi-panel requests)

    -- Panel / test identification  — linked to terminology layer
    panel_concept_id UUID        REFERENCES concepts(id),   -- resolved concept
    panel_code       VARCHAR(100),                           -- raw code from source
    panel_system     VARCHAR(50),                            -- which coding system (LOINC, local, etc.)
    panel_desc       VARCHAR(255),

    -- Specimen
    specimen_datetime    TIMESTAMPTZ,
    specimen_concept_id  UUID     REFERENCES concepts(id),   -- resolved specimen type
    specimen_code        VARCHAR(50),                         -- raw specimen code
    specimen_desc        VARCHAR(100),
    specimen_site_code   VARCHAR(50),
    specimen_site_desc   VARCHAR(100),
    collection_volume    NUMERIC(10,2),

    -- Workflow timestamps
    registered_at        TIMESTAMPTZ,
    received_at          TIMESTAMPTZ,
    analysis_at          TIMESTAMPTZ,
    authorised_at        TIMESTAMPTZ,

    -- Clinical context
    priority             CHAR(1),                            -- HL7 priority: S, R, A
    clinical_info        TEXT,
    icd10_codes          VARCHAR(100),
    diagnosis_concept_id UUID     REFERENCES concepts(id),   -- resolved ICD/diagnosis concept
    therapy              TEXT,                                -- current patient therapy (important for AMR context)

    -- Requesting / performing
    requesting_facility  VARCHAR(100),
    testing_facility     VARCHAR(100),
    requesting_doctor    VARCHAR(255),
    tested_by            VARCHAR(255),
    authorised_by        VARCHAR(255),

    -- Patient snapshot at time of request (de-normalized for analytics)
    age_years            INTEGER,
    age_days             INTEGER,
    sex                  CHAR(1),
    patient_class        CHAR(1),                            -- I=inpatient, O=outpatient, E=emergency

    -- Section / status
    section_code         VARCHAR(10),                         -- HL7 section: CH, HM, MB, …
    result_status        CHAR(1),                             -- F=final, P=preliminary, C=corrected

    -- Full original request payload
    request_data         JSONB    DEFAULT '{}',

    -- Resolved mappings cache (concept_id lookups done at ingest time)
    mappings             JSONB    DEFAULT '{}',

    -- Provenance
    import_batch_id      UUID     REFERENCES import_batches(id),
    source_system        VARCHAR(100),

    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (request_id, obr_set_id, facility_id)
);

CREATE INDEX idx_requests_patient        ON lab_requests(patient_id);
CREATE INDEX idx_requests_facility       ON lab_requests(facility_id);
CREATE INDEX idx_requests_panel          ON lab_requests(panel_concept_id);
CREATE INDEX idx_requests_panel_code     ON lab_requests(panel_code);
CREATE INDEX idx_requests_specimen_dt    ON lab_requests(specimen_datetime);
CREATE INDEX idx_requests_section        ON lab_requests(section_code);
CREATE INDEX idx_requests_status         ON lab_requests(result_status);
CREATE INDEX idx_requests_data           ON lab_requests USING gin(request_data);
CREATE INDEX idx_requests_mappings       ON lab_requests USING gin(mappings);
CREATE INDEX idx_requests_age            ON lab_requests(age_years);
CREATE INDEX idx_requests_composite      ON lab_requests(request_id, obr_set_id, facility_id);

-- ----------------------------------------------------------------------------
-- lab_results — one row per observation / test result
-- Maps to V1 LabResults + the OBX segment in HL7
-- General purpose: captures ALL lab disciplines (chemistry, haem, micro, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE lab_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID         NOT NULL REFERENCES lab_requests(id) ON DELETE CASCADE,

    -- Observation identification — linked to terminology layer
    obx_set_id           INTEGER,
    obx_sub_id           INTEGER,
    observation_concept_id UUID   REFERENCES concepts(id),    -- resolved LOINC / local concept
    observation_code      VARCHAR(100),                        -- raw code from source
    observation_system    VARCHAR(50),                         -- which coding system
    observation_desc      VARCHAR(255),

    -- Result values (multi-type support)
    result_type           VARCHAR(10),                         -- NM=numeric, CE=coded, ST=string, DT=datetime
    numeric_value         NUMERIC(15,5),
    numeric_units         VARCHAR(50),
    numeric_lo_range      NUMERIC(15,5),
    numeric_hi_range      NUMERIC(15,5),
    coded_value           VARCHAR(50),                         -- for coded results (pos/neg, organism codes, etc.)
    text_value            TEXT,                                 -- free-text results
    datetime_value        TIMESTAMPTZ,
    abnormal_flag         VARCHAR(10),                         -- HL7 flags: H, L, HH, LL, A, N, …

    -- Reported result (as the LIS formatted it — preserve original)
    rpt_result            TEXT,
    rpt_units             VARCHAR(50),
    rpt_flag              VARCHAR(25),
    rpt_range             VARCHAR(50),

    -- Quantitative / semi-quantitative
    semiquantitative      INTEGER,
    work_units            NUMERIC(10,2),
    cost_units            NUMERIC(10,2),

    -- Timestamps
    result_timestamp      TIMESTAMPTZ,                         -- when result was finalized
    first_printed         TIMESTAMPTZ,

    -- Full original result payload
    result_data           JSONB    DEFAULT '{}',

    -- Provenance
    import_batch_id       UUID     REFERENCES import_batches(id),

    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_results_request         ON lab_results(request_id);
CREATE INDEX idx_results_obs_concept     ON lab_results(observation_concept_id);
CREATE INDEX idx_results_obs_code        ON lab_results(observation_code);
CREATE INDEX idx_results_result_type     ON lab_results(result_type);
CREATE INDEX idx_results_coded_value     ON lab_results(coded_value);
CREATE INDEX idx_results_abnormal        ON lab_results(abnormal_flag);
CREATE INDEX idx_results_timestamp       ON lab_results(result_timestamp);
CREATE INDEX idx_results_data            ON lab_results USING gin(result_data);


-- ############################################################################
-- LAYER 5: AMR EXTENSION — enrichment for microbiology / AST data
-- ############################################################################
-- These tables are OPTIONAL — they only get populated when the incoming data
-- is identified as microbiology / culture / AST.  They link back to the core
-- lab_results row that reported the organism.

-- ----------------------------------------------------------------------------
-- isolates — one row per organism isolated from a specimen
-- Links to the lab_result that reported the culture finding
-- ----------------------------------------------------------------------------
CREATE TABLE isolates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_result_id   UUID         NOT NULL REFERENCES lab_results(id) ON DELETE CASCADE,
    request_id      UUID         NOT NULL REFERENCES lab_requests(id),

    -- Organism — linked to terminology layer
    organism_concept_id  UUID    REFERENCES concepts(id),      -- resolved WHONET/SNOMED organism
    organism_code        VARCHAR(50),                           -- raw code from source
    organism_name        VARCHAR(255),

    -- Specimen context (de-normalized from request for easy AMR queries)
    specimen_concept_id  UUID    REFERENCES concepts(id),
    specimen_code        VARCHAR(50),
    specimen_date        DATE,

    -- Isolate details
    isolate_number       VARCHAR(50),
    serotype             VARCHAR(100),
    organism_type        VARCHAR(50),                           -- 'bacteria', 'fungus', 'virus', 'parasite'

    -- Resistance markers
    beta_lactamase       VARCHAR(50),
    esbl                 VARCHAR(50),
    carbapenemase        VARCHAR(50),
    mrsa_screen          VARCHAR(50),
    inducible_clinda     VARCHAR(50),

    -- Clinical context (de-normalized for AMR analytics)
    patient_age_days     INTEGER,
    patient_sex          CHAR(1),
    ward                 VARCHAR(100),
    ward_type            VARCHAR(50),                           -- 'ICU', 'outpatient', 'inpatient', 'neonatal'
    origin               VARCHAR(20),                           -- 'community' | 'hospital' | 'unknown'
    prior_antibiotics    TEXT,

    -- Raw / extended
    custom_fields        JSONB    DEFAULT '{}',
    raw_data             JSONB    DEFAULT '{}',                  -- original WHONET row if applicable

    -- Provenance
    import_batch_id      UUID     REFERENCES import_batches(id),

    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_isolates_result         ON isolates(lab_result_id);
CREATE INDEX idx_isolates_request        ON isolates(request_id);
CREATE INDEX idx_isolates_organism       ON isolates(organism_concept_id);
CREATE INDEX idx_isolates_org_code       ON isolates(organism_code);
CREATE INDEX idx_isolates_specimen_dt    ON isolates(specimen_date);
CREATE INDEX idx_isolates_type           ON isolates(organism_type);
CREATE INDEX idx_isolates_esbl           ON isolates(esbl) WHERE esbl IS NOT NULL;
CREATE INDEX idx_isolates_carba          ON isolates(carbapenemase) WHERE carbapenemase IS NOT NULL;
CREATE INDEX idx_isolates_org_spec_dt    ON isolates(organism_code, specimen_date);

-- ----------------------------------------------------------------------------
-- susceptibility_tests — one row per isolate + antibiotic tested
-- The core of AMR analytics: S / I / R interpretations
-- ----------------------------------------------------------------------------
CREATE TABLE susceptibility_tests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    isolate_id      UUID         NOT NULL REFERENCES isolates(id) ON DELETE CASCADE,

    -- Antibiotic — linked to terminology layer
    antibiotic_concept_id UUID   REFERENCES concepts(id),      -- resolved WHONET/ATC antibiotic
    antibiotic_code       VARCHAR(50)  NOT NULL,                -- raw code (e.g. 'AMK', 'CIP')
    antibiotic_name       VARCHAR(100),

    -- Test method
    test_method           VARCHAR(20),                          -- 'disk_diffusion', 'mic', 'etest', 'agar_dilution'
    disk_potency          VARCHAR(30),                          -- '30µg', '10µg', etc.

    -- Results
    result_raw            VARCHAR(100),                         -- original value: '22', '<=0.5', 'R'
    result_numeric        NUMERIC(10,3),                        -- parsed numeric value
    interpretation        VARCHAR(5),                           -- S, I, R, SDD, NS

    -- Guideline used
    guideline             VARCHAR(50),                          -- 'CLSI', 'EUCAST', 'DIN', 'SFM'
    guideline_version     VARCHAR(50),                          -- '2024', 'v13.0'

    -- Provenance
    import_batch_id       UUID     REFERENCES import_batches(id),

    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ast_unique_test ON susceptibility_tests(isolate_id, antibiotic_code, test_method, COALESCE(disk_potency, ''));
CREATE INDEX idx_ast_isolate             ON susceptibility_tests(isolate_id);
CREATE INDEX idx_ast_antibiotic          ON susceptibility_tests(antibiotic_concept_id);
CREATE INDEX idx_ast_abx_code            ON susceptibility_tests(antibiotic_code);
CREATE INDEX idx_ast_interpretation      ON susceptibility_tests(interpretation);
CREATE INDEX idx_ast_abx_interp          ON susceptibility_tests(antibiotic_code, interpretation);
CREATE INDEX idx_ast_guideline           ON susceptibility_tests(guideline);

-- ----------------------------------------------------------------------------
-- breakpoints — interpretation criteria (CLSI, EUCAST, etc.)
-- One row per guideline + year + organism + antibiotic + test_method combo.
-- Matches WHONET Breakpoints.txt structure directly.
-- ----------------------------------------------------------------------------
CREATE TABLE breakpoints (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Guideline context
    guideline            VARCHAR(50)  NOT NULL,                 -- CLSI, EUCAST, DIN, BSAC, AFA, SFM, SRGA, NEO
    guideline_year       INTEGER      NOT NULL,
    breakpoint_type      VARCHAR(20)  NOT NULL DEFAULT 'Human', -- Human, Animal, ECOFF
    host                 VARCHAR(50),                            -- Human, Animal, etc.

    -- What this breakpoint applies to
    organism_code        VARCHAR(50),                            -- WHONET organism code (or genus/family code)
    organism_code_type   VARCHAR(50),                            -- WHONET_ORG_CODE, GENUS_CODE, FAMILY_CODE, SPECIES_GROUP, ALL, etc.
    antibiotic_code      VARCHAR(50)  NOT NULL,                  -- WHONET antibiotic code
    whonet_test          VARCHAR(50),                            -- Full WHONET test code (e.g. AMK_NM, AMK_ND30)

    -- Test method & context
    test_method          VARCHAR(20)  NOT NULL,                  -- MIC, DISK
    potency              VARCHAR(30),                            -- Disk potency (e.g. '30', '10')
    site_of_infection    VARCHAR(100),                           -- Meningitis, Respiratory, Urinary tract, etc.

    -- Breakpoint values (generic — meaning depends on test_method)
    -- For MIC: values in µg/mL; for DISK: values in mm zone diameter
    r                    VARCHAR(20),                            -- Resistant threshold
    i                    VARCHAR(20),                            -- Intermediate threshold
    sdd                  VARCHAR(20),                            -- Susceptible-Dose Dependent threshold
    s                    VARCHAR(20),                            -- Susceptible threshold
    ecv_ecoff            VARCHAR(20),                            -- Epidemiological cut-off value
    ecv_ecoff_tentative  VARCHAR(20),                            -- Tentative ECOFF

    -- Reference
    reference_table      VARCHAR(100),                           -- CLSI document table reference (e.g. "Table 2B-2")
    reference_sequence   VARCHAR(20),                            -- Ordering within reference table

    -- Metadata
    comments             TEXT,
    date_entered         DATE,
    date_modified        DATE,
    created_at           TIMESTAMPTZ  DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_bp_guideline            ON breakpoints(guideline, guideline_year);
CREATE INDEX idx_bp_org                  ON breakpoints(organism_code);
CREATE INDEX idx_bp_org_type             ON breakpoints(organism_code_type);
CREATE INDEX idx_bp_abx                  ON breakpoints(antibiotic_code);
CREATE INDEX idx_bp_org_abx              ON breakpoints(organism_code, antibiotic_code);
CREATE INDEX idx_bp_method               ON breakpoints(test_method);
CREATE INDEX idx_bp_type                 ON breakpoints(breakpoint_type);
CREATE INDEX idx_bp_whonet_test          ON breakpoints(whonet_test);
CREATE INDEX idx_bp_lookup               ON breakpoints(guideline, guideline_year, organism_code, antibiotic_code, test_method);

-- ----------------------------------------------------------------------------
-- qc_ranges — expected QC ranges for reference strains
-- Used to validate that AST systems are performing within acceptable limits.
-- Matches WHONET QC_Ranges.txt structure.
-- ----------------------------------------------------------------------------
CREATE TABLE qc_ranges (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Guideline context
    guideline            VARCHAR(50)  NOT NULL,
    guideline_year       INTEGER      NOT NULL,

    -- QC strain
    strain               VARCHAR(50)  NOT NULL,                  -- ATCC reference strain code (e.g. 'atcc25922')
    organism_code        VARCHAR(20),                             -- WHONET organism code for the strain

    -- Antibiotic tested
    antibiotic_name      VARCHAR(255),                            -- Display name
    antibiotic_code      VARCHAR(50)  NOT NULL,                   -- WHONET antibiotic code
    whonet_test          VARCHAR(50),                             -- Full WHONET test code (e.g. AMK_NM)

    -- Method
    test_method          VARCHAR(20)  NOT NULL,                   -- MIC, DISK
    medium               VARCHAR(50),                             -- Broth, Agar, Blood Agar, etc.

    -- Expected range
    range_min            VARCHAR(20),                             -- Minimum acceptable value
    range_max            VARCHAR(20),                             -- Maximum acceptable value

    -- Reference & metadata
    reference_table      VARCHAR(100),
    comments             TEXT,
    date_entered         DATE,
    date_modified        DATE,
    created_at           TIMESTAMPTZ  DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_qc_guideline            ON qc_ranges(guideline, guideline_year);
CREATE INDEX idx_qc_strain               ON qc_ranges(strain);
CREATE INDEX idx_qc_org                  ON qc_ranges(organism_code);
CREATE INDEX idx_qc_abx                  ON qc_ranges(antibiotic_code);
CREATE INDEX idx_qc_method               ON qc_ranges(test_method);
CREATE INDEX idx_qc_lookup               ON qc_ranges(guideline, guideline_year, strain, antibiotic_code, test_method);


-- ----------------------------------------------------------------------------
-- dosage — EUCAST standard/high dosage recommendations per antibiotic
-- Source: AMR-for-R dosage dataset
-- ----------------------------------------------------------------------------
CREATE TABLE dosage (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    antibiotic_code      VARCHAR(50)  NOT NULL,                  -- AMR package ab code (matches WHONET)
    antibiotic_name      VARCHAR(255),
    dosage_type          VARCHAR(50)  NOT NULL,                  -- standard_dosage, high_dosage, uncomplicated_uti
    dose                 VARCHAR(100),                           -- e.g. '1 g', '25-30 mg/kg'
    dose_times           INTEGER,                                -- frequency per day
    administration       VARCHAR(50),                            -- iv, oral, etc.
    notes                TEXT,
    original_txt         VARCHAR(255),                           -- original EUCAST text
    eucast_version       NUMERIC(5,1),                           -- EUCAST guideline version
    created_at           TIMESTAMPTZ  DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_dosage_abx              ON dosage(antibiotic_code);
CREATE INDEX idx_dosage_type             ON dosage(dosage_type);
CREATE INDEX idx_dosage_version          ON dosage(eucast_version);

-- ----------------------------------------------------------------------------
-- intrinsic_resistance — organism + antibiotic intrinsic resistance pairs
-- Source: AMR-for-R / EUCAST Expert Rules
-- Used to auto-flag impossible susceptibility results.
-- E.g. all Gram-positives are intrinsically resistant to Aztreonam.
-- ----------------------------------------------------------------------------
CREATE TABLE intrinsic_resistance (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organism_code        VARCHAR(50)  NOT NULL,                  -- AMR package mo code (e.g. B_GRAMP, B_ESCHR_COLI)
    antibiotic_code      VARCHAR(50)  NOT NULL,                  -- AMR package ab code (e.g. ATM, COL)
    created_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ir_unique        ON intrinsic_resistance(organism_code, antibiotic_code);
CREATE INDEX idx_ir_org                  ON intrinsic_resistance(organism_code);
CREATE INDEX idx_ir_abx                  ON intrinsic_resistance(antibiotic_code);

-- ----------------------------------------------------------------------------
-- organism_groups — organism complex/group memberships
-- Source: AMR-for-R microorganisms.groups
-- E.g. "Acinetobacter baumannii complex" contains A. baumannii, A. calcoaceticus, etc.
-- Used for breakpoint matching (some breakpoints target organism groups).
-- ----------------------------------------------------------------------------
CREATE TABLE organism_groups (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_code           VARCHAR(50)  NOT NULL,                  -- AMR mo code of the group
    member_code          VARCHAR(50)  NOT NULL,                  -- AMR mo code of the member
    group_name           VARCHAR(255),
    member_name          VARCHAR(255),
    created_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_og_unique        ON organism_groups(group_code, member_code);
CREATE INDEX idx_og_group                ON organism_groups(group_code);
CREATE INDEX idx_og_member               ON organism_groups(member_code);


-- ############################################################################
-- LAYER 6: TRIGGERS & FUNCTIONS
-- ############################################################################

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'coding_systems', 'concepts', 'concept_mappings',
            'facilities', 'data_sources', 'field_mappings',
            'patients', 'lab_requests', 'lab_results',
            'isolates', 'breakpoints', 'qc_ranges', 'dosage'
        ])
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
            t, t
        );
    END LOOP;
END;
$$;


-- ############################################################################
-- LAYER 7: ANALYTICS VIEWS
-- ############################################################################

-- Facility-level summary
CREATE OR REPLACE VIEW vw_facility_summary AS
SELECT
    f.facility_code,
    f.facility_name,
    f.country_code,
    COUNT(DISTINCT lr.id)           AS total_requests,
    COUNT(DISTINCT res.id)          AS total_results,
    COUNT(DISTINCT i.id)            AS total_isolates,
    MIN(lr.specimen_datetime)       AS earliest_specimen,
    MAX(lr.specimen_datetime)       AS latest_specimen
FROM facilities f
LEFT JOIN lab_requests lr  ON lr.facility_id = f.id
LEFT JOIN lab_results  res ON res.request_id = lr.id
LEFT JOIN isolates     i   ON i.request_id   = lr.id
GROUP BY f.id, f.facility_code, f.facility_name, f.country_code;

-- AMR resistance rate by organism + antibiotic (the money query)
CREATE OR REPLACE VIEW vw_resistance_rates AS
SELECT
    i.organism_code,
    COALESCE(oc.display_name, i.organism_name)       AS organism_name,
    st.antibiotic_code,
    COALESCE(ac.display_name, st.antibiotic_name)     AS antibiotic_name,
    st.guideline,
    COUNT(*)                                           AS total_tested,
    COUNT(*) FILTER (WHERE st.interpretation = 'R')    AS resistant,
    COUNT(*) FILTER (WHERE st.interpretation = 'I')    AS intermediate,
    COUNT(*) FILTER (WHERE st.interpretation = 'S')    AS susceptible,
    ROUND(
        COUNT(*) FILTER (WHERE st.interpretation = 'R') * 100.0 / NULLIF(COUNT(*), 0),
        1
    )                                                  AS resistance_pct
FROM susceptibility_tests st
JOIN isolates i             ON st.isolate_id = i.id
LEFT JOIN concepts oc       ON oc.id = i.organism_concept_id
LEFT JOIN concepts ac       ON ac.id = st.antibiotic_concept_id
GROUP BY i.organism_code, oc.display_name, i.organism_name,
         st.antibiotic_code, ac.display_name, st.antibiotic_name,
         st.guideline;

-- Cross-walk view: see all mappings for a concept in one row
CREATE OR REPLACE VIEW vw_concept_crosswalk AS
SELECT
    cs_from.system_code  AS from_system,
    c_from.concept_code  AS from_code,
    c_from.display_name  AS from_name,
    cm.map_type,
    cs_to.system_code    AS to_system,
    COALESCE(c_to.concept_code, cm.to_concept_code)  AS to_code,
    COALESCE(c_to.display_name, cm.to_concept_name)  AS to_name
FROM concept_mappings cm
JOIN concepts c_from         ON cm.from_concept_id = c_from.id
JOIN coding_systems cs_from  ON c_from.system_id = cs_from.id
LEFT JOIN concepts c_to      ON cm.to_concept_id = c_to.id
LEFT JOIN coding_systems cs_to ON c_to.system_id = cs_to.id;


-- ############################################################################
-- LAYER 8: SEED DATA — bootstrap the common coding systems
-- ############################################################################

INSERT INTO coding_systems (system_code, system_name, system_uri, system_type, owner) VALUES
    ('LOINC',       'Logical Observation Identifiers Names and Codes', 'http://loinc.org',                    'external', 'Regenstrief Institute'),
    ('ICD10',       'International Classification of Diseases 10',     'http://hl7.org/fhir/sid/icd-10',     'external', 'WHO'),
    ('ICD11',       'International Classification of Diseases 11',     'http://id.who.int/icd/release/11',   'external', 'WHO'),
    ('SNOMED_CT',   'SNOMED Clinical Terms',                           'http://snomed.info/sct',              'external', 'IHTSDO'),
    ('WHONET_ORG',  'WHONET Organism Codes',                           NULL,                                  'external', 'WHO Collaborating Centre'),
    ('WHONET_ABX',  'WHONET Antibiotic Codes',                         NULL,                                  'external', 'WHO Collaborating Centre'),
    ('WHONET_SPEC', 'WHONET Specimen Codes',                           NULL,                                  'external', 'WHO Collaborating Centre'),
    ('HL7_V2',      'HL7 Version 2 Tables',                            'http://terminology.hl7.org',          'external', 'HL7 International'),
    ('ATC',         'Anatomical Therapeutic Chemical Classification',   'http://www.whocc.no/atc',             'external', 'WHO Collaborating Centre'),
    ('LOCAL',       'Facility-Local Codes',                             NULL,                                  'local',    NULL),
    ('AMR_MO',      'AMR-for-R Microorganism Codes',                    'https://msberends.github.io/AMR/',    'external', 'AMR Package (msberends)'),
    ('AMR_AB',      'AMR-for-R Antimicrobial Codes',                    'https://msberends.github.io/AMR/',    'external', 'AMR Package (msberends)'),
    ('AMR_AV',      'AMR-for-R Antiviral Codes',                        'https://msberends.github.io/AMR/',    'external', 'AMR Package (msberends)')
ON CONFLICT (system_code) DO NOTHING;


-- ############################################################################
-- DONE
-- ############################################################################