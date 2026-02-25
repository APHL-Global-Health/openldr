-- Connect to the new database 
\c openldr

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid() on PG < 14

-- ============================================================
-- UTILITY: auto-update updatedAt timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE "enum_extensionUsers_status" AS ENUM (
    'installed',
    'enabled',
    'disabled',
    'uninstalled'
);

CREATE TYPE "enum_formSchemas_schemaType" AS ENUM (
    'form',
    'archive'
);

CREATE TYPE "enum_plugins_pluginType" AS ENUM (
    'schema',
    'mapper',
    'recipient'
);

CREATE TYPE "enum_plugins_securityLevel" AS ENUM (
    'low',
    'medium',
    'high'
);

-- ============================================================
-- TABLES
-- ============================================================

-- ----------------------------------------------------------
-- users
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
    "userId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "firstName" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "phoneNumber" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON "users"
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ----------------------------------------------------------
-- projects
-- ----------------------------------------------------------
CREATE TABLE projects (
    "projectId"   uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectName" varchar(255) NOT NULL CHECK ("projectName" <> ''),
    description   varchar(255),
    "isEnabled"   boolean DEFAULT true NOT NULL,
    "createdAt"   timestamptz(6) NOT NULL DEFAULT now(),
    "updatedAt"   timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT projects_pkey PRIMARY KEY ("projectId")
);

CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ----------------------------------------------------------
-- useCases
-- ----------------------------------------------------------
CREATE TABLE "useCases" (
    "useCaseId"   uuid DEFAULT gen_random_uuid() NOT NULL,
    "useCaseName" varchar(255) NOT NULL CHECK ("useCaseName" <> ''),
    description   varchar(255),
    "isEnabled"   boolean DEFAULT true NOT NULL,
    "createdAt"   timestamptz(6) NOT NULL DEFAULT now(),
    "updatedAt"   timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT "useCases_pkey" PRIMARY KEY ("useCaseId")
);

CREATE TRIGGER "set_useCases_updated_at"
    BEFORE UPDATE ON "useCases"
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ----------------------------------------------------------
-- facilities
-- ----------------------------------------------------------
CREATE TABLE facilities (
    "facilityId"      uuid DEFAULT gen_random_uuid() NOT NULL,
    "facilityCode"    varchar(255) NOT NULL CHECK ("facilityCode" <> ''),
    "facilityName"    varchar(255) NOT NULL CHECK ("facilityName" <> ''),
    "facilityType"    varchar(255) NOT NULL,
    description       varchar(255),
    "countryCode"     varchar(10) NOT NULL,
    "provinceCode"    varchar(50) NOT NULL,
    "regionCode"      varchar(50) NOT NULL,
    "districtCode"    varchar(50) NOT NULL,
    "subDistrictCode" varchar(50) NOT NULL,
    latitude          numeric(10, 7),
    longitude         numeric(10, 7),
    "createdAt"       timestamptz(6) NOT NULL DEFAULT now(),
    "updatedAt"       timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT facilities_pkey PRIMARY KEY ("facilityId")
);

CREATE UNIQUE INDEX idx_facilities_code ON facilities ("facilityCode");
CREATE INDEX idx_facilities_country ON facilities ("countryCode");
CREATE INDEX idx_facilities_region ON facilities ("countryCode", "provinceCode", "regionCode");

CREATE TRIGGER set_facilities_updated_at
    BEFORE UPDATE ON facilities
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ----------------------------------------------------------
-- plugins
-- ----------------------------------------------------------
CREATE TABLE plugins (
    "pluginId"               uuid DEFAULT gen_random_uuid() NOT NULL,
    "pluginType"             "enum_plugins_pluginType" NOT NULL,
    "pluginName"             varchar(255) NOT NULL CHECK ("pluginName" <> ''),
    "pluginVersion"          varchar(255) NOT NULL,
    "pluginMinioObjectPath"  varchar(255) NOT NULL,
    "securityLevel"          "enum_plugins_securityLevel" DEFAULT 'high' NOT NULL,
    config                   jsonb,
    notes                    varchar(2000),
    "createdAt"              timestamptz(6) NOT NULL DEFAULT now(),
    "updatedAt"              timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT plugins_pkey PRIMARY KEY ("pluginId")
);

COMMENT ON COLUMN plugins."pluginMinioObjectPath"
    IS 'Path to the plugin file in MinIO storage';

CREATE INDEX idx_plugins_type ON plugins ("pluginType");

CREATE TRIGGER set_plugins_updated_at
    BEFORE UPDATE ON plugins
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ----------------------------------------------------------
-- dataFeeds
-- ----------------------------------------------------------
CREATE TABLE "dataFeeds" (
    "dataFeedId"      uuid DEFAULT gen_random_uuid() NOT NULL,
    "dataFeedName"    varchar(255) NOT NULL CHECK ("dataFeedName" <> ''),
    "facilityId"      uuid NOT NULL,
    "schemaPluginId"  uuid,
    "mapperPluginId"  uuid,
    "recipientPluginId" uuid,
    "projectId"       uuid NOT NULL,
    "useCaseId"       uuid NOT NULL,
    "isEnabled"       boolean DEFAULT true NOT NULL,
    "isProtected"     boolean DEFAULT false NOT NULL,
    "createdAt"       timestamptz(6) NOT NULL DEFAULT now(),
    "updatedAt"       timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT "dataFeeds_pkey" PRIMARY KEY ("dataFeedId"),

    -- Foreign keys (were completely missing)
    CONSTRAINT "dataFeeds_facilityId_fkey"
        FOREIGN KEY ("facilityId") REFERENCES facilities("facilityId")
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT "dataFeeds_schemaPluginId_fkey"
        FOREIGN KEY ("schemaPluginId") REFERENCES plugins("pluginId")
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT "dataFeeds_mapperPluginId_fkey"
        FOREIGN KEY ("mapperPluginId") REFERENCES plugins("pluginId")
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT "dataFeeds_recipientPluginId_fkey"
        FOREIGN KEY ("recipientPluginId") REFERENCES plugins("pluginId")
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT "dataFeeds_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES projects("projectId")
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT "dataFeeds_useCaseId_fkey"
        FOREIGN KEY ("useCaseId") REFERENCES "useCases"("useCaseId")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Indexes on all FK columns for JOIN performance
CREATE INDEX idx_datafeeds_facility   ON "dataFeeds" ("facilityId");
CREATE INDEX idx_datafeeds_project    ON "dataFeeds" ("projectId");
CREATE INDEX idx_datafeeds_usecase    ON "dataFeeds" ("useCaseId");
CREATE INDEX idx_datafeeds_schema_plugin    ON "dataFeeds" ("schemaPluginId")    WHERE "schemaPluginId" IS NOT NULL;
CREATE INDEX idx_datafeeds_mapper_plugin    ON "dataFeeds" ("mapperPluginId")    WHERE "mapperPluginId" IS NOT NULL;
CREATE INDEX idx_datafeeds_recipient_plugin ON "dataFeeds" ("recipientPluginId") WHERE "recipientPluginId" IS NOT NULL;

-- Partial index: only enabled feeds (common query pattern)
CREATE INDEX idx_datafeeds_enabled ON "dataFeeds" ("facilityId", "projectId") WHERE "isEnabled" = true;

CREATE TRIGGER "set_dataFeeds_updated_at"
    BEFORE UPDATE ON "dataFeeds"
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ----------------------------------------------------------
-- formSchemas
-- ----------------------------------------------------------
CREATE TABLE "formSchemas" (
    "schemaId"   uuid DEFAULT gen_random_uuid() NOT NULL,
    "schemaName" varchar(255) NOT NULL CHECK ("schemaName" <> ''),
    "schemaType" "enum_formSchemas_schemaType" DEFAULT 'form' NOT NULL,
    version      varchar(50) DEFAULT '1.0.0' NOT NULL,
    schema       json NOT NULL,
    "dataFeedId" uuid,
    "isActive"   boolean DEFAULT true NOT NULL,
    "createdAt"  timestamptz(6) NOT NULL DEFAULT now(),
    "updatedAt"  timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT "formSchemas_pkey" PRIMARY KEY ("schemaId"),

    -- Foreign key (was missing)
    CONSTRAINT "formSchemas_dataFeedId_fkey"
        FOREIGN KEY ("dataFeedId") REFERENCES "dataFeeds"("dataFeedId")
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_formschemas_datafeed ON "formSchemas" ("dataFeedId") WHERE "dataFeedId" IS NOT NULL;
CREATE INDEX idx_formschemas_active   ON "formSchemas" ("schemaType") WHERE "isActive" = true;

CREATE TRIGGER "set_formSchemas_updated_at"
    BEFORE UPDATE ON "formSchemas"
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Seed required data using gen_random_uuid() for deterministic UUIDs
-- Using DO block so we can use variables for the UUIDs and handle duplicates gracefully
DO $$
DECLARE
    v_facilities   uuid := gen_random_uuid();
    v_projects     uuid := gen_random_uuid();
    v_usecases     uuid := gen_random_uuid();
    v_plugins      uuid := gen_random_uuid();
    v_mapper       uuid := gen_random_uuid();
    v_users        uuid := gen_random_uuid();
    v_datafeeds    uuid := gen_random_uuid();
    v_formschemas  uuid := gen_random_uuid();
BEGIN
    INSERT INTO "formSchemas" ("schemaId", "schemaName", "schemaType", "version", "schema", "isActive", "createdAt", "updatedAt")
    VALUES
    (v_facilities, 'facilities', 'archive', 'Internal',
     '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"facilities Schema","description":"From Internal","type":"object","properties":{"facilityCode":{"type":"string","maxLength":255},"facilityName":{"type":"string","maxLength":255},"facilityType":{"type":"string","maxLength":255},"description":{"type":"string","maxLength":255},"countryCode":{"type":"string","maxLength":255},"provinceCode":{"type":"string","maxLength":255},"regionCode":{"type":"string","maxLength":255},"districtCode":{"type":"string","maxLength":255},"subDistrictCode":{"type":"string","maxLength":255},"lattLong":{"type":"string","maxLength":255}},"required":["facilityCode","facilityName","facilityType","countryCode","provinceCode","regionCode","districtCode","subDistrictCode"],"additionalProperties":false}'::json,
     true, NOW(), NOW()),

    (v_projects, 'projects', 'archive', 'Internal',
     '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"projects Schema","description":"From Internal","type":"object","properties":{"projectName":{"type":"string","maxLength":255},"description":{"type":"string","maxLength":255},"isEnabled":{"type":"boolean"}},"required":["projectName"],"additionalProperties":false}'::json,
     true, NOW(), NOW()),

    (v_usecases, 'useCases', 'archive', 'Internal',
     '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"useCases Schema","description":"From Internal","type":"object","properties":{"useCaseName":{"type":"string","maxLength":255},"description":{"type":"string","maxLength":255},"isEnabled":{"type":"boolean"}},"required":["useCaseName"],"additionalProperties":false}'::json,
     true, NOW(), NOW()),

    (v_plugins, 'plugins', 'archive', 'Internal',
     '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"plugins Schema","description":"From Internal","type":"object","properties":{"pluginType":{"type":["object","string"],"x-zodType":"options","x-zodOptions":[["schema","schema"],["recipient","recipient"]]},"pluginName":{"type":"string","maxLength":255},"pluginVersion":{"type":"string","maxLength":255},"pluginMinioObjectPath":{"type":["object","string"],"x-zodType":"file","x-zodFile":{"mimes":[".js",".ts",".json"]}},"securityLevel":{"type":["object","string"],"x-zodType":"options","x-zodOptions":[["low","low"],["medium","medium"],["high","high"]]},"config":{"type":["object","string"]},"notes":{"type":"string","maxLength":2000}},"required":["pluginType","pluginName","pluginVersion","pluginMinioObjectPath","securityLevel"],"additionalProperties":false}'::json,
     true, NOW(), NOW()),

    (v_mapper, 'mapper', 'archive', 'Internal',
     '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"plugins Schema","description":"From Internal","type":"object","properties":{"pluginType":{"type":["object","string"],"x-zodType":"options","x-zodOptions":[["mapper","mapper"]]},"pluginName":{"type":"string","minLength":2,"maxLength":100},"pluginVersion":{"type":"string","fpattern":"^d+.d+.d+$"},"pluginMinioObjectPath":{"type":"string","readOnly":true},"securityLevel":{"type":["object","string"],"x-zodType":"options","x-zodOptions":[["low","low"],["medium","medium"],["high","high"]]},"notes":{"type":"string","maxLength":2000},"oclUrl":{"type":"string","format":"url"},"orgId":{"type":"string","minLength":1},"sourceId":{"type":"string","minLength":1},"auth":{"type":"string"}},"required":["pluginType","pluginName","pluginVersion","securityLevel","oclUrl","orgId","sourceId"],"additionalProperties":false}'::json,
     true, NOW(), NOW()),

    (v_users, 'users', 'archive', 'Internal',
     '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"users Schema","description":"From Internal","type":"object","properties":{"firstName":{"type":"string","maxLength":255},"lastName":{"type":"string","maxLength":255},"email":{"type":"string","maxLength":255},"phoneNumber":{"type":"string","maxLength":255}},"required":["firstName","lastName","email","phoneNumber"],"additionalProperties":false}'::json,
     true, NOW(), NOW()),

    (v_datafeeds, 'dataFeeds', 'archive', 'Internal',
     '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"dataFeeds Schema","description":"From Internal","type":"object","properties":{"dataFeedName":{"type":"string","maxLength":255},"facilityId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"facilities","key":"facilityId","attributes":["facilityCode","facilityName"]}},"schemaPluginId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"plugins","key":"pluginId","attributes":["pluginType","pluginName","pluginVersion","securityLevel"]}},"mapperPluginId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"plugins","key":"pluginId","attributes":["pluginType","pluginName","pluginVersion","securityLevel"]}},"recipientPluginId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"plugins","key":"pluginId","attributes":["pluginType","pluginName","pluginVersion","securityLevel"]}},"projectId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"projects","key":"projectId","attributes":["projectName","description","isEnabled"]}},"useCaseId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"useCases","key":"useCaseId","attributes":["useCaseName","description","isEnabled"]}},"isEnabled":{"type":"boolean"},"isProtected":{"type":"boolean"}},"required":["dataFeedName","facilityId","projectId","useCaseId","isEnabled","isProtected"],"additionalProperties":false}'::json,
     true, NOW(), NOW()),

    (v_formschemas, 'formSchemas', 'archive', 'Internal',
     '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"formSchemas Schema","description":"From Internal","type":"object","properties":{"schemaName":{"type":"string","maxLength":255},"schemaType":{"type":["object","string"],"x-zodType":"options","x-zodOptions":[["form","form"],["archive","archive"]]},"version":{"type":"string","maxLength":255},"schema":{"type":["object","string"]},"dataFeedId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"dataFeeds","key":"dataFeedId","attributes":["dataFeedName","createdAt","updatedAt"]}},"isActive":{"type":"boolean"}},"required":["schemaName","schemaType","version","schema","isActive"],"additionalProperties":false}'::json,
     true, NOW(), NOW())

    ON CONFLICT ("schemaId") DO NOTHING;
END $$;

-- ----------------------------------------------------------
-- notifications
-- ----------------------------------------------------------
CREATE TABLE notifications (
    "notificationId"   uuid DEFAULT gen_random_uuid() NOT NULL,
    "notificationType" varchar(255) NOT NULL,
    "timestamp"        timestamptz NOT NULL DEFAULT now(),
    title              varchar(255),
    content            text,
    "isRead"           boolean DEFAULT false NOT NULL,
    "expireOn"         timestamptz NOT NULL,
    "createdAt"        timestamptz(6) NOT NULL DEFAULT now(),
    "updatedAt"        timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT notifications_pkey PRIMARY KEY ("notificationId")
);

-- Unread notifications are the most common query
CREATE INDEX idx_notifications_unread ON notifications ("timestamp" DESC) WHERE "isRead" = false;
CREATE INDEX idx_notifications_expire ON notifications ("expireOn") WHERE "isRead" = false;

CREATE TRIGGER set_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ----------------------------------------------------------
-- extensions
-- ----------------------------------------------------------
CREATE TABLE extensions (
  id                TEXT        PRIMARY KEY,
  name              TEXT        NOT NULL,
  version           TEXT        NOT NULL,
  description       TEXT        NOT NULL,
  kind              TEXT        NOT NULL CHECK (kind IN ('worker', 'iframe')),
  slot              TEXT        CHECK (slot IN ('main', 'secondary', 'sidebar')),
  activation_events JSONB       NOT NULL DEFAULT '[]',
  contributes       JSONB       NOT NULL DEFAULT '{"commands":[],"views":[]}',
  author            TEXT        NOT NULL,
  icon              TEXT        NOT NULL,
  integrity         TEXT        NOT NULL,
  permissions       JSONB       NOT NULL DEFAULT '[]',
  storage_key       TEXT        NOT NULL,
  published_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User extension installs (keycloak sub → extension_id)
CREATE TABLE "userExtensions" (
  user_id              TEXT        NOT NULL,
  extension_id         TEXT        NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
  installed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_permissions JSONB       NOT NULL DEFAULT '[]',
  settings             JSONB       NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, extension_id)
);

CREATE INDEX IF NOT EXISTS idx_user_extensions_user_id ON "userExtensions"(user_id);
CREATE INDEX IF NOT EXISTS idx_extensions_kind ON extensions(kind);