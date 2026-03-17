-- =============================================================================
-- Run the DISA specimen receipt migration
-- Calls disa.specimen_receipt_migrate() and returns a summary count.
-- The actual rows are written to disa.migration_results for downstream use.
-- =============================================================================

-- Create the results table if it doesn't exist
CREATE TABLE IF NOT EXISTS disa.migration_results AS
  SELECT * FROM disa.specimen_receipt_migrate(NULL) LIMIT 0;

-- Truncate for a fresh migration run
TRUNCATE disa.migration_results;

-- Run migration and store results
INSERT INTO disa.migration_results
  SELECT * FROM disa.specimen_receipt_migrate(NULL);

-- Return summary
SELECT count(*)::int AS total_rows,
       min(registered_datetime)::text AS earliest,
       max(registered_datetime)::text AS latest,
       count(DISTINCT facility_code)::int AS facility_count,
       count(DISTINCT lab_number)::int AS unique_labs
  FROM disa.migration_results;
