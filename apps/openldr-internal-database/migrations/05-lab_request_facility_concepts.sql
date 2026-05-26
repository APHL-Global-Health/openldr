-- ============================================================================
-- Migration: lab_requests — replace requesting_facility / testing_facility text
-- columns with concept_id FKs into the terminology layer.
--
-- Applied to existing dev/prod DBs. Fresh databases get the same shape directly
-- from 02-openldr_external.sql.
-- ============================================================================

ALTER TABLE lab_requests
    DROP COLUMN IF EXISTS requesting_facility,
    DROP COLUMN IF EXISTS testing_facility,
    ADD COLUMN  IF NOT EXISTS requesting_facility_concept_id UUID REFERENCES concepts(id),
    ADD COLUMN  IF NOT EXISTS testing_facility_concept_id    UUID REFERENCES concepts(id);

CREATE INDEX IF NOT EXISTS idx_requests_req_facility_concept
    ON lab_requests(requesting_facility_concept_id);

CREATE INDEX IF NOT EXISTS idx_requests_test_facility_concept
    ON lab_requests(testing_facility_concept_id);
