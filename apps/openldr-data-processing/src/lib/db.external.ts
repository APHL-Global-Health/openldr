import { Pool } from "pg";

const isDev = process.env.NODE_ENV === "development";

// Connection pool for openldr_external — terminology, concepts, concept_mappings
const externalPool = new Pool({
  host: isDev ? "localhost" : process.env.POSTGRES_HOSTNAME!,
  port:
    process.env.POSTGRES_PORT !== undefined
      ? parseInt(process.env.POSTGRES_PORT!) || 5432
      : 5432,
  database: process.env.POSTGRES_DB_EXTERNAL!,
  user: process.env.POSTGRES_USER!,
  password: process.env.POSTGRES_PASSWORD!,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export { externalPool };
