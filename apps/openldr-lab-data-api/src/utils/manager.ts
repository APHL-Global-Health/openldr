import { Pool } from "pg";

export class DynamicModelManager {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  public static async custom(
    config: any,
    verbose: Boolean = true
  ): Promise<DynamicModelManager> {
    const pool = new Pool(config);

    const manager = new DynamicModelManager(pool);

    return manager;
  }

  //TODO fix later
  /*async getTables() {
    const script = `
          SELECT table_name "TABLE_NAME"
          FROM information_schema.TABLES
          WHERE table_catalog = 'openldr_external'
          AND  table_type = 'BASE TABLE'
          AND  table_schema = 'public'
          ORDER BY table_name
      `;
    const response = await this.query(script);
    return response;
  }

  async getTableSchema(table: string) {
    const script = `
          SELECT 
              COLUMN_NAME "name", 
              DATA_TYPE "type", 
              CHARACTER_MAXIMUM_LENGTH "constraint", 
              (case when IS_NULLABLE = 'YES' then 'true' else 'false' end) "nullable"
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE table_schema = 'public' 
          AND table_catalog = 'openldr_external'
          AND  table_catalog = '${table.toLowerCase()}'
          ORDER BY ORDINAL_POSITION
      `;
    return await this.query(script);
  }*/

  async query(sql: string, options?: any) {
    const client = await this.pool.connect();
    return client.query(sql, options);
  }
}
