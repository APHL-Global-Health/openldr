import { services, docker } from "@repo/openldr-core";
import { DynamicModelManager } from "@openldr/internal-database";
import path from "path";

const FORM_SCHEMA_FEED_GENERAL = "bcfbf5a7-6b4c-488f-9abe-7637bd4dfeff";
const ARCHIVE_SCHEMA_FEED_FACILITIES = "ccda404a-2bb4-410d-af94-377618ee27a0";
const ARCHIVE_SCHEMA_FEED_FORMSCHEMAS = "f7eed492-e065-4a60-a30f-b5fce2009d5c";
const ARCHIVE_SCHEMA_FEED_DATAFEEDS = "6330551d-619a-4876-948d-b2cb59e75cef";
const ARCHIVE_SCHEMA_FEED_PLUGINS = "7e5198f2-e4fb-4129-8935-64b76fc3fa60";
const ARCHIVE_SCHEMA_FEED_USECASES = "9d4fd3f4-04da-44c8-a32d-04bbf39dba10";
const ARCHIVE_SCHEMA_FEED_PROJECTS = "3a057729-88ac-4ef1-9498-e832d955c0ef";
const ARCHIVE_SCHEMA_FEED_MAPPER = "dc57df71-f2a0-47c9-9492-b4cde51427e8";
const ARCHIVE_SCHEMA_FEED_USERS = "c25c235c-d935-461a-a4e4-25adcd922c60";

const Config = {
  mysql: {
    dialect: "mysql",
    database: process.env.MYSQL_DB || "openldr",
    user: process.env.MYSQL_USER || "openldr",
    password: process.env.MYSQL_PASSWORD || null,
    host: "127.0.0.1",
    port: process.env.MYSQL_PORT || 3306,
    pool: {
      maxConnections: process.env.MYSQL_POOL_MAX || 5,
      maxIdleTime: process.env.MYSQL_POOL_IDLE || 3000,
    },
  },

  postgres: {
    dialect: "postgres",
    database: process.env.POSTGRES_DB || "openldr",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || null,
    host: "127.0.0.1",
    port: process.env.POSTGRES_PORT || 5432,
    pool: {
      maxConnections: process.env.POSTGRES_POOL_MAX || 5,
      maxIdleTime: process.env.POSTGRES_POOL_IDLE || 3000,
    },
  },

  sqlite3: {
    dialect: "sqlite3",
    storage: "openldr.sqlite",
  },
};

const insertTestData = async (modelManager: DynamicModelManager) => {
  let quoteStyle = "`";
  if (process.env.INTERNAL_DB_PREFERRED_DIALET == "postgres") quoteStyle = `"`;

  const scripts = [
    `
    -- Create OpenLDR Project
    INSERT INTO ${quoteStyle}projects${quoteStyle} (
        ${quoteStyle}projectId${quoteStyle},
        ${quoteStyle}projectName${quoteStyle},
        ${quoteStyle}description${quoteStyle},
        ${quoteStyle}isEnabled${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.OPENLDR_PROJECT_ID}',
        'ELR',
        'Electronic Laboratory Reporting',
        TRUE,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create Use Cases
    INSERT INTO ${quoteStyle}useCases${quoteStyle} (
        ${quoteStyle}useCaseId${quoteStyle},
        ${quoteStyle}useCaseName${quoteStyle},
        ${quoteStyle}description${quoteStyle},
        ${quoteStyle}isEnabled${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.MANUAL_ENTRY_USE_CASE_ID}',
        'Manual Entry Lab Data',
        'Use case for manual data entry through the web interface for lab data',
        TRUE,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    INSERT INTO ${quoteStyle}useCases${quoteStyle} (
        ${quoteStyle}useCaseId${quoteStyle},
        ${quoteStyle}useCaseName${quoteStyle},
        ${quoteStyle}description${quoteStyle},
        ${quoteStyle}isEnabled${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.DATA_FEED_USE_CASE_ID}',
        'OpenLDRv2 HL7',
        'Use case for consuming HL7 messages from LIMS',
        TRUE,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create test schema plugins
    INSERT INTO ${quoteStyle}plugins${quoteStyle} (
        ${quoteStyle}pluginId${quoteStyle},
        ${quoteStyle}pluginName${quoteStyle},
        ${quoteStyle}pluginType${quoteStyle},
        ${quoteStyle}pluginVersion${quoteStyle},
        ${quoteStyle}pluginMinioObjectPath${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.TEST_PLUGIN_SCHEMA_ID}',
        'Test Schema Plugin',
        'schema',
        '1.0.0',
        CONCAT('${
          process.env.TEST_PLUGIN_SCHEMA_ID
        }', '/schema-validation-hl7.js'),
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create test mapper plugin
    INSERT INTO ${quoteStyle}plugins${quoteStyle} (
        ${quoteStyle}pluginId${quoteStyle},
        ${quoteStyle}pluginName${quoteStyle},
        ${quoteStyle}pluginType${quoteStyle},
        ${quoteStyle}pluginVersion${quoteStyle},
        ${quoteStyle}pluginMinioObjectPath${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.TEST_PLUGIN_MAPPER_ID}',
        'Test Mapper Plugin',
        'mapper',
        '1.0.0',
        CONCAT('${
          process.env.TEST_PLUGIN_MAPPER_ID
        }', '/terminology-mapping-zlab.json'),
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create test recipient plugin
    INSERT INTO ${quoteStyle}plugins${quoteStyle} (
        ${quoteStyle}pluginId${quoteStyle},
        ${quoteStyle}pluginName${quoteStyle},
        ${quoteStyle}pluginType${quoteStyle},
        ${quoteStyle}pluginVersion${quoteStyle},
        ${quoteStyle}pluginMinioObjectPath${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.TEST_PLUGIN_RECIPIENT_ID}',
        'Test Recipient Plugin',
        'recipient',
        '1.0.0',
        CONCAT('${
          process.env.TEST_PLUGIN_RECIPIENT_ID
        }', '/recipient-lab-data.js'),
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create manual entry recipient plugin
    INSERT INTO ${quoteStyle}plugins${quoteStyle} (
        ${quoteStyle}pluginId${quoteStyle},
        ${quoteStyle}pluginName${quoteStyle},
        ${quoteStyle}pluginType${quoteStyle},
        ${quoteStyle}pluginVersion${quoteStyle},
        ${quoteStyle}pluginMinioObjectPath${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.TEST_PLUGIN_RECIPIENT_MANUAL_ENTRY_ID}',
        'Manual Entry Recipient Plugin',
        'recipient',
        '1.0.0',
        CONCAT('${
          process.env.TEST_PLUGIN_RECIPIENT_MANUAL_ENTRY_ID
        }', '/recipient-manual-entry-lab-data.js'),
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create default manual entry facility
    INSERT INTO ${quoteStyle}facilities${quoteStyle} (
        ${quoteStyle}facilityId${quoteStyle},
        ${quoteStyle}facilityCode${quoteStyle},
        ${quoteStyle}facilityName${quoteStyle},
        ${quoteStyle}facilityType${quoteStyle},
        ${quoteStyle}description${quoteStyle},
        ${quoteStyle}countryCode${quoteStyle},
        ${quoteStyle}provinceCode${quoteStyle},
        ${quoteStyle}regionCode${quoteStyle},
        ${quoteStyle}districtCode${quoteStyle},
        ${quoteStyle}subDistrictCode${quoteStyle},
        ${quoteStyle}lattLong${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.DEFAULT_MANUAL_ENTRY_FACILITY_ID}',
        'DEF001',
        'OpenLDR Manual Entry',
        'Default',
        'OpenLDR Default Facility for Manual Data Entry',
        'US',
        'FL',
        'DEF',
        'DEF',
        'DEF',
        '0,0',
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create test facility
    INSERT INTO ${quoteStyle}facilities${quoteStyle} (
        ${quoteStyle}facilityId${quoteStyle},
        ${quoteStyle}facilityCode${quoteStyle},
        ${quoteStyle}facilityName${quoteStyle},
        ${quoteStyle}facilityType${quoteStyle},
        ${quoteStyle}description${quoteStyle},
        ${quoteStyle}countryCode${quoteStyle},
        ${quoteStyle}provinceCode${quoteStyle},
        ${quoteStyle}regionCode${quoteStyle},
        ${quoteStyle}districtCode${quoteStyle},
        ${quoteStyle}subDistrictCode${quoteStyle},
        ${quoteStyle}lattLong${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.TEST_FACILITY_ID}',
        'TEST001',
        'Z-Lab-Facility',
        'TEST',
        'Test Facility for Development',
        'US',
        'FL',
        'TEST',
        'TEST',
        'TEST',
        '0,0',
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Now create the default manual data entry feed for the default facilities
    INSERT INTO ${quoteStyle}dataFeeds${quoteStyle} (
        ${quoteStyle}dataFeedId${quoteStyle},
        ${quoteStyle}facilityId${quoteStyle},
        ${quoteStyle}projectId${quoteStyle},
        ${quoteStyle}useCaseId${quoteStyle},
        ${quoteStyle}dataFeedName${quoteStyle},
        ${quoteStyle}schemaPluginId${quoteStyle},
        ${quoteStyle}mapperPluginId${quoteStyle},
        ${quoteStyle}recipientPluginId${quoteStyle},
        ${quoteStyle}isEnabled${quoteStyle},
        ${quoteStyle}isProtected${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.DEFAULT_MANUAL_ENTRY_DATA_FEED_ID}',
        '${process.env.DEFAULT_MANUAL_ENTRY_FACILITY_ID}',
        '${process.env.OPENLDR_PROJECT_ID}',
        '${process.env.MANUAL_ENTRY_USE_CASE_ID}',
        'Manual Data Entry for Facility: OpenLDR Manual Entry',
        NULL,
        '${process.env.TEST_PLUGIN_MAPPER_ID}',
        '${process.env.TEST_PLUGIN_RECIPIENT_MANUAL_ENTRY_ID}',
        TRUE,
        TRUE,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Now create the default manual data entry feed for the test facility
    INSERT INTO ${quoteStyle}dataFeeds${quoteStyle} (
        ${quoteStyle}dataFeedId${quoteStyle},
        ${quoteStyle}facilityId${quoteStyle},
        ${quoteStyle}projectId${quoteStyle},
        ${quoteStyle}useCaseId${quoteStyle},
        ${quoteStyle}dataFeedName${quoteStyle},
        ${quoteStyle}schemaPluginId${quoteStyle},
        ${quoteStyle}mapperPluginId${quoteStyle},
        ${quoteStyle}recipientPluginId${quoteStyle},
        ${quoteStyle}isEnabled${quoteStyle},
        ${quoteStyle}isProtected${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.TEST_MANUAL_ENTRY_DATA_FEED_ID}',
        '${process.env.TEST_FACILITY_ID}',
        '${process.env.OPENLDR_PROJECT_ID}',
        '${process.env.MANUAL_ENTRY_USE_CASE_ID}',
        'Manual Data Entry for Facility: Z-Lab-Facility',
        NULL,
        '${process.env.TEST_PLUGIN_MAPPER_ID}',
        '${process.env.TEST_PLUGIN_RECIPIENT_MANUAL_ENTRY_ID}',
        TRUE,
        TRUE,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Now create the test inbound data feed with references to the plugins, project, and use case
    INSERT INTO ${quoteStyle}dataFeeds${quoteStyle} (
        ${quoteStyle}dataFeedId${quoteStyle},
        ${quoteStyle}facilityId${quoteStyle},
        ${quoteStyle}projectId${quoteStyle},
        ${quoteStyle}useCaseId${quoteStyle},
        ${quoteStyle}dataFeedName${quoteStyle},
        ${quoteStyle}schemaPluginId${quoteStyle},
        ${quoteStyle}mapperPluginId${quoteStyle},
        ${quoteStyle}recipientPluginId${quoteStyle},
        ${quoteStyle}isEnabled${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.TEST_DATA_FEED_ID}',
        '${process.env.TEST_FACILITY_ID}',
        '${process.env.OPENLDR_PROJECT_ID}',
        '${process.env.DATA_FEED_USE_CASE_ID}',
        'Test Data Feed',
        '${process.env.TEST_PLUGIN_SCHEMA_ID}',
        '${process.env.TEST_PLUGIN_MAPPER_ID}',
        '${process.env.TEST_PLUGIN_RECIPIENT_ID}',
        TRUE,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create form schema: General
    INSERT INTO "formSchemas" (
      "schemaId",
      "schemaName",
		  "schemaType",
      "version",
      "schema",
      "dataFeedId",
      "isActive",
		  "createdAt",
		  "updatedAt"
    ) VALUES (
        '${FORM_SCHEMA_FEED_GENERAL}',
        'General',
        'form',
        '1.0.0',
        '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"General Data Entry Form","description":"Used for general purpose","type":"object","properties":{"facilityId":{"type":["object","string"],"format":"uuid","x-zodType":"reference","x-zodReference":{"table":"facilities","key":"facilityId","attributes":["facilityCode","facilityName"]}},"firstName":{"type":"string","minLength":2},"lastName":{"type":"string","minLength":2},"dob":{"type":["object","string"],"format":"date","x-zodType":"date","x-zodOptions":[["format","yyyy-MM-dd"]]},"sex":{"type":["object","enum"],"x-zodType":"options","x-zodOptions":[["Male","Male"],["Female","Female"],["Other","Other"]],"enum":["Male","Female","Other"]},"patientId":{"type":"string","minLength":1},"specimenDate":{"type":["object","string"],"format":"datetime","x-zodType":"date","x-zodOptions":[["format","yyyy-MM-dd HH:mm:ss"]]},"orderProvider":{"type":"string","minLength":2},"labFacilityCode":{"type":"string","minLength":1},"panelCode":{"type":"string","minLength":1},"panelDescription":{"type":"string"},"requestId":{"type":"string","minLength":1},"observationCode":{"type":"string","minLength":2},"observationDescription":{"type":"string"},"interpretation":{"type":"string"},"results":{"type":"string","minLength":1},"resultsDate":{"type":["object","string"],"format":"datetime","x-zodType":"date","x-zodOptions":[["format","yyyy-MM-dd HH:mm:ss"]]},"resultUnits":{"type":"string","minLength":1},"referenceRange":{"type":"string"}},"required":["facilityId","firstName","lastName","dob","sex","patientId","specimenDate","orderProvider","labFacilityCode","panelCode","requestId","observationCode","results","resultsDate","resultUnits"],"additionalProperties":false}',
        '${process.env.DEFAULT_MANUAL_ENTRY_DATA_FEED_ID}',
        true,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
  ];
  for (let x = 0; x < scripts.length; x++) {
    // let x = 0;
    try {
      const sqlScript = scripts[x]!.replace(
        /\$\{(\w+)\}/g,
        (_, key) => process.env[key] || ""
      ).trim();
      // console.log(sqlScript);
      await modelManager.query(sqlScript);
      console.log(x, "Test data created successfully!");
    } catch (error: any) {
      if (
        !error.message.includes("Duplicate entry") &&
        //Most likely a duplicate
        !error.message.includes("Validation error")
      ) {
        console.log(`Test data failed: ${error.message}`);
      }
    }
  }
};

const insertRequiredData = async (modelManager: DynamicModelManager) => {
  let quoteStyle = "`";
  if (process.env.INTERNAL_DB_PREFERRED_DIALET == "postgres") quoteStyle = `"`;

  const scripts = [
    `
    -- Create dev users
    INSERT INTO ${quoteStyle}users${quoteStyle} (
        ${quoteStyle}userId${quoteStyle},
        ${quoteStyle}firstName${quoteStyle},
        ${quoteStyle}lastName${quoteStyle},
        ${quoteStyle}email${quoteStyle},
        ${quoteStyle}phoneNumber${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.DEV_USER_TEST_ID}',
        'Test',
        'User',
        'test@user.com',
        '+255123456789',
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    INSERT INTO ${quoteStyle}users${quoteStyle} (
        ${quoteStyle}userId${quoteStyle},
        ${quoteStyle}firstName${quoteStyle},
        ${quoteStyle}lastName${quoteStyle},
        ${quoteStyle}email${quoteStyle},
        ${quoteStyle}phoneNumber${quoteStyle},
        ${quoteStyle}createdAt${quoteStyle},
        ${quoteStyle}updatedAt${quoteStyle}
    ) VALUES (
        '${process.env.DEV_USER_OPENLDR_ID}',
        'OpenLDR',
        'User',
        'openldr@user.com',
        '+255123456789',
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create form schema: facilities
    INSERT INTO "formSchemas" (
      "schemaId",
      "schemaName",
		  "schemaType",
      "version",
      "schema",
      "isActive",
		  "createdAt",
		  "updatedAt"
    ) VALUES (
        '${ARCHIVE_SCHEMA_FEED_FACILITIES}',
        'facilities',
        'archive',
        'Internal',
        '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"facilities Schema","description":"From Internal","type":"object","properties":{"facilityCode":{"type":"string","maxLength":255},"facilityName":{"type":"string","maxLength":255},"facilityType":{"type":"string","maxLength":255},"description":{"type":"string","maxLength":255},"countryCode":{"type":"string","maxLength":255},"provinceCode":{"type":"string","maxLength":255},"regionCode":{"type":"string","maxLength":255},"districtCode":{"type":"string","maxLength":255},"subDistrictCode":{"type":"string","maxLength":255},"lattLong":{"type":"string","maxLength":255}},"required":["facilityCode","facilityName","facilityType","countryCode","provinceCode","regionCode","districtCode","subDistrictCode"],"additionalProperties":false}',
        true,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create form schema: projects
    INSERT INTO "formSchemas" (
      "schemaId",
      "schemaName",
		  "schemaType",
      "version",
      "schema",
      "isActive",
		  "createdAt",
		  "updatedAt"
    ) VALUES (
        '${ARCHIVE_SCHEMA_FEED_PROJECTS}',
        'projects',
        'archive',
        'Internal',
        '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"projects Schema","description":"From Internal","type":"object","properties":{"projectName":{"type":"string","maxLength":255},"description":{"type":"string","maxLength":255},"isEnabled":{"type":"boolean"}},"required":["projectName"],"additionalProperties":false}',
        true,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create form schema: useCases
    INSERT INTO "formSchemas" (
      "schemaId",
      "schemaName",
		  "schemaType",
      "version",
      "schema",
      "isActive",
		  "createdAt",
		  "updatedAt"
    ) VALUES (
        '${ARCHIVE_SCHEMA_FEED_USECASES}',
        'useCases',
        'archive',
        'Internal',
        '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"useCases Schema","description":"From Internal","type":"object","properties":{"useCaseName":{"type":"string","maxLength":255},"description":{"type":"string","maxLength":255},"isEnabled":{"type":"boolean"}},"required":["useCaseName"],"additionalProperties":false}',
        true,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create form schema: plugins
    INSERT INTO "formSchemas" (
      "schemaId",
      "schemaName",
		  "schemaType",
      "version",
      "schema",
      "isActive",
		  "createdAt",
		  "updatedAt"
    ) VALUES (
        '${ARCHIVE_SCHEMA_FEED_PLUGINS}',
        'plugins',
        'archive',
        'Internal',
        '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"plugins Schema","description":"From Internal","type":"object","properties":{"pluginType":{"type":["object","string"],"x-zodType":"options","x-zodOptions":[["schema","schema"],["recipient","recipient"]]},"pluginName":{"type":"string","maxLength":255},"pluginVersion":{"type":"string","maxLength":255},"pluginMinioObjectPath":{"type":["object","string"],"x-zodType":"file","x-zodFile":{"mimes":[".js",".ts",".json"]}},"securityLevel":{"type":["object","string"],"x-zodType":"options","x-zodOptions":[["low","low"],["medium","medium"],["high","high"]]},"config":{"type":["object","string"]},"notes":{"type":"string","maxLength":2000}},"required":["pluginType","pluginName","pluginVersion","pluginMinioObjectPath","securityLevel"],"additionalProperties":false}',
        true,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create form schema: mapper
    INSERT INTO "formSchemas" (
      "schemaId",
      "schemaName",
		  "schemaType",
      "version",
      "schema",
      "isActive",
		  "createdAt",
		  "updatedAt"
    ) VALUES (
        '${ARCHIVE_SCHEMA_FEED_MAPPER}',
        'mapper',
        'archive',
        'Internal',
        '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"plugins Schema","description":"From Internal","type":"object","properties":{"pluginType":{"type":["object","string"],"x-zodType":"options","x-zodOptions":[["mapper","mapper"]]},"pluginName":{"type":"string","minLength":2,"maxLength":100},"pluginVersion":{"type":"string","fpattern":"^d+.d+.d+$"},"pluginMinioObjectPath":{"type":"string","readOnly":true},"securityLevel":{"type":["object","string"],"x-zodType":"options","x-zodOptions":[["low","low"],["medium","medium"],["high","high"]]},"notes":{"type":"string","maxLength":2000},"oclUrl":{"type":"string","format":"url"},"orgId":{"type":"string","minLength":1},"sourceId":{"type":"string","minLength":1},"auth":{"type":"string"}},"required":["pluginType","pluginName","pluginVersion","securityLevel","oclUrl","orgId","sourceId"],"additionalProperties":false}',
        true,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create form schema: users
    INSERT INTO "formSchemas" (
      "schemaId",
      "schemaName",
		  "schemaType",
      "version",
      "schema",
      "isActive",
		  "createdAt",
		  "updatedAt"
    ) VALUES (
        '${ARCHIVE_SCHEMA_FEED_USERS}',
        'users',
        'archive',
        'Internal',
        '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"users Schema","description":"From Internal","type":"object","properties":{"firstName":{"type":"string","maxLength":255},"lastName":{"type":"string","maxLength":255},"email":{"type":"string","maxLength":255},"phoneNumber":{"type":"string","maxLength":255}},"required":["firstName","lastName","email","phoneNumber"],"additionalProperties":false}',
        true,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create form schema: dataFeeds
    INSERT INTO "formSchemas" (
      "schemaId",
      "schemaName",
		  "schemaType",
      "version",
      "schema",
      "isActive",
		  "createdAt",
		  "updatedAt"
    ) VALUES (
        '${ARCHIVE_SCHEMA_FEED_DATAFEEDS}',
        'dataFeeds',
        'archive',
        'Internal',
        '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"dataFeeds Schema","description":"From Internal","type":"object","properties":{"dataFeedName":{"type":"string","maxLength":255},"facilityId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"facilities","key":"facilityId","attributes":["facilityCode","facilityName"]}},"schemaPluginId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"plugins","key":"pluginId","attributes":["pluginType","pluginName","pluginVersion","securityLevel"]}},"mapperPluginId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"plugins","key":"pluginId","attributes":["pluginType","pluginName","pluginVersion","securityLevel"]}},"recipientPluginId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"plugins","key":"pluginId","attributes":["pluginType","pluginName","pluginVersion","securityLevel"]}},"projectId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"projects","key":"projectId","attributes":["projectName","description","isEnabled"]}},"useCaseId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"useCases","key":"useCaseId","attributes":["useCaseName","description","isEnabled"]}},"isEnabled":{"type":"boolean"},"isProtected":{"type":"boolean"}},"required":["dataFeedName","facilityId","projectId","useCaseId","isEnabled","isProtected"],"additionalProperties":false}',
        true,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
    `
    -- Create form schema: formSchemas
    INSERT INTO "formSchemas" (
      "schemaId",
      "schemaName",
		  "schemaType",
      "version",
      "schema",
      "isActive",
		  "createdAt",
		  "updatedAt"
    ) VALUES (
        '${ARCHIVE_SCHEMA_FEED_FORMSCHEMAS}',
        'formSchemas',
        'archive',
        'Internal',
        '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"formSchemas Schema","description":"From Internal","type":"object","properties":{"schemaName":{"type":"string","maxLength":255},"schemaType":{"type":["object","string"],"x-zodType":"options","x-zodOptions":[["form","form"],["archive","archive"]]},"version":{"type":"string","maxLength":255},"schema":{"type":["object","string"]},"dataFeedId":{"type":["object","string"],"x-zodType":"reference","x-zodReference":{"table":"dataFeeds","key":"dataFeedId","attributes":["dataFeedName","createdAt","updatedAt"]}},"isActive":{"type":"boolean"}},"required":["schemaName","schemaType","version","schema","isActive"],"additionalProperties":false}',
        true,
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        },
        ${
          process.env.INTERNAL_DB_PREFERRED_DIALET == "sqlite3"
            ? "datetime('now')"
            : "NOW()"
        }
    );
    `,
  ];
  for (let x = 0; x < scripts.length; x++) {
    // let x = 0;
    try {
      const sqlScript = scripts[x]!.replace(
        /\$\{(\w+)\}/g,
        (_, key) => process.env[key] || ""
      ).trim();
      // console.log(sqlScript);
      await modelManager.query(sqlScript);
      console.log(x, "Test data created successfully!");
    } catch (error: any) {
      if (
        !error.message.includes("Duplicate entry") &&
        //Most likely a duplicate
        !error.message.includes("Validation error")
      ) {
        console.log(`Test data failed: ${error.message}`);
      }
    }
  }
};

const start = async (dir: string) => {
  services.loadEnv(path.resolve(".env"));

  const dialect = process.env.INTERNAL_DB_PREFERRED_DIALET || "postgres";
  const config = Config[dialect as keyof typeof Config];
  if (config) {
    if (dialect != "sqlite3") {
      (config as any).port = parseInt((config as any).port);

      console.log(`Waiting for ${dialect} to be ready...`);
      if (dialect == "postgres") {
        await services.waitForContainerHealth(
          process.env.POSTGRES_HOSTNAME!,
          480000,
          docker
        );
      } else if (dialect == "mysql") {
        await services.waitForContainerHealth(
          process.env.MYSQL_HOSTNAME!,
          480000,
          docker
        );
      }

      console.log(`Initializing ${dialect} connection...`);
      await services.sleep(1000 * 10);
    }

    const modelManager = await DynamicModelManager.custom(config);
    if (modelManager) {
      if (
        process.env.INCLUDE_TEST_DATA &&
        process.env.INCLUDE_TEST_DATA.toLowerCase().trim() == "true"
      ) {
        await insertTestData(modelManager);
      }
      await insertRequiredData(modelManager);
    }
  }
};

const { command, dir } = services.processArguments(__dirname, process.argv);
switch (command) {
  case "setup":
    console.log(`Running setup - ${dir}`);
    break;
  case "reset":
    console.log(`Running reset - ${dir}`);
    break;
  case "stop":
    console.log(`Stopping services - ${dir}`);
    break;
  case "start":
    console.log(`Starting services - ${dir}`);
    start(dir);
    break;
  default:
    throw new Error(`Unknown command: ${command} - ${dir}`);
}
