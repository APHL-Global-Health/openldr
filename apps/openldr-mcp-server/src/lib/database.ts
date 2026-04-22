import { Pool } from "pg";

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

class DatabaseManager {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.pool) return;

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();
      console.log(`Connected to database: ${this.config.database}`);
    } catch (error) {
      console.error("Database connection failed:", error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.pool.query(text, params);
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log("Database connection closed");
    }
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.pool;
  }
}

// Singleton instances for different databases
let externalDbManager: DatabaseManager | null = null;
let mainDbManager: DatabaseManager | null = null;

export function getExternalDatabase(): DatabaseManager {
  if (!externalDbManager) {
    externalDbManager = new DatabaseManager({
      host: process.env.POSTGRES_HOSTNAME!,
      port: parseInt(process.env.POSTGRES_PORT!),
      database: process.env.POSTGRES_DB_EXTERNAL!,
      user: process.env.POSTGRES_USER!,
      password: process.env.POSTGRES_PASSWORD!,
    });
  }
  return externalDbManager;
}

export function getMainDatabase(): DatabaseManager {
  if (!mainDbManager) {
    mainDbManager = new DatabaseManager({
      host: process.env.POSTGRES_HOSTNAME!,
      port: parseInt(process.env.POSTGRES_PORT!),
      database: process.env.POSTGRES_DB!,
      user: process.env.POSTGRES_USER!,
      password: process.env.POSTGRES_PASSWORD!,
    });
  }
  return mainDbManager;
}

export async function disconnectAllDatabases(): Promise<void> {
  const promises = [];
  if (externalDbManager) promises.push(externalDbManager.disconnect());
  if (mainDbManager) promises.push(mainDbManager.disconnect());
  await Promise.all(promises);
}
