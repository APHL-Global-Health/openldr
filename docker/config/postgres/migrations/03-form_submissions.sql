-- ============================================================================
-- form_submissions + form_responses — non-test "documentation" data
-- Parallel to lab_requests + lab_results but with NO specimen requirement.
-- Receives data from the "Built-in-Forms" data-feed via the forms plugin
-- chain. CLI emits these for documentation observations (e.g. Zambia VIRAL,
-- Tanzania VLID/EIDID) so they migrate as first-class records instead of
-- quarantining for the missing specimen.
-- ============================================================================

CREATE TABLE form_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL REFERENCES patients(id),
    facility_id         UUID NOT NULL REFERENCES facilities(id),
    source_system       VARCHAR(100),
    external_ref        VARCHAR(255) NOT NULL,            -- origin id (e.g. DISA lab number)
    submitted_at        TIMESTAMPTZ,
    related_request_id  UUID REFERENCES lab_requests(id), -- nullable; set on split records when lab leg is resolvable
    related_request_ref VARCHAR(255),                     -- raw external ref to lab leg (kept even if FK unresolved)
    form_code           VARCHAR(100),                     -- logical form code (e.g. hiv_vl_documentation)
    form_schema_id      UUID,                             -- optional; FK declared after formSchemas reachable
    submission_data     JSONB DEFAULT '{}',               -- full original payload for provenance
    -- import_batch_id intentionally has no ON DELETE clause: matches lab_requests
    -- convention (default RESTRICT — batches with attached submissions cannot be deleted).
    import_batch_id     UUID REFERENCES import_batches(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (external_ref, facility_id, form_code)
);

CREATE INDEX idx_form_submissions_patient        ON form_submissions(patient_id);
CREATE INDEX idx_form_submissions_facility       ON form_submissions(facility_id);
CREATE INDEX idx_form_submissions_external_ref   ON form_submissions(external_ref);
CREATE INDEX idx_form_submissions_form_code      ON form_submissions(form_code);
CREATE INDEX idx_form_submissions_submitted_at   ON form_submissions(submitted_at);
CREATE INDEX idx_form_submissions_related_req    ON form_submissions(related_request_id)
    WHERE related_request_id IS NOT NULL;
CREATE INDEX idx_form_submissions_data_gin       ON form_submissions USING gin(submission_data);

CREATE TRIGGER set_form_submissions_updated_at
    BEFORE UPDATE ON form_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- form_responses is INSERT-ONLY by design: no updated_at column, no trigger.
-- The persistence service treats responses as immutable per submission — on
-- re-ingest it DELETEs the prior set and INSERTs the fresh one transactionally.
CREATE TABLE form_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    concept_id      UUID REFERENCES concepts(id),                     -- resolved concept (nullable if unresolved)
    concept_code    VARCHAR(100),                                     -- raw code (e.g. ARTRS)
    concept_system  VARCHAR(50),                                      -- e.g. DEFAULT_RESULT
    value_type      VARCHAR(20) NOT NULL CHECK (value_type IN ('numeric','text','coded')),
    numeric_value   NUMERIC,
    text_value      TEXT,
    coded_value     VARCHAR(255),
    ordinal         INTEGER,
    raw_value       JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_form_responses_submission ON form_responses(submission_id);
CREATE INDEX idx_form_responses_concept    ON form_responses(concept_id)    WHERE concept_id IS NOT NULL;
CREATE INDEX idx_form_responses_code       ON form_responses(concept_code);
