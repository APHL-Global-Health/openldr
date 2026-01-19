import { DataTypes, ModelStatic, Sequelize } from "@sequelize/core";
import Config from "../config/config";

// Import models
import {
  FacilityModel,
  PluginModel,
  UserModel,
  DataFeedModel,
  NotificationModel,
  ProjectModel,
  UseCaseModel,
  ExtensionModel,
  ExtensionVersionModel,
  ExtensionUserModel,
  ExtensionPermissionModel,
  ExtensionReviewModel,
  FormSchemaModel,
  // FormSubmissionModel,
  setupAssociations,
} from "../models";

export class DynamicModelManager {
  private sequelize: Sequelize;
  private modelCache = new Map();
  private relationshipCache = new Map();

  // Add a set of static model table names to exclude from dynamic processing
  private static STATIC_TABLES = new Set([
    "facilities",
    "plugins",
    "users",
    "dataFeeds",
    "notifications",
    "projects",
    "useCases",
    "extensions",
    "extensionVersions",
    "extensionUsers",
    "extensionPermissions",
    "extensionReviews",
    "formSchemas",
    // "formSubmissions",
  ]);

  // Add a map of static models
  private staticModels = new Map<string, ModelStatic<any>>();

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
    this.modelCache = new Map();
    this.relationshipCache = new Map();

    // Register static models in the cache
    this.registerStaticModels();
  }

  /**
   * Register all static models so they're available to the dynamic system
   */
  private registerStaticModels() {
    const staticModels = [
      { name: "facilities", model: FacilityModel },
      { name: "plugins", model: PluginModel },
      { name: "users", model: UserModel },
      { name: "dataFeeds", model: DataFeedModel },
      { name: "notifications", model: NotificationModel },
      { name: "projects", model: ProjectModel },
      { name: "useCases", model: UseCaseModel },
      { name: "extensions", model: ExtensionModel },
      { name: "extensionVersions", model: ExtensionVersionModel },
      { name: "extensionUsers", model: ExtensionUserModel },
      { name: "extensionPermissions", model: ExtensionPermissionModel },
      { name: "extensionReviews", model: ExtensionReviewModel },
      { name: "formSchemas", model: FormSchemaModel },
      // { name: "formSubmissions", model: FormSubmissionModel },
    ];

    for (const { name, model } of staticModels) {
      this.staticModels.set(name, model);
      this.modelCache.set(name, model);
    }
  }

  public static async custom(
    config: any,
    verbose: Boolean = true
  ): Promise<DynamicModelManager> {
    //v7-alpha
    const sequelize = new Sequelize(config as any);
    sequelize.addModels([
      FacilityModel,
      PluginModel,
      UserModel,
      DataFeedModel,
      NotificationModel,
      ProjectModel,
      UseCaseModel,
      ExtensionModel,
      ExtensionVersionModel,
      ExtensionUserModel,
      ExtensionPermissionModel,
      ExtensionReviewModel,
      FormSchemaModel,
      // FormSubmissionModel,
    ]);

    await sequelize.authenticate();
    await sequelize.sync({ force: false });

    const manager = new DynamicModelManager(sequelize);

    // Setup associations AFTER manager is created
    setupAssociations(verbose);

    return manager;
  }

  public static async create(
    service: string | undefined,
    verbose: Boolean = true
  ): Promise<DynamicModelManager> {
    const dialect = service || "postgres";
    const config = Config[dialect as keyof typeof Config];
    if (!config)
      throw new Error("Supported services are: postgres, mysql or sqlite3");

    if (dialect != "sqlite3")
      (config as any).port = parseInt((config as any).port);

    return DynamicModelManager.custom(config, verbose);
  }

  /**
   * Get or create a model from a database table
   * @param {string} tableName - Name of the table
   * @param {Object} options - Additional options
   * @returns {Promise<ModelStatic<any>>} Sequelize model
   */
  async getModel(
    tableName: string,
    options: any = {}
  ): Promise<ModelStatic<any>> {
    const dialect = this.sequelize.dialect.name;

    const {
      refresh = false,
      includeRelationships = true,
      customSchema = null,
      timestamps = dialect === "sqlite3" ? false : true,
      paranoid = false,
    } = options;

    // Check if this is a static model first
    if (DynamicModelManager.STATIC_TABLES.has(tableName)) {
      const staticModel = this.staticModels.get(tableName);
      if (staticModel) {
        return staticModel;
      }
    }

    // Return cached model if exists and not refreshing
    if (!refresh && this.modelCache.has(tableName)) {
      return this.modelCache.get(tableName);
    }

    try {
      // Get table structure
      const schema = customSchema || (await this.introspectTable(tableName));

      // Get indexes
      const indexes = await this.getTableIndexes(tableName);

      // Define the model
      const model = this.sequelize.define(tableName, schema, {
        tableName: tableName,
        timestamps: timestamps,
        paranoid: paranoid,
        indexes: indexes,
        freezeTableName: true,
      });

      // Store in cache
      this.modelCache.set(tableName, model);

      // Discover and set up relationships
      if (includeRelationships) {
        await this.setupRelationships(tableName, model);
      }

      return model;
    } catch (error: any) {
      throw new Error(
        `Failed to create model for table "${tableName}": ${error.message}`
      );
    }
  }

  async query(sql: string, options?: any) {
    return this.sequelize.query(sql, options);
  }

  /**
   * Introspect table structure from database
   * @param {string} tableName
   * @returns {Promise<Object>} Schema definition
   */
  async introspectTable(tableName: string) {
    const dialect = this.sequelize.dialect.name;
    let columns: any = [];

    if (dialect === "mysql" || dialect === "mariadb") {
      const db = (this.sequelize.rawOptions as any).database;

      [columns] = await this.sequelize.query(
        `SELECT
              COLUMN_NAME as "Field",
              COLUMN_TYPE as "Type",
              IS_NULLABLE as "Nullable",
              COLUMN_KEY as "Key",
              IFNULL(CHARACTER_MAXIMUM_LENGTH, "") as "Constraint",
              IFNULL(COLUMN_DEFAULT, "") as "Default"
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = '${db}'
          AND TABLE_NAME = '${tableName}'
          ORDER BY ORDINAL_POSITION;`,
        { raw: true }
      );
    } else if (dialect === "postgres") {
      [columns] = await this.sequelize.query(
        `SELECT 
          column_name as "Field",
          data_type as "Type",
          is_nullable as "Nullable",
          COALESCE(column_default, '') as "Default",
		  COALESCE(character_maximum_length::TEXT, '') as "Constraint",
          CASE WHEN column_name IN (
            SELECT column_name 
            FROM information_schema.key_column_usage 
            WHERE table_name = '${tableName}' 
            AND constraint_name LIKE '%_pkey'
          ) THEN 'PRI' ELSE '' END as "Key"
        FROM information_schema.columns 
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position`,
        { raw: true }
      );

      for (let x = 0; x < columns.length; x++) {
        const col: any = columns[x];
        const [enums] = await this.sequelize.query(
          `SELECT 
                'enum_${tableName}_${col.Field}' AS "key",
                e.enumlabel AS "value"
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typtype = 'e'
            AND t.typname='enum_${tableName}_${col.Field}'`,
          { raw: true }
        );

        if (enums.length > 0) {
          const item: any = columns.find((c: any) => c.Field === col.Field);
          item["Type"] = `ENUM(${enums
            .map((row: any) => row.value)
            .join(",")})`;

          if (item["Default"]) {
            const reg = new RegExp(`'(.*)'::"${(enums[0] as any).key}"`);
            const match = item["Default"].match(reg);
            if (match) {
              item["Default"] = match[1].toString();
            }
          }
        }
      }
    } else if (dialect === "sqlite3") {
      [columns] = await this.sequelize.query(
        `PRAGMA table_info(\`${tableName}\`)`,
        { raw: true }
      );

      // Normalize SQLite column info to match MySQL format
      columns = columns.map((col: any) => ({
        Field: col.name,
        Type: col.type,
        Nullable: col.notnull === 0 ? "YES" : "NO",
        Key: col.pk === 1 ? "PRI" : "",
        Default: col.dflt_value,
        Constraint: "",
      }));
    }

    if (!columns || columns.length === 0) {
      throw new Error(`Table "${tableName}" not found or has no columns`);
    }

    const schema: any = {};

    for (const col of columns) {
      const fieldName = col.Field || col.name;
      const columnDef = this.buildColumnDefinition(col);

      if (columnDef) {
        schema[fieldName] = columnDef;
      }
    }

    return schema;
  }

  /**
   * Build Sequelize column definition from database column info
   * @param {Object} col - Column information from database
   * @returns {Object} Sequelize column definition
   */
  buildColumnDefinition(col: any) {
    const fieldName = col.Field || col.name;
    const mysqlType = (col.Type || "").toLowerCase();
    const isNullable = (col.Nullable || "YES") === "YES";
    const isPrimaryKey = (col.Key || "") === "PRI";
    const defaultValue = col.Default;
    const constraint = col.Constraint;

    const definition: any = {
      type: this.mapTypeToSequelize(mysqlType, constraint, fieldName),
      allowNull: isNullable,
      primaryKey: isPrimaryKey,
    };

    if (constraint.length > 0) {
      definition.constraint =
        typeof constraint === "string" && !Number.isNaN(Number(constraint))
          ? parseInt(constraint)
          : constraint;
    }

    // Handle auto increment
    if (col.Extra && col.Extra.includes("auto_increment")) {
      definition.autoIncrement = true;
    }

    // Handle default values
    if (
      defaultValue !== null &&
      defaultValue !== undefined &&
      defaultValue.le > 0
    ) {
      // Skip CURRENT_TIMESTAMP and similar functions
      if (!defaultValue.toString().toUpperCase().includes("CURRENT")) {
        definition.defaultValue = this.parseDefaultValue(
          defaultValue,
          mysqlType
        );
      }
    }

    // Handle unique constraints
    if (col.Key === "UNI") {
      definition.unique = true;
    }

    return definition;
  }

  /**
   * Map MySQL/PostgreSQL types to Sequelize DataTypes
   * @param {string} dbType - Database type string
   * @returns {DataType} Sequelize DataType
   */
  mapTypeToSequelize(dbType: string, constraint: string, fieldName: string) {
    // Extract length from type like varchar(255)
    const lengthMatch: any = dbType.match(/\((\d+)\)/);
    const length = lengthMatch
      ? parseInt(lengthMatch[1])
      : constraint
        ? parseInt(constraint)
        : null;

    // VARCHAR, CHAR
    if (dbType.includes("varchar")) {
      return length ? DataTypes.STRING(length) : DataTypes.STRING;
    }
    if (dbType.includes("char")) {
      return length ? DataTypes.CHAR(length) : DataTypes.CHAR;
    }

    // TEXT types
    if (dbType === "text") return DataTypes.TEXT;
    if (dbType === "tinytext") return DataTypes.TEXT("tiny");
    if (dbType === "mediumtext") return DataTypes.TEXT("medium");
    if (dbType === "longtext") return DataTypes.TEXT("long");

    // INTEGER types
    if (dbType.includes("bigint")) return DataTypes.BIGINT;
    if (dbType.includes("int")) return DataTypes.INTEGER;
    if (dbType.includes("tinyint(1)")) return DataTypes.BOOLEAN;
    if (dbType.includes("tinyint")) return DataTypes.TINYINT;
    if (dbType.includes("smallint")) return DataTypes.SMALLINT;
    if (dbType.includes("mediumint")) return DataTypes.MEDIUMINT;

    // DECIMAL/NUMERIC
    if (dbType.includes("decimal") || dbType.includes("numeric")) {
      const precisionMatch: any = dbType.match(/\((\d+),(\d+)\)/);
      if (precisionMatch) {
        return DataTypes.DECIMAL(
          parseInt(precisionMatch[1]),
          parseInt(precisionMatch[2])
        );
      }
      return DataTypes.DECIMAL;
    }

    // FLOAT/DOUBLE
    if (dbType.includes("float")) return DataTypes.FLOAT;
    if (dbType.includes("double")) return DataTypes.DOUBLE;
    if (dbType.includes("real")) return DataTypes.REAL;

    // DATE/TIME types
    if (dbType === "date") return DataTypes.DATEONLY;
    if (dbType.startsWith("datetime")) return DataTypes.DATE;
    if (dbType === "timestamp") return DataTypes.DATE;
    if (dbType === "timestamp with time zone") return DataTypes.DATE;
    if (dbType === "time") return DataTypes.TIME;

    // BOOLEAN
    if (dbType === "boolean" || dbType === "bool") return DataTypes.BOOLEAN;

    // JSON
    if (dbType === "json") return DataTypes.JSON;
    if (dbType === "jsonb") return DataTypes.JSONB;

    // BLOB types
    if (dbType === "blob") return DataTypes.BLOB;
    if (dbType === "tinyblob") return DataTypes.BLOB("tiny");
    if (dbType === "mediumblob") return DataTypes.BLOB("medium");
    if (dbType === "longblob") return DataTypes.BLOB("long");

    // ENUM
    if (dbType.includes("enum")) {
      const enumMatch: any = dbType.match(/enum\((.*)\)/);
      if (enumMatch) {
        const values = enumMatch[1]
          .split(",")
          .map((v: any) => v.trim().replace(/'/g, ""));
        return DataTypes.ENUM(...values);
      }
    }

    // UUID
    if (dbType === "uuid") return DataTypes.UUID;

    // Default to STRING
    console.warn(
      `${fieldName}: Unknown type "${dbType}", defaulting to STRING`
    );
    return DataTypes.STRING;
  }

  /**
   * Parse default value based on type
   * @param {*} defaultValue
   * @param {string} type
   * @returns {*}
   */
  parseDefaultValue(defaultValue: any, type: string) {
    if (defaultValue === null || defaultValue === "NULL") return null;

    const strValue = defaultValue.toString();

    // Remove quotes if present
    const cleaned = strValue.replace(/^['"]|['"]$/g, "");

    if (
      type.includes("int") ||
      type.includes("decimal") ||
      type.includes("float") ||
      type.includes("double")
    ) {
      return Number(cleaned);
    }

    if (type.includes("tinyint(1)") || type === "boolean") {
      return cleaned === "1" || cleaned.toLowerCase() === "true";
    }

    if (type === "json" || type === "jsonb") {
      try {
        return JSON.parse(cleaned);
      } catch {
        return cleaned;
      }
    }

    return cleaned;
  }

  /**
   * Get table indexes
   * @param {string} tableName
   * @returns {Promise<Array>}
   */
  async getTableIndexes(tableName: string) {
    const dialect = this.sequelize.dialect.name;

    try {
      let indexes: any = [];

      if (dialect === "mysql" || dialect === "mariadb") {
        [indexes] = await this.sequelize.query(
          `SHOW INDEX FROM \`${tableName}\` WHERE Key_name != 'PRIMARY'`,
          { raw: true }
        );
      } else if (dialect === "postgres") {
        [indexes] = await this.sequelize.query(
          `SELECT 
            i.relname as Key_name,
            a.attname as Column_name,
            ix.indisunique as Non_unique
          FROM pg_class t
          JOIN pg_index ix ON t.oid = ix.indrelid
          JOIN pg_class i ON i.oid = ix.indexrelid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
          WHERE t.relname = '${tableName}'
          AND i.relname NOT LIKE '%_pkey'`,
          { raw: true }
        );
      }

      // Group indexes by name
      const indexMap = new Map();

      for (const idx of indexes) {
        const keyName = idx.Key_name;

        if (!indexMap.has(keyName)) {
          indexMap.set(keyName, {
            name: keyName,
            unique: idx.Non_unique === 0 || idx.Non_unique === false,
            fields: [],
          });
        }

        indexMap.get(keyName).fields.push(idx.Column_name);
      }

      return Array.from(indexMap.values());
    } catch (error: any) {
      console.warn(
        `Could not retrieve indexes for ${tableName}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Discover and setup foreign key relationships
   * @param {string} tableName
   * @param {ModelStatic<any>} model
   */
  async setupRelationships(tableName: string, model: ModelStatic<any>) {
    // Skip relationship setup for static models - they handle their own associations
    if (DynamicModelManager.STATIC_TABLES.has(tableName)) {
      return;
    }

    const dialect = this.sequelize.dialect.name;
    let foreignKeys: any = [];

    try {
      if (dialect === "mysql" || dialect === "mariadb") {
        [foreignKeys] = await this.sequelize.query(
          `SELECT 
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME,
            CONSTRAINT_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = '${tableName}'
            AND REFERENCED_TABLE_NAME IS NOT NULL`,
          { raw: true }
        );
      } else if (dialect === "postgres") {
        [foreignKeys] = await this.sequelize.query(
          `SELECT
            kcu.column_name as COLUMN_NAME,
            ccu.table_name AS REFERENCED_TABLE_NAME,
            ccu.column_name AS REFERENCED_COLUMN_NAME,
            tc.constraint_name AS CONSTRAINT_NAME
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = '${tableName}'`,
          { raw: true }
        );
      }

      for (const fk of foreignKeys) {
        const referencedTable = fk.REFERENCED_TABLE_NAME;
        const foreignKey = fk.COLUMN_NAME;
        const referencedKey = fk.REFERENCED_COLUMN_NAME;

        // Check if referenced table is already in cache (including static models)
        let referencedModel = this.modelCache.get(referencedTable);

        if (!referencedModel) {
          // Only introspect if it's not a static model
          if (!DynamicModelManager.STATIC_TABLES.has(referencedTable)) {
            referencedModel = await this.getModel(referencedTable, {
              includeRelationships: false,
            });
          } else {
            // Skip - static model relationships are handled by setupAssociations
            console.warn(
              `Skipping dynamic relationship from ${tableName} to static table ${referencedTable}`
            );
            continue;
          }
        }

        // Set up belongsTo relationship
        model.belongsTo(referencedModel, {
          foreignKey: foreignKey,
          targetKey: referencedKey,
          as: this.generateAlias(referencedTable, foreignKey),
        });

        // Set up hasMany/hasOne on the other side
        const relationship = {
          from: tableName,
          to: referencedTable,
          foreignKey: foreignKey,
        };

        const relationKey = `${referencedTable}-${tableName}`;
        if (!this.relationshipCache.has(relationKey)) {
          this.relationshipCache.set(relationKey, relationship);

          // Determine if it's hasOne or hasMany (default to hasMany)
          referencedModel.hasMany(model, {
            foreignKey: foreignKey,
            sourceKey: referencedKey,
            as: this.generatePluralAlias(tableName),
          });
        }
      }
    } catch (error: any) {
      console.warn(
        `Could not setup relationships for ${tableName}:`,
        error.message
      );
    }
  }

  /**
   * Generate alias for relationship
   * @param {string} tableName
   * @param {string} foreignKey
   * @returns {string}
   */
  generateAlias(tableName: string, foreignKey: string) {
    // Remove common suffixes like _id, Id
    const cleaned = foreignKey.replace(/(_id|Id)$/i, "");

    // If cleaned name is different from table name, use it
    if (cleaned.toLowerCase() !== tableName.toLowerCase()) {
      return cleaned;
    }

    return tableName;
  }

  /**
   * Generate plural alias for hasMany relationships
   * @param {string} tableName
   * @returns {string}
   */
  generatePluralAlias(tableName: string) {
    // Simple pluralization (you might want to use a library like 'pluralize')
    if (tableName.endsWith("s")) {
      return tableName + "es";
    }
    if (tableName.endsWith("y")) {
      return tableName.slice(0, -1) + "ies";
    }
    return tableName + "s";
  }

  /**
   * Get all tables in the database
   * @returns {Promise<Array<string>>}
   */
  async getAllTables() {
    const dialect = this.sequelize.dialect.name;
    let tables: any = [];

    if (dialect === "mysql" || dialect === "mariadb") {
      [tables] = await this.sequelize.query("SHOW TABLES", { raw: true });
      tables = tables.map((row: any) => Object.values(row)[0]);
    } else if (dialect === "postgres") {
      [tables] = await this.sequelize.query(
        `SELECT tablename FROM pg_catalog.pg_tables 
         WHERE schemaname = 'public'`,
        { raw: true }
      );
      tables = tables.map((row: any) => row.tablename);
    } else if (dialect === "sqlite3") {
      [tables] = await this.sequelize.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
        { raw: true }
      );
      tables = tables.map((row: any) => row.name);
    }

    return tables;
  }

  /**
   * Get all columns for a table
   * @param {string} tableName
   */
  async getColums(tableName: string) {
    const schema = await this.introspectTable(tableName);

    return Object.entries(schema).map(([key, val]) => {
      const value = val as any;
      let type = value.type.toString().toLowerCase();

      let constraint = value.constraint;
      if (type === "enum") {
        if (value.type.options && value.type.options.values) {
          constraint = value.type.options.values;
        }
      }

      type = type.replace(/\((\d+)\)/, "");

      const obj: any = {
        Name: key,
        Type: type,
        Nullable: value.allowNull,
      };

      if (value.primaryKey) obj["PrimaryKey"] = value.primaryKey;
      if (value.defaultValue) obj["Default"] = value.defaultValue;
      if (constraint) obj["Constraint"] = constraint;

      return obj;
    });
  }

  async getData(tableName: string, options: any = {}) {
    const model = await this.getModel(tableName);
    const { count, rows } = await model.findAndCountAll(options);
    return { count, rows };
  }

  /**
   * Preload all models from database
   * @param {Object} options
   * @returns {Promise<Map>}
   */
  async preloadAllModels(options = {}) {
    const tables = await this.getAllTables();

    for (const table of tables) {
      await this.getModel(table, options);
    }

    return this.modelCache;
  }

  /**
   * Clear model cache
   * @param {string} tableName - Optional specific table to clear
   */
  clearCache(tableName = null) {
    if (tableName) {
      this.modelCache.delete(tableName);
    } else {
      this.modelCache.clear();
      this.relationshipCache.clear();
    }
  }

  /**
   * Get cached model without database introspection
   * @param {string} tableName
   * @returns {ModelStatic<any>|null}
   */
  getCachedModel(tableName: string): ModelStatic<any> {
    return this.modelCache.get(tableName) || null;
  }

  /**
   * Check if model exists in cache
   * @param {string} tableName
   * @returns {boolean}
   */
  hasModel(tableName: string) {
    return this.modelCache.has(tableName);
  }

  /**
   * Get all cached models
   * @returns {Map}
   */
  getAllModels() {
    return this.modelCache;
  }

  /**
   * Get all dynamic tables (excluding static models)
   */
  async getDynamicTables() {
    const allTables = await this.getAllTables();
    return allTables.filter(
      (table: string) => !DynamicModelManager.STATIC_TABLES.has(table)
    );
  }

  /**
   * Get sequelize
   */
  getSequelize() {
    return this.sequelize;
  }
}
