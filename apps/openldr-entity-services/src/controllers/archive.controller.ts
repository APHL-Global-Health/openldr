import express from "express";
import { v4 as uuidv4 } from "uuid";
import { validator } from "../lib/validator";
import { pool } from "../lib/db";
import { getEntryForm } from "../services/form.service";
import { keycloakService } from "../services/keycloak.service";
// import * as minioUtil from "../services/minio.service";
import { generate } from "./terminology.controller";

import * as minioUtil from "../lib/minio";

const isPlainObject = (variable: any) => {
  return (
    typeof variable === "object" &&
    variable !== null &&
    !(variable instanceof String)
  );
};

// Helper: get column info for a table from information_schema
async function getColumns(tableName: string) {
  const result = await pool.query(
    `SELECT
       c.column_name AS "Name",
       c.data_type AS "Type",
       c.is_nullable = 'YES' AS "Nullable",
       c.character_maximum_length AS "Constraint",
       c.column_default,
       CASE WHEN kcu.column_name IS NOT NULL THEN true ELSE false END AS "PrimaryKey"
     FROM information_schema.columns c
     LEFT JOIN information_schema.table_constraints tc
       ON tc.table_name = c.table_name AND tc.constraint_type = 'PRIMARY KEY'
     LEFT JOIN information_schema.key_column_usage kcu
       ON kcu.table_name = c.table_name AND kcu.column_name = c.column_name
       AND kcu.constraint_name = tc.constraint_name
     WHERE c.table_name = $1
     ORDER BY c.ordinal_position`,
    [tableName],
  );
  return result.rows;
}

// Helper: get all table names
async function getAllTables() {
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  return result.rows.map((r: any) => r.table_name);
}

// Helper: build WHERE clause from an object
function buildWhereClause(where: Record<string, any>, startIndex: number = 1) {
  const keys = Object.keys(where);
  const conditions = keys.map((key, i) => `"${key}" = $${startIndex + i}`);
  const values = Object.values(where);
  return { clause: conditions.join(" AND "), values };
}

// Helper: insert a row dynamically
async function insertRow(tableName: string, data: Record<string, any>) {
  const keys = Object.keys(data);
  const quotedKeys = keys.map((k) => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = keys.map((k) => {
    const val = data[k];
    return typeof val === "object" && val !== null ? JSON.stringify(val) : val;
  });

  const result = await pool.query(
    `INSERT INTO "${tableName}" (${quotedKeys}) VALUES (${placeholders}) RETURNING *`,
    values,
  );
  return result.rows[0];
}

// Helper: update rows dynamically
async function updateRow(
  tableName: string,
  data: Record<string, any>,
  where: Record<string, any>,
) {
  const dataKeys = Object.keys(data);
  const setClauses = dataKeys.map((key, i) => `"${key}" = $${i + 1}`);
  const dataValues = dataKeys.map((k) => {
    const val = data[k];
    return typeof val === "object" && val !== null ? JSON.stringify(val) : val;
  });

  const whereKeys = Object.keys(where);
  const whereConditions = whereKeys.map(
    (key, i) => `"${key}" = $${dataKeys.length + i + 1}`,
  );
  const whereValues = Object.values(where);

  const result = await pool.query(
    `UPDATE "${tableName}" SET ${setClauses.join(", ")} WHERE ${whereConditions.join(" AND ")} RETURNING *`,
    [...dataValues, ...whereValues],
  );
  return result.rows;
}

// Helper: delete rows dynamically
async function deleteRows(tableName: string, where: Record<string, any>) {
  const { clause, values } = buildWhereClause(where);
  const result = await pool.query(
    `DELETE FROM "${tableName}" WHERE ${clause} RETURNING *`,
    values,
  );
  return result.rowCount;
}

// Helper: query rows dynamically
async function queryRows(tableName: string, options: any = {}) {
  let query = `SELECT * FROM "${tableName}"`;
  const values: any[] = [];

  if (options.where && Object.keys(options.where).length > 0) {
    const { clause, values: whereValues } = buildWhereClause(options.where);
    query += ` WHERE ${clause}`;
    values.push(...whereValues);
  }

  if (options.order) {
    // options.order expected as [[column, direction], ...]
    const orderClauses = options.order.map(
      ([col, dir]: [string, string]) => `"${col}" ${dir || "ASC"}`,
    );
    query += ` ORDER BY ${orderClauses.join(", ")}`;
  }

  if (options.limit) {
    query += ` LIMIT ${parseInt(options.limit)}`;
  }

  if (options.offset) {
    query += ` OFFSET ${parseInt(options.offset)}`;
  }

  const result = await pool.query(query, values);
  return { count: result.rowCount, rows: result.rows };
}

// Helper: find one row by primary key
async function findByPk(tableName: string, pkColumn: string, pkValue: string) {
  const result = await pool.query(
    `SELECT * FROM "${tableName}" WHERE "${pkColumn}" = $1 LIMIT 1`,
    [pkValue],
  );
  return result.rows[0] || null;
}

const router = express.Router();

router.post(
  "/data/:name",
  async (req: express.Request, res: express.Response) => {
    try {
      const table = req.params.name!;
      const { where, ...rest } = req.body;

      let options: any = { ...rest };
      if (where) {
        options.where = where;
      }

      const data = await queryRows(table, options);
      res.status(200).json({ status: "successful", data });
    } catch (e: any) {
      res.status(502).json({ status: "failed", data: e.message });
    }
  },
);

router.get(
  "/table/:name",
  async (req: express.Request, res: express.Response) => {
    const name = req.params.name;
    const cols = await getColumns(name!);
    res.status(200).json({ status: "successful", data: cols });
  },
);

router.get("/tables", async (_req: express.Request, res: express.Response) => {
  const tables = await getAllTables();
  res.status(200).json({ status: "successful", data: tables });
});

router.post(
  "/table/:version/:name/:type",
  async (req: express.Request, res: express.Response) => {
    const name = req.params.name!;
    const version = req.params.version!;
    const type = req.params.type!;
    const data = req.body;

    const schema = await getEntryForm(name, version, type);
    if (name === "plugins") {
      if (data.pluginType.toLowerCase() === "mapper") {
        schema.required = schema.required.filter(
          (r: any) => r !== "pluginMinioObjectPath",
        );
      }
    }

    var val = validator.validate(data, schema);
    if (!val.valid) {
      res.status(200).json({ status: "Failed", data: val });
    } else {
      try {
        const cols = await getColumns(name);

        const primaryKeys = Object.fromEntries(
          (cols || [])
            .filter((col: any) => col.PrimaryKey && col.Type === "uuid")
            .map((col: any) => [col.Name, uuidv4()]),
        );

        let content = {
          ...data,
          ...primaryKeys,
        };

        if (name === "plugins") {
          let fileContent = null;
          let minioObjectPath = null;
          const pluginId = primaryKeys["pluginId"];

          if (content.pluginType.toLowerCase() !== "mapper") {
            if (
              content.pluginMinioObjectPath &&
              !isPlainObject(content.pluginMinioObjectPath)
            ) {
              return res
                .status(404)
                .json({ status: "Failed", data: "No file to upload." });
            }

            fileContent = content.pluginMinioObjectPath.content;
            minioObjectPath = `${pluginId}/${content.pluginType.toLowerCase()}_${content.pluginVersion}.js`;
          } else if (content.pluginType.toLowerCase() === "mapper") {
            const config = content.config;
            if (config && typeof config === "string") {
              const _config = JSON.parse(config);
              const response: any = await generate(
                {
                  oclUrl: _config.oclUrl,
                  orgId: _config.orgId,
                  sourceId: _config.sourceId,
                  auth: _config.auth,
                },
                res,
              );

              fileContent = JSON.stringify(response.data.pluginFile, null, 2);
              minioObjectPath = `${pluginId}/terminology-mapping_${_config.orgId}_${_config.sourceId}_${content.pluginVersion}.json`;
            }
          }

          if (fileContent === null || minioObjectPath === null) {
            return res
              .status(404)
              .json({ status: "Failed", data: "No file to upload." });
          }

          await minioUtil.putObject({
            bucketName: "plugins",
            objectName: minioObjectPath,
            data: fileContent,
          });

          content = {
            ...data,
            ...primaryKeys,
            pluginMinioObjectPath: minioObjectPath,
          };
        } else if (name === "users") {
          if (!content.temporaryPassword) content.temporaryPassword = 12345;

          const userId = await keycloakService.createUser({
            username: content.email,
            email: content.email,
            firstName: content.firstName,
            lastName: content.lastName,
            attributes: {
              phoneNumber: content.phoneNumber,
            },
            credentials: [
              {
                temporary: true,
                type: "password",
                value: content.temporaryPassword,
              },
            ],
          });

          content = {
            ...data,
            userId,
          };
        }

        const resp = await insertRow(name, content);
        if (name === "projects") {
          const bucketId = resp["projectId"];
          await minioUtil.createBucket(bucketId);
          await minioUtil.setBucketKafkaNotifications(bucketId);
        }

        res.status(200).json({
          status: "successful",
          data: resp,
          primaryKeys,
          cols,
        });
      } catch (error: any) {
        res.status(200).json({ status: "Failed", data: error });
      }
    }
  },
);

router.delete(
  "/table/:version/:name/:type",
  async (req: express.Request, res: express.Response) => {
    const name = req.params.name!;
    // const version = req.params.version!;
    // const type = req.params.type!;
    const data = req.body;

    try {
      const cols = await getColumns(name);
      const primaryKey = (cols || []).find(
        (col: any) => col.PrimaryKey && col.Type === "uuid",
      );

      if (name === "plugins") {
        let _data = Array.isArray(data) ? data : [data];
        for (let x = 0; x < _data.length; x++) {
          await minioUtil.deleteObject({
            bucketName: "plugins",
            objectName: `${_data[x]}`,
          });
        }
      } else if (name === "users") {
        let _data = Array.isArray(data) ? data : [data];
        for (let x = 0; x < _data.length; x++) {
          await keycloakService.deleteUser(_data[x]);
        }
      } else if (name === "projects") {
        let _data = Array.isArray(data) ? data : [data];
        for (let x = 0; x < _data.length; x++) {
          await minioUtil.deleteBucket(_data[x]);
        }
      }

      // Handle both single value and array for WHERE IN
      const pkName = primaryKey.Name;
      let resp;
      if (Array.isArray(data)) {
        const placeholders = data
          .map((_: any, i: number) => `$${i + 1}`)
          .join(", ");
        const result = await pool.query(
          `DELETE FROM "${name}" WHERE "${pkName}" IN (${placeholders}) RETURNING *`,
          data,
        );
        resp = result.rowCount;
      } else {
        resp = await deleteRows(name, { [pkName]: data });
      }

      res.status(200).json({
        status: "successful",
        data: resp,
        keys: data,
      });
    } catch (error: any) {
      res.status(200).json({ status: "Failed", data: error });
    }
  },
);

router.put(
  "/table/:version/:name/:type",
  async (req: express.Request, res: express.Response) => {
    const name = req.params.name!;
    const version = req.params.version!;
    const type = req.params.type!;
    const data = req.body;
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value != null),
    );

    const schema = await getEntryForm(name, version, type, true);
    if (name === "plugins") {
      if (data.pluginType.toLowerCase() === "mapper") {
        schema.required = schema.required.filter(
          (r: any) => r !== "pluginMinioObjectPath",
        );
      }
    }

    var val = validator.validate(cleanData, schema);
    if (!val.valid) {
      res.status(200).json({ status: "Failed", data: val });
    } else {
      try {
        const cols = await getColumns(name);
        const primaryKey = (cols || []).find(
          (col: any) => col.PrimaryKey && col.Type === "uuid",
        );

        const pkName = primaryKey.Name;
        const pkValue = cleanData[pkName];

        const updateData = { ...cleanData };
        delete updateData[pkName];

        let content: any = updateData;

        if (name === "plugins") {
          let fileContent = null;
          let minioObjectPath = null;
          const pluginId = data["pluginId"];

          if (content.pluginType.toLowerCase() !== "mapper") {
            if (
              content.pluginMinioObjectPath &&
              isPlainObject(content.pluginMinioObjectPath)
            ) {
              fileContent = content.pluginMinioObjectPath.content;
              minioObjectPath = `${pluginId}/${req.body.pluginType.toLowerCase()}_${req.body.pluginVersion}.js`;
            }
          } else if (content.pluginType.toLowerCase() === "mapper") {
            const existingPlugin = await findByPk(name, "pluginId", pluginId);
            if (!existingPlugin) {
              return res
                .status(404)
                .json({ status: "Failed", data: "Plugin not found" });
            }

            const config = content.config;
            if (config && typeof config === "string") {
              const _config = JSON.parse(config);
              const { oclUrl, orgId, sourceId, auth } = _config;
              const existingConfig: any = existingPlugin.config || {};

              const configChanged =
                oclUrl !== (existingConfig.oclUrl || "") ||
                orgId !== (existingConfig.orgId || "") ||
                sourceId !== (existingConfig.sourceId || "") ||
                auth !== (existingConfig.auth || "");

              if (
                configChanged &&
                content.pluginVersion === existingPlugin.pluginVersion
              ) {
                return res.status(200).json({
                  status: "Failed",
                  data: "Plugin version must be updated when config values are changed.",
                });
              }

              minioObjectPath = existingPlugin.pluginMinioObjectPath;
              if (configChanged) {
                const response: any = await generate(
                  { oclUrl, orgId, sourceId, auth },
                  res,
                );

                fileContent = JSON.stringify(response.data.pluginFile, null, 2);
                minioObjectPath = `${pluginId}/terminology-mapping_${orgId}_${sourceId}_${req.body.pluginVersion}.json`;

                await minioUtil.putObject({
                  bucketName: "plugins",
                  objectName: minioObjectPath,
                  data: fileContent,
                });
              }
            }
          }

          if (fileContent === null || minioObjectPath === null) {
            return res
              .status(404)
              .json({ status: "Failed", data: "No file to upload." });
          }

          await minioUtil.putObject({
            bucketName: "plugins",
            objectName: minioObjectPath,
            data: fileContent,
          });

          content = {
            ...updateData,
            pluginMinioObjectPath: minioObjectPath,
          };
        } else if (name === "users") {
          await keycloakService.updateUser(data["userId"], {
            id: data["userId"],
            email: content.email,
            firstName: content.firstName,
            lastName: content.lastName,
            phoneNumber: content.phoneNumber,
          });
        }

        const resp = await updateRow(name, content, { [pkName]: pkValue });

        res.status(200).json({
          status: "successful",
          data: resp,
          updateData,
          whereClause: { where: { [pkName]: pkValue } },
          cols,
        });
      } catch (error: any) {
        res.status(200).json({ status: "Failed", data: error });
      }
    }
  },
);

export default router;
