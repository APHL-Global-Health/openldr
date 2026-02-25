CREATE DATABASE openldr_external;

-- Connect to the new database (PostgreSQL syntax)
\c openldr_external

-- OpenLDR Lab Data Database Schema
-- Initialization script for PostgreSQL with JSONB support
-- Language: PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
    patients_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id VARCHAR(255) NOT NULL, -- PatientID from message
    facility_code VARCHAR(100) NOT NULL, -- Facility code from message
    facility_id VARCHAR(36), -- References internal database Facility.facilityId
    facility_name VARCHAR(255), -- Facility name for display
    
    patient_data JSONB, -- All patient fields as JSONB
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Composite unique constraint
    UNIQUE(patient_id, facility_code)
);

-- Create lab_requests table
CREATE TABLE IF NOT EXISTS lab_requests (
    lab_requests_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(255) NOT NULL, -- RequestID from message
    facility_code VARCHAR(100) NOT NULL,-- Facility code from message
    facility_id VARCHAR(36), -- References internal database Facility.facilityId
    facility_name VARCHAR(255), -- Facility name for display
    patient_id VARCHAR(255), -- decoupled link to patients table

    -- Core request fields for fast lookups
    obr_set_id INTEGER NULL,
    panel_code VARCHAR(100),
    panel_desc VARCHAR(255),
    specimen_datetime TIMESTAMP, -- When specimen was collected
    
    request_data JSONB, -- All other request fields as JSONB
    mappings JSONB, -- OCL mappings for terminology queries
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key to patients (using patient_id and facility_code)
    FOREIGN KEY (patient_id, facility_code) REFERENCES patients(patient_id, facility_code),
    
    -- Composite unique constraint
    UNIQUE(request_id, obr_set_id, facility_code)
);

-- Create lab_results table
CREATE TABLE IF NOT EXISTS lab_results (
    lab_results_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_requests_id UUID NOT NULL,
    
    -- Core result fields for fast lookups
    obx_set_id INTEGER NULL,
    observation_code VARCHAR(100),
    observation_desc VARCHAR(255),
    rpt_result TEXT,
    rpt_units VARCHAR(50),
    rpt_flag VARCHAR(10),
    result_timestamp TIMESTAMP, -- When result was finalized/reported
    
    result_data JSONB, -- All other result fields as JSONB
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Foreign key to lab_requests
    FOREIGN KEY (lab_requests_id) REFERENCES lab_requests(lab_requests_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_facility ON patients(facility_code);
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_composite ON patients(patient_id, facility_code);
CREATE INDEX IF NOT EXISTS idx_patients_json ON patients USING GIN(patient_data);

CREATE INDEX IF NOT EXISTS idx_lab_requests_facility ON lab_requests(facility_code);
CREATE INDEX IF NOT EXISTS idx_lab_requests_facility_id ON lab_requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_lab_requests_composite ON lab_requests(request_id, obr_set_id, facility_code);
CREATE INDEX IF NOT EXISTS idx_lab_requests_panel_code ON lab_requests(panel_code);
CREATE INDEX IF NOT EXISTS idx_lab_requests_patient ON lab_requests(patient_id, facility_code);
CREATE INDEX IF NOT EXISTS idx_lab_requests_specimen_datetime ON lab_requests(specimen_datetime);
CREATE INDEX IF NOT EXISTS idx_lab_requests_json ON lab_requests USING GIN(request_data);
CREATE INDEX IF NOT EXISTS idx_lab_requests_mappings ON lab_requests USING GIN(mappings);

-- CREATE INDEX IF NOT EXISTS idx_lab_results_composite ON lab_results(lab_requests_id, request_id, obx_set_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_requests_id ON lab_results(lab_requests_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_observation_code ON lab_results(observation_code);
CREATE INDEX IF NOT EXISTS idx_lab_results_rpt_flag ON lab_results(rpt_flag);
CREATE INDEX IF NOT EXISTS idx_lab_results_timestamp ON lab_results(result_timestamp);
CREATE INDEX IF NOT EXISTS idx_lab_results_json ON lab_results USING GIN(result_data);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_patients_updated_at 
    BEFORE UPDATE ON patients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lab_requests_updated_at 
    BEFORE UPDATE ON lab_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW lab_data_summary AS
SELECT 
    lr.facility_code,
    lr.facility_id,
    lr.facility_name,
    COUNT(DISTINCT lr.request_id) as total_requests,
    COUNT(DISTINCT lres.lab_results_id) as total_results
FROM lab_requests lr
LEFT JOIN lab_results lres ON lr.lab_requests_id = lres.lab_requests_id
GROUP BY lr.facility_code, lr.facility_id, lr.facility_name;

-- Grant permissions to the lab_data_user
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lab_data_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lab_data_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO lab_data_user;
-- GRANT SELECT ON ALL VIEWS IN SCHEMA public TO lab_data_user; 