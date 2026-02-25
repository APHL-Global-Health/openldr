import { Pool } from "pg";

const isDev = process.env.NODE_ENV === "development";

// Database connection pool
const pool = new Pool({
  host: isDev ? "localhost" : process.env.POSTGRES_HOSTNAME!,
  port:
    process.env.POSTGRES_PORT !== undefined
      ? parseInt(process.env.POSTGRES_PORT!) || 5432
      : 5432,
  database: process.env.POSTGRES_DB!,
  user: process.env.POSTGRES_USER!,
  password: process.env.POSTGRES_PASSWORD!,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

export { pool };
