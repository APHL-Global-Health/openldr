-- =============================================================================
-- FDW Setup: Connect PostgreSQL to MSSQL via tds_fdw
-- =============================================================================
-- Template parameters: {{host}}, {{port}}, {{username}}, {{password}}
-- These are substituted server-side by the exec endpoint.

-- Enable the extension
CREATE EXTENSION IF NOT EXISTS tds_fdw;

-- Create schemas for organizing foreign tables and views
CREATE SCHEMA IF NOT EXISTS disa;           -- parsed views and utility functions
CREATE SCHEMA IF NOT EXISTS disa_global;    -- foreign tables from DisaGlobal DB
CREATE SCHEMA IF NOT EXISTS disalab_dict;   -- foreign tables from DisalabDict DB
CREATE SCHEMA IF NOT EXISTS disalab_data;   -- foreign tables from DisalabData DB

-- =============================================================================
-- Foreign Servers (one per MSSQL database)
-- =============================================================================

DROP SERVER IF EXISTS mssql_disa_global CASCADE;
CREATE SERVER mssql_disa_global
    FOREIGN DATA WRAPPER tds_fdw
    OPTIONS (servername '{{host}}', port '{{port}}', database 'DisaGlobal', tds_version '7.4');

DROP SERVER IF EXISTS mssql_disalab_dict CASCADE;
CREATE SERVER mssql_disalab_dict
    FOREIGN DATA WRAPPER tds_fdw
    OPTIONS (servername '{{host}}', port '{{port}}', database 'DisalabDict', tds_version '7.4');

DROP SERVER IF EXISTS mssql_disalab_data CASCADE;
CREATE SERVER mssql_disalab_data
    FOREIGN DATA WRAPPER tds_fdw
    OPTIONS (servername '{{host}}', port '{{port}}', database 'DisalabData', tds_version '7.4');

-- =============================================================================
-- User Mappings
-- =============================================================================

CREATE USER MAPPING IF NOT EXISTS FOR postgres
    SERVER mssql_disa_global
    OPTIONS (username '{{username}}', password '{{password}}');

CREATE USER MAPPING IF NOT EXISTS FOR postgres
    SERVER mssql_disalab_dict
    OPTIONS (username '{{username}}', password '{{password}}');

CREATE USER MAPPING IF NOT EXISTS FOR postgres
    SERVER mssql_disalab_data
    OPTIONS (username '{{username}}', password '{{password}}');
